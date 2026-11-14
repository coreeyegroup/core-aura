const cacheKey = 'core-aura-v0.1.0';
const assets = ['/', '/studio.css', '/studio.js', '/engine.js', '/app.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheKey).then(cache => cache.addAll(assets)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('core-aura-') && key !== cacheKey).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin && assets.includes(url.pathname)) {
    event.respondWith(caches.open(cacheKey).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});
