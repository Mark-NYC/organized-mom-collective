// Service worker for the companion app (registered with scope /app).
//
// On install it saves the whole app (pages, scripts, styles, fonts, icons) so
// the app opens offline after a single visit. The build fills in VERSION and
// PRECACHE (see the offline integration in astro.config.mjs); in dev both stay empty.
//
// Pages: network first, so online users always get the latest version; the
// saved copy is used when the network fails or hangs.
// /_astro/ files: their names change with every build, so the saved copy is always right.
// Other files (icons, manifest): saved copy first, refreshed in the background.
const VERSION = 'dev';
const PRECACHE = [];

const CACHE = `omc-${VERSION}`;
const OFFLINE_FALLBACK = '/app';
const NAV_TIMEOUT_MS = 4000;

// A redirected response can't be used to answer a navigation, so store a plain copy.
const plain = (res) =>
  res.redirected
    ? res.blob().then((body) => new Response(body, { status: res.status, headers: res.headers }))
    : Promise.resolve(res);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            fetch(url, { cache: 'reload' }).then((res) => {
              if (!res.ok) throw new Error(`precache ${url}: ${res.status}`);
              return plain(res).then((r) => cache.put(url, r));
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

function fromNetwork(req) {
  return fetch(req).then((res) => {
    if (res.ok && !res.redirected) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
}

function fromCache(req) {
  return caches.match(req, { ignoreSearch: req.mode === 'navigate' });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_astro/')) {
    event.respondWith(fromCache(req).then((hit) => hit || fromNetwork(req)));
    return;
  }

  if (req.mode === 'navigate') {
    // Weak signal (e.g. one bar in the laundry room): don't make her wait on the network
    // when a saved copy exists. The network answer still refreshes the cache in the background.
    const network = fromNetwork(req);
    event.respondWith(
      new Promise((resolve, reject) => {
        let settled = false;
        const useCache = () =>
          fromCache(req).then((hit) => {
            if (hit && !settled) {
              settled = true;
              resolve(hit);
            }
            return hit;
          });
        const timer = setTimeout(useCache, NAV_TIMEOUT_MS);
        network.then(
          (res) => {
            clearTimeout(timer);
            if (!settled) {
              settled = true;
              resolve(res);
            }
          },
          () => {
            clearTimeout(timer);
            useCache().then((hit) => {
              if (settled) return;
              if (hit) return;
              caches.match(OFFLINE_FALLBACK).then((fallback) => {
                settled = true;
                fallback ? resolve(fallback) : reject(new Error('offline'));
              });
            });
          },
        );
      }),
    );
    return;
  }

  // Icons and other small files: answer from the saved copy right away, refresh it in the background.
  const network = fromNetwork(req);
  event.waitUntil(network.catch(() => {}));
  event.respondWith(fromCache(req).then((hit) => hit || network.catch(() => Response.error())));
});
