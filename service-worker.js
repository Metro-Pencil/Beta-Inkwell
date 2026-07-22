// Cache Storage is shared across every app on this origin (e.g. username.github.io),
// not per sub-path — so this beta build and the main app's service worker both
// see the exact same cache list. CACHE_PREFIX makes sure this service worker's
// cleanup step only ever touches caches belonging to *this* (beta) build,
// never the main app's cache, even though they share an origin.
const CACHE_PREFIX = 'ledger-beta-cache-';
const CACHE_NAME = CACHE_PREFIX + 'v31';
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

// Cache-first for anything already cached (and refreshed in the background
// for next time). For anything not yet cached, try the network — and if
// that fails (offline), fall back to the cached app shell for navigations,
// since this is a single-page app: index.html can serve any route. Without
// this fallback, an offline navigation to a URL that was never cached
// resolves to nothing and the browser shows its own generic "you're
// offline" page instead of the app.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const isNavigation = event.request.mode === 'navigate';

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) {
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    } catch (err) {
      if (isNavigation) {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
