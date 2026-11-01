/* Vocab Quest service worker (online PWA).
 *
 * Goal: after the first visit the game starts fast and does not download the same pictures,
 * sounds, 3D models and code again. The game still needs the internet: rooms, questions,
 * answers and stars always go to the backend (another origin, never touched here).
 *
 * What is cached (same origin, GET only):
 * - Pages (navigation): network first, the saved page only if the network fails.
 * - Hashed build files (/assets/name-HASH.js|css) and /draco/*: cache first (they never change).
 * - Other files under /assets, /models, /fonts, /icons: shown from the cache at once and
 *   refreshed in the background (stale-while-revalidate), so a new deploy reaches the pupil
 *   on the next start.
 * Not cached: requests with a Range header (audio/video seeking), non-200 answers, the API,
 * Cloudinary and Google Fonts (the browser's own HTTP cache handles those).
 */
const CACHE = 'vq-runtime-v1';
const PAGE_CACHE = 'vq-pages-v1';
const KEEP = [CACHE, PAGE_CACHE];
const MAX_ENTRIES = 300;
const HASHED = /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|wasm)$/;
const STATIC_DIRS = /^\/(?:assets|models|fonts|icons|draco)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((c) => c.add(new Request('/', { cache: 'reload' }))).catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vq-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(res) {
  return res && res.status === 200 && res.type === 'basic';
}

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

async function put(cacheName, req, res) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(req, res);
    if (cacheName === CACHE) trim(cache);
  } catch {
    /* storage full or private mode: just skip caching */
  }
}

async function networkFirstPage(event) {
  try {
    const res = await fetch(event.request);
    if (cacheable(res)) event.waitUntil(put(PAGE_CACHE, '/', res.clone()));
    return res;
  } catch (err) {
    const cached = await caches.match('/', { cacheName: PAGE_CACHE });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(event) {
  const cached = await caches.match(event.request, { cacheName: CACHE });
  if (cached) return cached;
  const res = await fetch(event.request);
  if (cacheable(res)) event.waitUntil(put(CACHE, event.request, res.clone()));
  return res;
}

async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request, { cacheName: CACHE });
  const network = fetch(event.request)
    .then((res) => {
      if (cacheable(res)) return put(CACHE, event.request, res.clone()).then(() => res);
      return res;
    });
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(event));
    return;
  }
  if (url.pathname === '/sw.js') return;
  if (HASHED.test(url.pathname) || url.pathname.startsWith('/draco/')) {
    event.respondWith(cacheFirst(event));
    return;
  }
  if (STATIC_DIRS.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
