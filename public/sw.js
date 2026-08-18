/*
 * Offline service worker (brief §Phase 2.7).
 *
 * Strategy per request type:
 * - /api: never touched here; freshness is the product, and the app layer
 *   shows localStorage last-known data with an offline badge instead.
 * - Navigations (HTML): NETWORK-FIRST. Cache-first here meant every reload
 *   served the previous visit's build, so fixes that were already deployed
 *   kept "not arriving" on real phones. The cache is only the offline
 *   fallback now; a deploy shows up on the very next reload.
 * - Static assets: cache-first. Next.js content-hashes them, so a cached
 *   copy is by definition the right copy.
 *
 * Bump the version whenever this file's logic changes: activation drops
 * every older cache, which is what flushes stale HTML cached before the
 * network-first switch.
 */
const CACHE = "cyberekt-shell-v3";
const SHELL = ["/", "/signals", "/performance", "/reports", "/learn", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache market data here

  if (event.request.mode === "navigate") {
    // Pages: the live network wins; the cache only answers when offline.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached ?? caches.match("/"))
            .then((cached) => cached ?? Response.error())
        )
    );
    return;
  }

  // Assets: cached copy first, refreshed in the background. Next.js
  // content-hashes its asset URLs, so a cache hit is never the wrong file.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached ?? Response.error());
      return cached ?? fetched;
    })
  );
});
