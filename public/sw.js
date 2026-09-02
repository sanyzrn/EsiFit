/* EsiFit Service Worker — shell caching + offline fallback.
   Strategy:
   - Precache: offline fallback page, icons, manifest
   - Navigation requests: network-first with cache fallback (never serves stale shell while online)
   - Static assets: stale-while-revalidate
   - API GETs: network-only (offline-sensitive writes go through IndexedDB queue instead)
   Update flow: waiting SW is activated immediately; clients reload when idle
   (never mid-workout — see client listener guard). */

const VERSION = "esifit-v3";
/* Personalized HTML lives in its own cache so signing out can drop it without
   throwing away the static shell. */
const PAGES_CACHE = `${VERSION}-pages`;
const PRECACHE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION && k !== PAGES_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/* Sign-out purges every page rendered for the previous account: without this a
   later visitor on the same device could read a cached dashboard offline. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "esifit:clear-private-cache") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});

/* Only 200 OK, non-redirected, same-origin basic responses are cacheable —
   storing a redirect or an error page makes the offline fallback serve it back. */
function isCacheable(res) {
  return Boolean(res) && res.ok && res.status === 200 && res.type === "basic" && !res.redirected;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // mutations are offline-queued by the app layer
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fallback to cache/offline page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(PAGES_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req, { cacheName: PAGES_CACHE })
            .then((cached) => cached ?? caches.match("/offline").then((off) => off ?? Response.error()))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || url.pathname.startsWith("/fonts")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (isCacheable(res)) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      })
    );
  }
  // Everything else (incl. /api): pass through to network; failures surface as app errors.
});
