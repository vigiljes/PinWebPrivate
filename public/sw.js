const CACHE_NAME = "clipboard-pwa-v5"; // bump to force update
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(ASSETS.map((p) => cache.add(p)));
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

  // Only handle GET
  if (req.method !== "GET") return;

  // Only handle normal web schemes (prevents chrome-extension:// cache.put crash)
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never cache API responses
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/functions/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Optional: only cache same-origin (extra safety)
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const resp = await fetch(req);
      if (resp && resp.ok) {
        await cache.put(req, resp.clone());
      }
      return resp;
    } catch {
      return (await cache.match("/index.html")) || new Response("Offline", { status: 503 });
    }
  })());
});