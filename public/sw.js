const CACHE_NAME = "clipboard-pwa-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Always hit network for API (don’t cache clipboard)
  if (url.pathname.startsWith("/.netlify/functions/") || url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).then((resp) => {
          // Cache successful GETs for the shell
          if (req.method === "GET" && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return resp;
        }).catch(() => cached)
      );
    })
  );
});