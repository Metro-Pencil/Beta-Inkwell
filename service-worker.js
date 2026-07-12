// Cache Storage is shared across every app on this origin (username.github.io),
// not per sub-path — so this beta build and the main app's service worker both
// see the exact same cache list. CACHE_PREFIX makes sure this service worker's
// cleanup step only ever touches caches belonging to *this* (beta) build,
// never the main app's cache, even though they share an origin.
const CACHE_PREFIX = 'ledger-beta-cache-';
const CACHE_NAME = CACHE_PREFIX + 'v17';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((url) =>
        cache.add(url).catch((err) => console.warn('service worker: could not precache', url, err))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first for the app shell, falling back to network, so the app opens
// fully offline after the first visit. Network requests that aren't part of
// the shell (e.g. Google Fonts) are passed through and cached opportunistically.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
