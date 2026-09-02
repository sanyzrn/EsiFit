/* EsiFit Service Worker — shell caching + offline fallback.
   Strategy:
   - Precache: offline fallback page, icons, manifest
   - Navigation requests: network-first with cache fallback (never serves stale shell while online)
   - Static assets: stale-while-revalidate
   - API GETs: network-only (offline-sensitive writes go through IndexedDB queue instead)
   Update flow: waiting SW is activated immediately; clients reload when idle
   (never mid-workout — see client listener guard). */

const VERSION = "esifit-v2";
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

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
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached ?? caches.match("/offline").then((off) => off ?? Response.error()))
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
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      })
    );
  }
  // Everything else (incl. /api): pass through to network; failures surface as app errors.
});
