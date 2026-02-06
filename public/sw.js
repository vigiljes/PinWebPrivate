const CACHE_NAME = "clipboard-pwa-v4"; // <-- bump this anytime you change SW
const ASSETS = [
  "/",                 // app shell
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Cache shell files. If one is missing, don’t fail the whole install.
      await Promise.allSettled(ASSETS.map((p) => cache.add(p)));
    } catch (e) {
      // swallow
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache non-GET requests (fixes Cache.put errors)
  if (req.method !== "GET") return;

  // Never cache API calls (clipboard data should always be live)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/functions/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Cache-first for shell; network fallback
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const resp = await fetch(req);
      if (resp && resp.ok) {
        cache.put(req, resp.clone());
      }
      return resp;
    } catch {
      // If offline and no cached match, try index as last resort
      return (await cache.match("/index.html")) || new Response("Offline", { status: 503 });
    }
  })());
});