// The build fills in the content version and list of game and shared resources.
const scope = self.registration.scope;
const prefix = 'pocket-cabinet:' + scope + ':';
const cacheName = prefix + '__BUILD_VERSION__';
const assets = new Set(__ASSET_PATHS__.map(path => new URL(path, scope).href));
const index = new URL('index.html', scope).href;

self.addEventListener('install', event => {
  // A waiting update activates after the previous game's windows close.
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(Array.from(assets, url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = '';
  const key = event.request.mode === 'navigate' && url.href === scope ? index : url.href;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(cacheName)).match(key);
    if (!cached) return fetch(event.request);
    const range = event.request.headers.get('Range');
    if (!range) return cached;

    // WebKit requests byte ranges when playing cached audio and video.
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return fetch(event.request);
    const body = await cached.blob();
    const start = match[1] ? Number(match[1]) : Math.max(0, body.size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), body.size - 1) : body.size - 1;
    if (start > end || start >= body.size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + body.size } });
    }
    return new Response(body.slice(start, end + 1), {
      status: 206,
      headers: {
        'Content-Type': body.type,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + body.size,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes'
      }
    });
  })());
});
