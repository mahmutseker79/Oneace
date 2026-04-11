/*
 * Offline write queue helpers — Sprint 25 (PWA Sprint 4 Part A).
 *
 * This file is the client-side API for enqueueing user intents that
 * cannot reach the server right now, and for the runner to drain
 * that queue when connectivity returns. It deliberately does NOT
 * know anything about specific operations (stock adjust, transfer,
 * whatever): the replay runner owns a dispatcher registry that
 * maps `opType` strings to concrete handlers, and this module just
 * moves `CachedPendingOp` rows through their lifecycle.
 *
 * Lifecycle:
 *
 *   enqueueOp()      — creates a row in `pending` status
 *   markOpInFlight() — runner claims a row before dispatching
 *   markOpSucceeded()— dispatch returned ok
 *   markOpFailed()   — dispatch returned an error or threw
 *   releaseInFlight()— runner crashed mid-dispatch; reset to pending
 *   clearSucceededOps() — janitor; reclaim space for old ok rows
 *
 * Every function is resilient: if IndexedDB is unavailable they
 * return a sentinel (null / false / []). The runner treats all
 * failures as "try again later" and never blocks the UI.
 *
 * All operations are scoped on `(orgId, userId)` exactly like the
 * read caches. A second user signing into the same browser will
 * never see or replay the first user's queued ops.
 *
 * IMPORTANT — idempotency contract:
 *
 *   The `id` generated at enqueue time IS the idempotency key that
 *   server-side handlers MUST honor. Every dispatcher is required
 *   to forward the op id to its server action so that a retry of
 *   a partially-applied op is a no-op on the second pass. Without
 *   this, a flaky network could double-apply a stock adjustment,
 *   which is the exact failure mode the offline queue is supposed
 *   to prevent.
 */

import { type CachedPendingOp, type CachedPendingOpStatus, getOfflineDb } from "./db";

/**
 * Sprint 28 — Background Sync tag.
 *
 * Shared between `enqueueOp` (which registers the tag when the
 * first offline write lands) and `public/sw.js` (which listens
 * for it and broadcasts a wake-up to every live client). Keep
 * these two constants in lockstep — Dexie tracks nothing about
 * the SW side of this contract, so a rename here requires a
 * matching rename in the worker.
 */
export const QUEUE_DRAIN_SYNC_TAG = "oneace-queue-drain";

export interface PendingOpScope {
  orgId: string;
  userId: string;
}

/**
 * Best-effort Background Sync registration.
 *
 * Called from `enqueueOp` after a successful write so the browser
 * knows to wake the SW when connectivity returns — even if every
 * tab has been closed in the meantime. This is a hint: on
 * browsers without the API (Safari, Firefox), the promise chain
 * falls through silently and the existing runner triggers
 * (`online`, `visibilitychange`, mount drain) still cover the
 * drain on foreground.
 *
 * Intentionally fire-and-forget. The caller does not await, and
 * any rejection is swallowed — a failed registration must never
 * stop the enqueue from succeeding, because the queue row is the
 * source of truth and the runner will eventually replay it on
 * the next tab open regardless of the sync tag.
 */
export function registerBackgroundSync(): void {
  if (typeof navigator === "undefined") return;
  const sw = navigator.serviceWorker;
  if (!sw) return;

  void sw.ready
    .then((registration) => {
      // `sync` is only present on browsers that implement the
      // Background Sync API (Chrome/Edge/Opera at time of writing).
      const syncManager = (
        registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        }
      ).sync;
      if (!syncManager || typeof syncManager.register !== "function") return;
      return syncManager.register(QUEUE_DRAIN_SYNC_TAG);
    })
    .catch(() => {
      // Silent fallback — the runner's foreground triggers still
      // cover the drain on the next user interaction.
    });
}

/**
 * Shape accepted by `enqueueOp`. The caller supplies the op type
 * and payload; this module stamps the id, timestamps, and initial
 * status/attempt-count.
 */
export interface EnqueueOpInput {
  scope: PendingOpScope;
  opType: string;
  payload: unknown;
}

/**
 * Generate a URL-safe unique id for a pending op. Uses the native
 * Web Crypto API when available (all modern browsers and secure
 * contexts), and falls back to a timestamp + random string for the
 * rare environment that lacks it. The id is **not** a
 * cryptographic secret — it's an idempotency key — so the fallback
 * is acceptable.
 */
function generateOpId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `op-${Date.now().toString(36)}-${randomPart}`;
}

/**
 * Enqueue a new intent. Returns the op id on success, or null if
 * IndexedDB is unavailable — in which case the caller should
 * either surface "couldn't queue, try again" to the user or fall
 * back to a direct network call and accept the failure.
 */
