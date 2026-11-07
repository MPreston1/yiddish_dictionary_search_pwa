// Offline support: the page is cached after each successful visit and served
// from cache when the network is unavailable or too slow. Requests to other
// sites (dictionary sources, CORS proxies) are never touched.
const CACHE = 'yiddish-dictionary-v1';
const NETWORK_TIMEOUT_MS = 3000; // on a weak connection, give up on the network after this and use the cached copy

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

  const fromCache = () =>
    caches.match(req, { ignoreSearch: true }).then(hit =>
      hit || (req.mode === 'navigate' ? caches.match('./') : undefined)
    );

  // Network-first, but if it hasn't answered within the timeout, serve the
  // cached copy. The network request keeps going in the background and
  // refreshes the cache when it finishes, so the next load is up to date.
  const network = fetch(req).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  });
  e.waitUntil(network.catch(() => {}));

  const timeout = new Promise(resolve => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));

  e.respondWith(
    Promise.race([network, timeout])
      .then(res => res || fromCache().then(hit => hit || network)) // nothing cached yet: keep waiting for the network
      .catch(() => fromCache().then(hit => hit || Response.error()))
  );
});
