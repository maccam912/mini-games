import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderDirectory } from './render-directory.mjs';

const headMarker = '<!-- arcade:head -->';
const workerTemplate = new URL('./service-worker.template.js', import.meta.url);

async function listFiles(root, folder = '') {
  const result = [];
  for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = path.posix.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(root, file));
    else if (entry.isFile()) result.push(file);
    else throw new Error('Expected a regular file or directory at ' + path.join(root, file));
  }
  return result.sort();
}

async function copyTree(source, destination) {
  const files = await listFiles(source);
  for (const file of files) {
    const from = path.join(source, file);
    if ((await stat(from)).size <= 1024 && (await readFile(from, 'utf8')).startsWith('version https://git-lfs.github.com/spec/v1')) {
      throw new Error('Git LFS pointer in ' + from + '. Run git lfs pull before building.');
    }
    const to = path.join(destination, file);
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
  }
  return files;
}

function fileUrl(file) {
  return file.split('/').map(encodeURIComponent).join('/');
}

async function checkIcon(file, size) {
  const header = Buffer.alloc(24);
  const handle = await open(file);
  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }
  if (header.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
      header.toString('ascii', 12, 16) !== 'IHDR' ||
      header.readUInt32BE(16) !== size || header.readUInt32BE(20) !== size) {
    throw new Error(file + ' must be a ' + size + '×' + size + ' PNG icon.');
  }
}

async function readGame(slug, gameDir, files) {
  const metadata = JSON.parse(await readFile(path.join(gameDir, 'game.json'), 'utf8'));
  for (const field of ['title', 'description', 'controls', 'genre', 'themeColor']) {
    if (typeof metadata[field] !== 'string' || !metadata[field].trim()) {
      throw new Error(slug + '/game.json needs a ' + field + ' string.');
    }
  }
  if (!/^#[\da-f]{6}$/i.test(metadata.themeColor)) throw new Error(slug + ' needs a #RRGGBB themeColor.');
  const assets = ['cover', 'icon192', 'icon512'];
  if ('wordmark' in metadata) assets.push('wordmark');
  if ('maskableIcon' in metadata) assets.push('maskableIcon');
  if ('featured' in metadata && typeof metadata.featured !== 'boolean') {
    throw new Error(slug + '/game.json featured must be a boolean.');
  }
  for (const field of assets) {
    const file = metadata[field];
    if (!files.includes(file) || /[?#%\\:]/.test(file)) {
      throw new Error(slug + '/game.json needs a game-relative ' + field + ' filename pointing to an existing asset.');
    }
  }
  await checkIcon(path.join(gameDir, metadata.icon192), 192);
  await checkIcon(path.join(gameDir, metadata.icon512), 512);
  if (metadata.maskableIcon) await checkIcon(path.join(gameDir, metadata.maskableIcon), 512);
  return { ...metadata, slug };
}

function manifest(game) {
  const icons = [192, 512].map(size => ({
    src: './' + fileUrl(game['icon' + size]),
    sizes: size + 'x' + size,
    type: 'image/png'
  }));
  if (game.maskableIcon) icons.push({ src: './' + fileUrl(game.maskableIcon), sizes: '512x512', type: 'image/png', purpose: 'maskable' });
  // Omitting id uses start_url as the app identity, including the Pages project prefix.
  return {
    name: game.title,
    short_name: game.title,
    description: game.description,
    start_url: './',
    scope: './',
    display: 'standalone',
    ...(game.orientation === 'portrait' ? { orientation: 'portrait' } : {}),
    background_color: game.themeColor,
    theme_color: game.themeColor,
    categories: ['games'],
    icons
  };
}

function head(game) {
  return [
    '<meta name="theme-color" content="' + game.themeColor + '">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<link rel="manifest" href="./manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="./' + fileUrl(game.icon192) + '">',
    '<link rel="stylesheet" href="../../shared/pwa.css">',
    '<script type="module" src="../../shared/pwa.js"></script>'
  ].join('\n  ');
}

async function buildGame(gameDir, output, slug, sharedFiles, template) {
  const destination = path.join(output, 'games', slug);
  const files = await copyTree(gameDir, destination);
  const game = await readGame(slug, destination, files);
  if (files.includes('sw.js') || files.includes('manifest.webmanifest')) {
    throw new Error(slug + ' contains a reserved generated filename (sw.js or manifest.webmanifest).');
  }
  const index = path.join(destination, 'index.html');
  const html = await readFile(index, 'utf8');
  if (html.split(headMarker).length !== 2) throw new Error(index + ' needs exactly one ' + headMarker);
  await writeFile(index, html.replace(headMarker, () => head(game)));
  await writeFile(path.join(destination, 'manifest.webmanifest'), JSON.stringify(manifest(game), null, 2) + '\n');
  const assets = [...files, 'manifest.webmanifest', ...sharedFiles.map(file => '../../shared/' + file)].sort();
  const hash = createHash('sha256').update(template);
  for (const asset of assets) {
    const file = path.join(destination, asset);
    hash.update(JSON.stringify([asset, (await stat(file)).size]));
    for await (const chunk of createReadStream(file)) hash.update(chunk);
  }
  const worker = template.replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 20))
    .replace('__ASSET_PATHS__', () => JSON.stringify(assets.map(fileUrl)));
  await writeFile(path.join(destination, 'sw.js'), worker);
  return game;
}

async function buildSite(root, output) {
  const pages = await copyTree(path.join(root, 'site'), output);
  if (!pages.includes('index.html')) throw new Error('Missing site/index.html');
  const sharedFiles = await copyTree(path.join(root, 'shared'), path.join(output, 'shared'));
  for (const file of ['pwa.css', 'pwa.js']) {
    if (!sharedFiles.includes(file)) throw new Error('Missing shared/' + file);
  }
  const catalog = [];
  const games = path.join(root, 'games');
  const template = await readFile(workerTemplate, 'utf8');
  for (const dir of await readdir(games, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('.')) continue;
    const gameDir = path.join(games, dir.name);
    if (!(await readdir(gameDir)).includes('game.json')) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dir.name)) throw new Error('Invalid game slug: ' + dir.name);
    catalog.push(await buildGame(gameDir, output, dir.name, sharedFiles, template));
  }
  catalog.sort((a, b) => a.title.localeCompare(b.title, 'en') || a.slug.localeCompare(b.slug, 'en'));
  const directory = path.join(output, 'index.html');
  await writeFile(directory, renderDirectory(await readFile(directory, 'utf8'), catalog));
  await writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  await writeFile(path.join(output, '.nojekyll'), '');
  return catalog;
}

export async function build(root) {
  const stage = await mkdtemp(path.join(root, '.arcade-build-'));
  const next = path.join(stage, 'next');
  const previous = path.join(stage, 'previous');
  const live = path.join(root, 'dist');
  try {
    const catalog = await buildSite(root, next);
    try {
      await rename(live, previous);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await rename(next, live);
    } catch (error) {
      // A parallel build can publish first. Preserve its complete output in that case.
      try { await rename(previous, live); }
      catch (restoreError) {
        if (!['ENOENT', 'EEXIST', 'ENOTEMPTY'].includes(restoreError.code)) throw restoreError;
      }
      throw error;
    }
    return catalog;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = await build(fileURLToPath(new URL('../', import.meta.url)));
  console.log('Built Pocket Cabinet with ' + catalog.length + ' game(s) in dist/.');
}