export async function enqueueOp(input: EnqueueOpInput): Promise<string | null> {
  const db = getOfflineDb();
  if (!db) return null;

  try {
    const id = generateOpId();
    const nowIso = new Date().toISOString();
    const row: CachedPendingOp = {
      id,
      orgId: input.scope.orgId,
      userId: input.scope.userId,
      opType: input.opType,
      payload: input.payload,
      status: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
      attemptCount: 0,
      lastError: null,
    };
    await db.pendingOps.put(row);
    // Sprint 28 — best-effort Background Sync hint. Fire-and-
    // forget: the queue row is the source of truth, so a failed
    // sync registration must not roll back the enqueue.
    registerBackgroundSync();
    return id;
  } catch {
    // Quota exceeded, transaction aborted, schema-upgrade in
    // flight — swallow and let the caller decide.
    return null;
  }
}

/**
 * List ops in a given scope filtered by status. Ordered by
 * `createdAt` ascending so the runner replays FIFO — the order the
 * user performed the operations is the order they reach the
 * server. Pass `statuses: undefined` to get every op in the scope.
 */
export async function listOps(
  scope: PendingOpScope,
  statuses?: readonly CachedPendingOpStatus[],
): Promise<CachedPendingOp[]> {
  const db = getOfflineDb();
  if (!db) return [];

  try {
    const allowed = new Set<CachedPendingOpStatus>(statuses ?? []);
    const rows = await db.pendingOps
      .where("[orgId+userId+status]")
      .between([scope.orgId, scope.userId, "\u0000"], [scope.orgId, scope.userId, "\uffff"])
      .filter((row) => (allowed.size === 0 ? true : allowed.has(row.status)))
      .toArray();
    rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    return rows;
  } catch {
    return [];
  }
}

/**
 * Count how many ops in the given scope match the provided
 * statuses. Kept separate from `listOps` so the status banner can
 * ask "how many pending" without paying to deserialize every
 * payload. Returns 0 on any failure.
 */
