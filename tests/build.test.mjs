import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

const icons = {
  192: 'iVBORw0KGgoAAAANSUhEUgAAAMAAAADAAQAAAAB6p1GqAAAAHElEQVR4nO3BMQEAAADCoPVPbQ0PoAAAAADg1wASwAAB0sGsvgAAAABJRU5ErkJggg==',
  512: 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIAAQAAAADcA+lXAAAANklEQVR4nO3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8G4IAAAHSeInwAAAAAElFTkSuQmCC'
};

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pocket-cabinet-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'site'));
  await writeFile(path.join(root, 'site/index.html'), '<title>Pocket Cabinet</title><!-- arcade:feature --><!-- arcade:count --><!-- arcade:games -->');
  await mkdir(path.join(root, 'shared'));
  await writeFile(path.join(root, 'shared/pwa.js'), '/* shared code */');
  await writeFile(path.join(root, 'shared/pwa.css'), '/* shared styles */');
  for (const [slug, title] of [['first', 'Zulu'], ['second', 'Alpha']]) {
    const directory = path.join(root, 'games', slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'index.html'), '<head><!-- arcade:head --></head>');
    await writeFile(path.join(directory, 'audio clip.mp3'), 'abcdef');
    for (const [size, data] of Object.entries(icons)) {
      await writeFile(path.join(directory, size + '.png'), Buffer.from(data, 'base64'));
    }
    await writeFile(path.join(directory, 'game.json'), JSON.stringify({
      title, description: 'Fun', genre: 'Arcade', controls: 'Tap',
      cover: '512.png', icon512: '512.png', icon192: '192.png', themeColor: '#112233'
    }));
  }
  return root;
}

test('discovers games, builds portable manifests, and versions every offline dependency', async t => {
  const root = await fixture(t);
  await build(root);
  const output = path.join(root, 'dist');
  const catalog = JSON.parse(await readFile(path.join(output, 'catalog.json')));
  assert.deepEqual(catalog.map(game => game.slug), ['second', 'first']);
  const directory = await readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(directory, /href="\.\/games\/first\/"/);
  assert.match(directory, /href="\.\/games\/second\/"/);
  assert.match(directory, /2 games/);
  const alpha = path.join(output, 'games/second');
  const manifest = JSON.parse(await readFile(path.join(alpha, 'manifest.webmanifest')));
  const base = new URL('https://example.org/a/project/games/second/');
  assert.equal(new URL(manifest.scope, base).href, base.href);
  assert.equal(new URL(manifest.start_url, base).href, base.href);
  assert.equal(manifest.name, 'Alpha');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  const html = await readFile(path.join(alpha, 'index.html'), 'utf8');
  assert.ok(html.includes('href="./manifest.webmanifest"'));
  assert.ok(html.includes('src="../../shared/pwa.js"'));
  assert.ok(!html.includes('<!-- arcade:head -->'));
  const workerPath = path.join(alpha, 'sw.js');
  const firstVersion = await readFile(workerPath, 'utf8');
  await writeFile(path.join(root, 'games/first/audio clip.mp3'), 'another game changed');
  await build(root);
  assert.equal(await readFile(workerPath, 'utf8'), firstVersion);
  await writeFile(path.join(root, 'games/second/audio clip.mp3'), 'this game changed');
  await build(root);
  const secondVersion = await readFile(workerPath, 'utf8');
  assert.notEqual(secondVersion, firstVersion);
  await writeFile(path.join(root, 'shared/pwa.js'), '/* new shared code */');
  await build(root);
  assert.notEqual(await readFile(workerPath, 'utf8'), secondVersion);
});

test('rejects missing assets and unresolved LFS pointers', async t => {
  const root = await fixture(t);
  await build(root);
  const game = path.join(root, 'games/second');
  const metaFile = path.join(game, 'game.json');
  const metadata = JSON.parse(await readFile(metaFile, 'utf8'));
  await writeFile(metaFile, JSON.stringify({ ...metadata, cover: '../first/512.png' }));
  await assert.rejects(build(root), /game-relative cover/);
  await writeFile(metaFile, JSON.stringify(metadata));
  await writeFile(path.join(root, 'site/hero.png'), 'version https://git-lfs.github.com/spec/v1\noid sha256:123\nsize 456\n');
  await assert.rejects(build(root), /Git LFS pointer.*hero.png/);
  const published = JSON.parse(await readFile(path.join(root, 'dist/catalog.json'), 'utf8'));
  assert.equal(published.length, 2);
});

test('game worker serves its offline launch and shared resources without claiming other games', async t => {
  const root = await fixture(t);
  await build(root);
  const source = await readFile(path.join(root, 'dist/games/first/sw.js'), 'utf8');
  const scope = 'https://example.org/project/games/first/';
  const prefix = 'pocket-cabinet:' + scope + ':';
  const otherGame = 'pocket-cabinet:https://example.org/project/games/second/:other';
  const otherProject = 'pocket-cabinet:https://example.org/another/games/first/:other';
  const stores = new Map([[prefix + 'old', new Map()], [otherGame, new Map()], [otherProject, new Map()]]);
  const caches = {
    async keys() { return [...stores.keys()]; },
    async delete(key) { return stores.delete(key); },
    async open(key) {
      if (!stores.has(key)) stores.set(key, new Map());
      const entries = stores.get(key);
      return {
        async addAll(requests) {
          for (const request of requests) {
            assert.equal(request.cache, 'reload');
            const relative = decodeURIComponent(new URL(request.url).pathname.slice('/project/'.length));
            const bytes = await readFile(path.join(root, 'dist', relative));
            entries.set(request.url, new Response(bytes));
          }
        },
        async match(url) { return entries.get(url)?.clone(); }
      };
    }
  };
  const handlers = {};
  let claimed = false;
  vm.runInNewContext(source, {
    caches, URL, Request, Response,
    self: {
      registration: { scope },
      addEventListener(event, fn) { handlers[event] = fn; },
      clients: { async claim() { claimed = true; } }
    },
    fetch() { throw new Error('Network unavailable'); }
  });
  for (const event of ['install', 'activate']) {
    let done;
    handlers[event]({ waitUntil(promise) { done = promise; } });
    await done;
  }
  assert.equal(claimed, true);
  assert.equal(stores.has(prefix + 'old'), false);
  assert.equal(stores.has(otherGame), true);
  assert.equal(stores.has(otherProject), true);
  function request(file, mode = 'cors', headers = {}) {
    let response;
    handlers.fetch({
      request: { method: 'GET', url: new URL(file, scope).href, mode, headers: new Headers(headers) },
      respondWith(promise) { response = promise; }
    });
    return response;
  }
  assert.match(await (await request('./?launch', 'navigate')).text(), /manifest\.webmanifest/);
  assert.match(await (await request('../../shared/pwa.js')).text(), /shared code/);
  assert.equal(request('../second/', 'navigate'), undefined);
  assert.equal(request('./missing.js'), undefined);
  const clip = await request('audio%20clip.mp3', 'cors', { Range: 'bytes=2-4' });
  assert.equal(clip.status, 206);
  assert.equal(clip.headers.get('Content-Range'), 'bytes 2-4/6');
  assert.equal(await clip.text(), 'cde');
});
