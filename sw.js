// Offline support: the page is cached after each successful visit and served
// from cache when the network is unavailable. Requests to other sites
// (dictionary sources, CORS proxies) are never touched.
const CACHE = 'yiddish-dictionary-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add('./')).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then(hit =>
          hit || (req.mode === 'navigate' ? caches.match('./') : undefined)
        )
      )
  );
});