export async function countOps(
  scope: PendingOpScope,
  statuses: readonly CachedPendingOpStatus[],
): Promise<number> {
  const db = getOfflineDb();
  if (!db || statuses.length === 0) return 0;

  try {
    // Sum per-status counts — Dexie's compound-index equality is
    // exact so we walk each (orgId, userId, status) tuple once.
    let total = 0;
    for (const status of statuses) {
      const count = await db.pendingOps
        .where("[orgId+userId+status]")
        .equals([scope.orgId, scope.userId, status])
        .count();
      total += count;
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Transition an op from `pending` to `in_flight`. Returns the
 * freshly-updated row so the runner can hand it to the dispatcher
 * without re-reading it. Returns null if the row no longer exists
 * or is not in `pending` (another tab may have claimed it first).
 */
export async function markOpInFlight(id: string): Promise<CachedPendingOp | null> {
  const db = getOfflineDb();
  if (!db) return null;

  try {
    return await db.transaction("rw", db.pendingOps, async () => {
      const row = await db.pendingOps.get(id);
      if (!row) return null;
      // Only `pending` rows can transition to `in_flight`. A
      // retry of a failed op must first be re-enqueued (status
      // reset) by an explicit retry flow — this prevents the
      // runner from spinning on a row that the user has already
      // marked as manually resolved.
      if (row.status !== "pending") return null;
      const updated: CachedPendingOp = {
        ...row,
        status: "in_flight",
        updatedAt: new Date().toISOString(),
        attemptCount: row.attemptCount + 1,
      };
      await db.pendingOps.put(updated);
      return updated;
    });
  } catch {
    return null;
  }
}

/**
 * Mark a successfully-dispatched op. The row stays in the store
 * (status `succeeded`) so a separate janitor call can reclaim
 * space when the UI has had a chance to render "4 synced". A
 * future sprint may switch to immediate-delete if the extra rows
 * become a problem.
 */
export async function markOpSucceeded(id: string): Promise<boolean> {
  const db = getOfflineDb();
  if (!db) return false;

  try {
    const existing = await db.pendingOps.get(id);
    if (!existing) return false;
    const updated: CachedPendingOp = {
      ...existing,
      status: "succeeded",
      updatedAt: new Date().toISOString(),
      lastError: null,
    };
    await db.pendingOps.put(updated);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark a failed op. `retryable: true` resets status to `pending`
 * so the runner will pick it up again on the next drain
 * (typically on the next `online` event). `retryable: false`
 * stamps it as `failed` and leaves it for the user to inspect in
 * a "queued ops that didn't sync" review UI (Sprint 26+).
 *
 * `errorMessage` is truncated to 500 chars before storage —
 * server stack traces can be huge and we don't want one bad row
 * to bloat the whole DB.
 */
export async function markOpFailed(
  id: string,
  errorMessage: string,
  opts: { retryable: boolean },
): Promise<boolean> {
  const db = getOfflineDb();
  if (!db) return false;

  try {
    const existing = await db.pendingOps.get(id);
    if (!existing) return false;
    const truncated = errorMessage.length > 500 ? `${errorMessage.slice(0, 500)}…` : errorMessage;
    const updated: CachedPendingOp = {
      ...existing,
      status: opts.retryable ? "pending" : "failed",
      updatedAt: new Date().toISOString(),
      lastError: truncated,
    };
    await db.pendingOps.put(updated);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset any `in_flight` rows for a scope back to `pending`. The
 * runner calls this at startup because a previous tab may have
 * crashed mid-dispatch — those rows are stuck in `in_flight` and
 * need unsticking. Returns the count of rows released.
 */
export async function releaseInFlight(scope: PendingOpScope): Promise<number> {
  const db = getOfflineDb();
  if (!db) return 0;

  try {
    return await db.transaction("rw", db.pendingOps, async () => {
      const stuck = await db.pendingOps
        .where("[orgId+userId+status]")
        .equals([scope.orgId, scope.userId, "in_flight"])
        .toArray();
      if (stuck.length === 0) return 0;
      const nowIso = new Date().toISOString();
      const updated: CachedPendingOp[] = stuck.map((row) => ({
        ...row,
        status: "pending",
        updatedAt: nowIso,
      }));
      await db.pendingOps.bulkPut(updated);
      return updated.length;
    });
  } catch {
    return 0;
  }
}

/**
 * Transition a `failed` op back to `pending` so the runner will
 * attempt it again on the next drain. Sprint 30 (PWA Sprint 7) —
 * the "retry" button on the /offline/queue review screen calls
 * this. `attemptCount` is **not** reset, so the row still carries
 * its full history — a retried op that fails again is
 * distinguishable from a brand-new one. `lastError` is cleared so
 * the UI doesn't render a stale message while the retry is in
 * flight.
 *
 * Returns true on success, false if the row doesn't exist or is
 * not currently in `failed`. Only `failed` rows can be requeued
 * this way — retrying an already-pending row is a no-op anyway
 * and retrying an `in_flight` row would double-dispatch.
 */
export async function requeueFailedOp(id: string): Promise<boolean> {
  const db = getOfflineDb();
  if (!db) return false;

  try {
    return await db.transaction("rw", db.pendingOps, async () => {
      const row = await db.pendingOps.get(id);
      if (!row) return false;
      if (row.status !== "failed") return false;
      const updated: CachedPendingOp = {
        ...row,
        status: "pending",
        updatedAt: new Date().toISOString(),
        lastError: null,
      };
      await db.pendingOps.put(updated);
      return true;
    });
  } catch {
    return false;
  }
}

/**
 * Hard-delete a single op from the queue. Sprint 30 — the
 * "discard" button on the /offline/queue review screen calls
 * this for failed ops the user does NOT want to retry (the op is
 * stale, the user already re-did it manually, etc).
 *
 * Intentionally permissive about status: a user who clicks
 * discard on an op that has already been auto-retried into
 * `succeeded` should still see it disappear, not get a confusing
 * "couldn't delete" error. The dispatcher already ran with the
 * row's id as the idempotency key, so deleting here never
 * changes server state.
 *
 * Returns true if the row existed and was deleted. false
 * indicates either the row was already gone or IndexedDB is
 * unavailable — the caller should not distinguish the two.
 */
export async function deleteOp(id: string): Promise<boolean> {
  const db = getOfflineDb();
  if (!db) return false;

  try {
    const existing = await db.pendingOps.get(id);
    if (!existing) return false;
    await db.pendingOps.delete(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete every `failed` op in a given scope. Sprint 30 —
 * the "clear all failed" janitor button on the /offline/queue
 * review screen. Bounded by the (orgId, userId) index so a
 * multi-tenant browser only clears the active user's failures.
 *
 * Returns the number of rows deleted. This number is meaningful
 * to the UI — rendering "3 failed ops cleared" gives the user
 * confidence the button actually did something, which matters
 * because failed ops are the one UX surface where trust is
 * fragile.
 */
export async function clearFailedOps(scope: PendingOpScope): Promise<number> {
  const db = getOfflineDb();
  if (!db) return 0;

  try {
    const victims = await db.pendingOps
      .where("[orgId+userId+status]")
      .equals([scope.orgId, scope.userId, "failed"])
      .primaryKeys();
    if (victims.length === 0) return 0;
    await db.pendingOps.bulkDelete(victims);
    return victims.length;
  } catch {
    return 0;
  }
}

/**
 * Delete `succeeded` ops older than the provided threshold. The
 * runner calls this after a successful drain so the store never
 * grows unbounded. Returns the number of rows deleted.
 *
 * Default threshold: 5 minutes. That's long enough for the UI to
 * show a "synced" confirmation and short enough that a slow user
 * never sees a week-old op in the banner.
 */
export async function clearSucceededOps(
  scope: PendingOpScope,
  olderThanMs = 5 * 60 * 1000,
): Promise<number> {
  const db = getOfflineDb();
  if (!db) return 0;

  try {
    const threshold = Date.now() - olderThanMs;
    const thresholdIso = new Date(threshold).toISOString();
    const victims = await db.pendingOps
      .where("[orgId+userId+status]")
      .equals([scope.orgId, scope.userId, "succeeded"])
      .filter((row) => row.updatedAt < thresholdIso)
      .primaryKeys();
    if (victims.length === 0) return 0;
    await db.pendingOps.bulkDelete(victims);
    return victims.length;
  } catch {
    return 0;
  }
}
