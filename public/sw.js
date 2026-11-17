// Service worker for Adois (hand-written, no build step).
//
// Privacy rule: authenticated pages and data are NEVER cached. Only immutable static assets
// (hashed /_next/static files), icons and the public /offline page are stored, so nothing
// about the user's finances survives a logout or is visible to another account on the device.
//
// Bump VERSION to drop old caches on the next deploy.
const VERSION = "v2"; // v2: app renamed to Adois (refreshes the cached manifest)
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon"
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // Server Actions (POST) and mutations go straight to the network

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase and other origins are not touched

  // Pages: always from the network; when it is unreachable, show the offline page.
  // The HTML itself is never cached (it contains the user's data).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  // Hashed build assets never change: cache first, fill the cache on the first hit
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Everything else (RSC payloads, prefetches, API routes) is left to the browser and Next.js
});
