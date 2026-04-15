/*
 * queue-lock — Sprint 31 (PWA Sprint 8).
 *
 * A thin wrapper around the Web Locks API used by the offline queue
 * runner to guarantee that only one tab at a time runs a drain pass
 * across the whole origin. Until this sprint the runner relied on
 * Dexie row claiming alone (`markOpInFlight` transitions only a
 * `pending` row so two tabs that both see the same row will still
 * only dispatch once). Row claiming is necessary and correct, but
 * it still means two tabs will both:
 *
 *   1. open parallel `listOps` range scans,
 *   2. enter the per-row loop,
 *   3. fire parallel `markOpInFlight` transactions that fight for
 *      ownership,
 *   4. potentially run the same janitor `clearSucceededOps` pass
 *      twice.
 *
 * Harmless but wasteful. Worse, a tab that loses every race still
 * pays the Dexie read cost. The Web Locks API lets us make that
 * waste explicit: whichever tab acquires the
 * `oneace-queue-drain` lock does the work, and every other tab's
 * drain call bails immediately (`ifAvailable: true`). The loser's
 * trigger event (online / visibilitychange / background sync)
 * still did its job — the winner will pick up any pending row the
 * loser would have seen.
 *
 * Feature detection:
 *
 *   Web Locks ships in Chrome 69+, Edge 79+, Firefox 96+, Safari
 *   15.4+. That covers every browser in our target matrix, but a
 *   missing `navigator.locks` or a missing `LockManager.request`
 *   (Safari in private mode historically gated this behind a
 *   permission prompt) should NOT break the runner — we fall back
 *   to running the function directly and rely on the existing
 *   Dexie row-claiming for safety. A browser without Web Locks is
 *   exactly where we were pre-Sprint-31, which shipped reliably
 *   for weeks, so the fallback is explicitly "no-op guard,
 *   previous behavior preserved".
 *
 * Intentional non-goals:
 *
 *   - We do NOT request `mode: "exclusive"` with blocking
 *     (the default). We pass `{ ifAvailable: true }` so a
 *     busy lock returns `null` immediately instead of queueing —
 *     the second tab should bail, not sit on a promise waiting
 *     for the first tab's drain to finish. Blocking would create
 *     a subtle hang if the first tab's drain threw before
 *     releasing (it wouldn't, because the lock releases on scope
 *     exit, but the semantics "try now or skip" are a better
 *     fit for this workload regardless).
 *
 *   - We do NOT share this lock with any other subsystem. A
 *     dedicated lock name ("oneace-queue-drain") keeps the
 *     contention surface small and makes DevTools' Application
 *     panel immediately readable.
 *
 * Intentionally NOT marked "use client": this module is a plain
 * browser-API wrapper with no React surface, and keeping it out of
 * the client directive graph lets the SW bundle import it too
 * (deferred, but the SW Sprint will want cross-tab guarding
 * eventually and this file is already ready for that).
 */

/**
 * Run `fn` under the offline-queue drain lock.
 *
 * Returns whatever `fn` returned on successful acquisition, or
 * `null` if another tab already holds the lock. Returns
 * `fn()`'s return value directly on browsers without Web Locks
 * (fallback: Dexie row claiming alone still prevents
 * double-dispatch).
 *
 * @param fn Async function to run while the lock is held. The
 *           lock is released automatically when this function's
 *           returned promise settles — throw or resolve, either
 *           works.
 * @returns `{ acquired: true, value }` if the function ran,
 *          `{ acquired: false, value: null }` if another tab
 *          holds the lock and this call was skipped.
 */
export async function withQueueDrainLock<T>(
  fn: () => Promise<T>,
): Promise<{ acquired: true; value: T } | { acquired: false; value: null }> {
  const locks = getLockManager();
  if (!locks) {
    // No Web Locks — run directly. Dexie row claiming still
    // provides per-row mutual exclusion, so this mirrors the
    // pre-Sprint-31 behavior byte-for-byte.
    const value = await fn();
    return { acquired: true, value };
  }

  // `ifAvailable: true` hands us `null` instead of queueing when
  // another tab holds the lock. The callback's return value is
  // bubbled out via the outer promise — that's how `LockManager
  // .request` composes.
  const result = await locks.request(QUEUE_DRAIN_LOCK_NAME, { ifAvailable: true }, async (lock) => {
    if (!lock) {
      // Another tab got the lock. Report skip upstream.
      return { skipped: true as const };
    }
    const value = await fn();
    return { skipped: false as const, value };
  });

  if (result.skipped) {
    return { acquired: false, value: null };
  }
  return { acquired: true, value: result.value };
}

/**
 * Returns `true` if the browser exposes the Web Locks API at all.
 * Consumers that want to surface "cross-tab guard active" UX can
 * use this to avoid claiming more than the runner actually does.
 */
export function isWebLocksSupported(): boolean {
  return getLockManager() !== null;
}

const QUEUE_DRAIN_LOCK_NAME = "oneace-queue-drain";

/**
 * Internal feature-detection helper. Returns the `LockManager` when
 * the browser exposes one with a callable `request`, and `null`
 * otherwise. Wrapped in its own helper so tests can stub it by
 * temporarily deleting `navigator.locks`.
 */
function getLockManager(): LockManager | null {
  if (typeof navigator === "undefined") return null;
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return null;
  if (typeof locks.request !== "function") return null;
  return locks;
}
