const version = '0.6.1';
const cacheKey = 'core-aura-v' + version;
const assets = ['/', '/studio.css', '/studio.js', '/chakra.js', '/chakra-audio.js', '/engine.js', '/yaman.js', '/update.html', '/updater.js', '/app.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheKey).then(cache => cache.addAll(assets.map(path => new Request(path, {cache: "reload"})))));
});
self.addEventListener('message', event => {
  if (event.data === 'VERSION') event.ports[0]?.postMessage(version);
  if (event.data === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('core-aura-') && key !== cacheKey).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin && assets.includes(url.pathname)) {
    event.respondWith(caches.open(cacheKey).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});
