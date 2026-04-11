/*
 * OneAce service worker — Sprint 22 foundation.
 *
 * Scope: this sprint deliberately does NOT cache business data.
 * The only goals are:
 *   1. Make the app installable (manifest + a controlling SW).
 *   2. Serve a friendly offline page when navigation fails.
 *   3. Cache immutable /_next/static assets so the shell loads
 *      fast on repeat visits.
 *
 * Non-goals for this sprint (deliberate — each deserves its own
 * sprint with proper conflict-resolution design):
 *   - Caching /api/* responses
 *   - Caching App Router route RSC payloads
 *   - IndexedDB / Dexie writes
 *   - Background sync or push notifications
 *
 * The cache name MUST be bumped whenever this file changes so
 * activate() can evict the old version atomically.
 */

const CACHE_VERSION = "oneace-sw-v2";
const PRECACHE = `${CACHE_VERSION}-precache`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Precache the bare minimum for the app to render an offline shell:
// the offline fallback HTML and the PWA manifest/icons. We do NOT
// precache the home page or any app routes — those need auth and
// would go stale instantly.
//
// Sprint 24 (PWA Sprint 3) adds /offline/items — a force-static
// route whose client component reads the cached catalog directly
// from Dexie. Because it does not touch auth or the DB, it is safe
// to precache and serve when the user is offline.
const PRECACHE_URLS = [
  "/offline",
  "/offline/items",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Use { cache: "reload" } so install always fetches fresh from
      // the network, bypassing any HTTP cache that might still hold
      // stale entries from the old SW.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {
            // A missing entry shouldn't block installation — a
            // partial precache still lets the worker activate.
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (!name.startsWith(CACHE_VERSION)) {
            return caches.delete(name);
          }
          return null;
        }),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Returns true if this request should completely bypass the SW and
 * hit the network unmodified. Auth, API, and any non-GET request
 * falls through here.
 */
function shouldBypass(request) {
  if (request.method !== "GET") return true;
  const url = new URL(request.url);
  // Only handle requests to our own origin.
  if (url.origin !== self.location.origin) return true;
  // Auth + API + Next internal data fetches — never cache.
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/_next/data/")) return true;
  // Next's hot-reload and dev tooling — never cache.
  if (url.pathname.startsWith("/_next/webpack-hmr")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (shouldBypass(request)) return;

  const url = new URL(request.url);

  // Immutable static assets — cache-first with revalidate-on-miss.
  // /_next/static/* filenames contain a content hash so the cache
  // entry is effectively permanent until a new deploy replaces it.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        // No cache hit — fall through to the network. If the
        // network fails, the rejection propagates naturally and
        // the browser treats the asset as unavailable (which is
        // the correct outcome: there's nothing sensible to
        // substitute for a hashed JS chunk).
        const response = await fetch(request);
        if (response?.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
    return;
  }

  // Navigation requests (top-level page loads): network-first, fall
  // back to the offline page. We deliberately do NOT cache the
  // response — auth state would leak between sessions.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          return response;
        } catch {
          const cache = await caches.open(PRECACHE);
          const offline = await cache.match("/offline");
          if (offline) return offline;
          // Last resort — a hand-rolled response if even the
          // precache is gone (shouldn't happen post-activate).
          return new Response("<!doctype html><title>Offline</title><h1>Offline</h1>", {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  // Everything else (images, fonts, etc.): stale-while-revalidate
  // against the static cache. Keeps the UI snappy without serving
  // indefinitely-stale assets.
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response?.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);
      return cached || (await networkFetch) || new Response(null, { status: 504 });
    })(),
  );
});

/**
 * Allows the page to trigger an immediate skipWaiting — the web
 * page can postMessage({ type: "SKIP_WAITING" }) to the waiting
 * worker to activate a new version without a hard reload.
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
