/*
 * OneAce service worker — Sprint 22 foundation,
 * Sprint 24 adds /offline/items to the precache list,
 * Sprint 28 adds a Background Sync "drain queue" hook.
 *
 * Scope: this worker deliberately does NOT cache business data.
 * The goals are:
 *   1. Make the app installable (manifest + a controlling SW).
 *   2. Serve a friendly offline page when navigation fails.
 *   3. Cache immutable /_next/static assets so the shell loads
 *      fast on repeat visits.
 *   4. Relay a Background Sync wake-up to every controlled client
 *      so the offline queue runner can drain on connectivity
 *      return — even if no tab is currently foregrounded
 *      (Sprint 28, feature-detected; silently absent on Safari
 *      and Firefox).
 *
 * Non-goals (deliberate — each deserves its own design pass):
 *   - Caching /api/* responses
 *   - Caching App Router route RSC payloads
 *   - IndexedDB writes *inside* the SW (the runner lives in the
 *     client; we just post a message so it knows to drain)
 *   - Push notifications
 *
 * The cache name MUST be bumped whenever this file changes so
 * activate() can evict the old version atomically.
 */

const CACHE_VERSION = "oneace-sw-v3";
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

/**
 * Sprint 28 — Background Sync relay.
 *
 * The offline write queue (`src/lib/offline/queue.ts`) lives in
 * the client, not here: IndexedDB access from inside a SW would
 * duplicate the schema owner and create a second writer we don't
 * need. Instead, `enqueueOp` registers a `sync` tag with the SW,
 * and when the browser decides network is back (possibly while
 * every tab is closed), this handler wakes and postMessages every
 * controlled client. The `OfflineQueueRunner` component listens
 * for that message and runs a drain pass.
 *
 * Why a broadcast instead of running the drain here:
 *   - Dexie is the single source of truth; we don't want a second
 *     Dexie instance (one in the SW, one per tab) fighting over
 *     the pending-ops store.
 *   - Server Actions (our dispatcher transport) are client-side;
 *     the SW can't call them directly.
 *   - If no clients are open when sync fires, there's nothing to
 *     wake — the next foreground drain will handle the queue via
 *     the existing mount-time / visibilitychange triggers. This
 *     is the correct graceful degradation.
 *
 * The tag name is opaque — only the client and this handler need
 * to agree on it. `oneace-queue-drain` is stable.
 */
const QUEUE_DRAIN_SYNC_TAG = "oneace-queue-drain";

self.addEventListener("sync", (event) => {
  if (event.tag !== QUEUE_DRAIN_SYNC_TAG) return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Tell every live client to drain. The runner has a single-
      // flight guard so two tabs receiving the same message will
      // still only produce one drain pass per row via Dexie
      // row-claiming.
      for (const client of clients) {
        client.postMessage({ type: "BACKGROUND_SYNC", tag: QUEUE_DRAIN_SYNC_TAG });
      }
    })(),
  );
});
