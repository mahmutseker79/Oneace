"use client";

/*
 * OfflineQueueRunner — Sprint 25 substrate, Sprint 26 wires the
 * first concrete dispatcher, Sprint 31 adds the Web Locks
 * cross-tab guard.
 *
 * The replay runner. Mounted once per session from the `(app)`
 * layout, kept alive for the duration of the app shell. It owns a
 * dispatcher registry that maps `opType` strings to concrete
 * handler functions, and drains the Dexie-backed pending-ops
 * queue whenever connectivity looks like it came back.
 *
 * Design decisions:
 *
 *   1. Dispatcher registry as a module-level const map.
 *
 *      Sprint 25 shipped an empty `DISPATCHERS` registry as the
 *      seam. Sprint 26 registers the first real handler
 *      (`movement.create` → `dispatchMovementCreate`) by adding
 *      ONE import + ONE map entry — no changes to the drain
 *      loop itself. Every future op lands here the same way.
 *      Unknown opTypes still get marked as non-retryable failures
 *      so a typo never lives forever on the queue.
 *
 *   2. Triggers on `online` event + `visibilitychange` + a
 *      one-shot mount drain + Sprint 28 Background Sync relay.
 *
 *      `online` is the ideal hint but it's unreliable — some
 *      browsers lie about the network and some OS-level captive
 *      portals flip the flag back and forth. `visibilitychange`
 *      catches the "I came back from lunch" case where the
 *      network may have recovered while the tab was hidden. The
 *      mount drain handles the "I opened a fresh tab that had a
 *      stuck in_flight row from a previous crashed session" case.
 *      Sprint 28 adds a fourth trigger: the SW receives a `sync`
 *      event from the browser's Background Sync API and
 *      broadcasts a `{ type: "BACKGROUND_SYNC" }` message to
 *      every controlled client; this runner listens for it on
 *      `navigator.serviceWorker` and drains. That covers the
 *      "user closed the tab with queued writes, turned wifi on
 *      later, the SW wakes independently" case on browsers that
 *      implement the API (Chrome/Edge/Opera).
 *
 *   3. Cross-tab coordination via Web Locks (Sprint 31), with
 *      Dexie row claiming as the always-on fallback.
 *
 *      Two tabs on the same origin may both try to drain at once.
 *      Sprint 25–30 relied solely on `markOpInFlight` (a Dexie
 *      transaction that only transitions a `pending` row —
 *      whichever tab gets the write first claims the row, the
 *      other gets `null` and moves on). Correct but wasteful:
 *      every losing tab still paid for a `listOps` scan, a loop
 *      over every row, and a janitor pass. Sprint 31 wraps the
 *      whole drain function in `withQueueDrainLock`, which uses
 *      the Web Locks API with `ifAvailable: true` so a busy lock
 *      returns `null` immediately and the losing tab bails
 *      before it even reads `pendingOps`. On browsers without
 *      Web Locks (or when `navigator.locks` is missing — private
 *      Safari etc.) `withQueueDrainLock` is a no-op pass-through
 *      and we fall back to the existing Dexie row claiming,
 *      which is exactly how the pre-Sprint-31 build ran for weeks.
 *
 *   4. Scope pinned to the active membership at mount time.
 *
 *      The runner receives `orgId` + `userId` as props from the
 *      layout. If the user switches orgs mid-session, the layout
 *      re-renders and the runner remounts with the new scope.
 *      This is simpler than subscribing to an org-change event
 *      and covers every real code path (there is no way to
 *      switch orgs without re-rendering the layout).
 *
 *   5. Releases stuck `in_flight` rows at startup.
 *
 *      A prior tab may have crashed mid-dispatch. Those rows are
 *      stuck. `releaseInFlight` resets them so the runner can
 *      pick them up again. Called once, on mount.
 *
 * Non-goals this sprint:
 *
 *   - Exponential backoff (the runner retries on the next event,
 *     good enough until a real op is wired).
 *   - Per-op timeout (dispatchers own their own timeouts).
 *   - Surfacing runner progress to the UI beyond the simple badge
 *     count (that's the banner's job, this component is headless).
 */

import { useCallback, useEffect, useRef } from "react";

import type { CachedPendingOp } from "@/lib/offline/db";
import {
  COUNT_ENTRY_ADD_OP_TYPE,
  dispatchCountEntryAdd,
} from "@/lib/offline/dispatchers/count-entry-add";
import {
  MOVEMENT_CREATE_OP_TYPE,
  dispatchMovementCreate,
} from "@/lib/offline/dispatchers/movement-create";
import {
  type PendingOpScope,
  clearSucceededOps,
  listOps,
  markOpFailed,
  markOpInFlight,
  markOpSucceeded,
  releaseInFlight,
} from "@/lib/offline/queue";
import { withQueueDrainLock } from "@/lib/offline/queue-lock";

/**
 * Result a dispatcher returns after attempting an op.
 *
 *   ok:       server accepted, mark succeeded.
 *   retry:    transient failure, leave on the queue for the next drain.
 *   fatal:    non-retryable error, mark failed for manual review.
 */
export type DispatcherResult =
  | { kind: "ok" }
  | { kind: "retry"; reason: string }
  | { kind: "fatal"; reason: string };

/**
 * A dispatcher handles one opType. Given the full op row (so it
 * can read payload + idempotency key via `id`), it attempts the
 * server call and returns a `DispatcherResult`. Dispatchers must
 * never throw — swallow exceptions internally and return
 * `{ kind: "retry", reason: String(error) }` instead. The runner
 * treats an unhandled throw as a fatal failure to keep the queue
 * from oscillating on buggy handlers.
 */
export type OpDispatcher = (op: CachedPendingOp) => Promise<DispatcherResult>;

/**
 * Dispatcher registry. Keys are opType strings, values are
 * handlers. Sprint 25 shipped this empty as the Sprint 26 seam;
 * Sprint 26 registered `movement.create`, Sprint 27 adds
 * `countEntry.add` (the second entry — one import, one map row).
 * Every future opType lands here the same way without touching the
 * drain loop itself.
 */
const DISPATCHERS: Record<string, OpDispatcher> = {
  [MOVEMENT_CREATE_OP_TYPE]: dispatchMovementCreate,
  [COUNT_ENTRY_ADD_OP_TYPE]: dispatchCountEntryAdd,
};

export interface OfflineQueueRunnerProps {
  orgId: string;
  userId: string;
  /**
   * Optional override for tests / storybook. When provided, this
   * map fully replaces DISPATCHERS for the component's lifetime.
   */
  dispatchers?: Record<string, OpDispatcher>;
}

export function OfflineQueueRunner({ orgId, userId, dispatchers }: OfflineQueueRunnerProps) {
  // Refs so the drain closure never captures stale props when the
  // layout re-renders. We update them on every render.
  const scopeRef = useRef<PendingOpScope>({ orgId, userId });
  scopeRef.current = { orgId, userId };

  const dispatchersRef = useRef<Record<string, OpDispatcher>>(dispatchers ?? DISPATCHERS);
  dispatchersRef.current = dispatchers ?? DISPATCHERS;

  // Single-flight guard. A rapid sequence of events (online +
  // visibility + mount) must not spin up N parallel drains and
  // fight over the same rows.
  const drainingRef = useRef(false);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      // Sprint 31 — wrap the whole drain body in
      // `withQueueDrainLock`. When another tab already holds the
      // `oneace-queue-drain` Web Lock, the callback never runs
      // and `acquired` comes back `false` — we simply bail,
      // trusting that the owning tab will cover whatever pending
      // rows this trigger would have picked up. On browsers
      // without Web Locks the helper degrades to a no-op
      // pass-through and we run the drain inline exactly as we
      // did pre-Sprint-31, still protected by Dexie row claiming.
      await withQueueDrainLock(async () => {
        const scope = scopeRef.current;

        // One drain pass. The runner doesn't loop inside a single
        // call — it leans on the `online`/`visibilitychange`
        // re-triggers. This keeps the worst-case blast radius of a
        // buggy dispatcher small.
        const pending = await listOps(scope, ["pending"]);
        if (pending.length === 0) {
          await clearSucceededOps(scope);
          return;
        }

        for (const candidate of pending) {
          const claimed = await markOpInFlight(candidate.id);
          if (!claimed) continue; // Another tab got it first.

          const dispatcher = dispatchersRef.current[claimed.opType];
          if (!dispatcher) {
            // Unknown opType. Mark as a non-retryable failure so a
            // typo never lives forever on the queue.
            await markOpFailed(
              claimed.id,
              `no dispatcher registered for opType "${claimed.opType}"`,
              { retryable: false },
            );
            continue;
          }

          try {
            const result = await dispatcher(claimed);
            if (result.kind === "ok") {
              await markOpSucceeded(claimed.id);
            } else if (result.kind === "retry") {
              await markOpFailed(claimed.id, result.reason, { retryable: true });
            } else {
              await markOpFailed(claimed.id, result.reason, { retryable: false });
            }
          } catch (err) {
            // An unhandled throw from a dispatcher is a bug in the
            // dispatcher. Park the row as a fatal failure so the
            // runner doesn't loop on it, and a future "failed ops"
            // review screen can surface it for manual resolution.
            const reason = err instanceof Error ? err.message : String(err);
            await markOpFailed(claimed.id, `dispatcher threw: ${reason}`, {
              retryable: false,
            });
          }
        }

        // Janitor: reclaim space from old succeeded rows. Cheap
        // no-op if there are none.
        await clearSucceededOps(scope);
      });
    } finally {
      drainingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // One-shot startup work: release any `in_flight` rows left
    // over from a crashed previous session, then run the first
    // drain so a fresh tab picks up existing pending work right
    // away.
    let cancelled = false;

    const startup = async () => {
      await releaseInFlight(scopeRef.current);
      if (cancelled) return;
      void drain();
    };
    void startup();

    const handleOnline = () => {
      void drain();
    };
    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void drain();
      }
    };

    // Sprint 28 — Background Sync relay. `public/sw.js` listens
    // for the `sync` event from the browser's Background Sync
    // API and postMessages every controlled client with
    // `{ type: "BACKGROUND_SYNC", tag }`. This runner treats
    // that as a fourth drain trigger. Feature-detected: on
    // browsers without the API (Safari, Firefox) the listener
    // simply never fires and the foreground triggers still
    // cover everything.
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown } | null;
      if (data && data.type === "BACKGROUND_SYNC") {
        void drain();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
    };
  }, [drain]);

  // Headless. No DOM. The banner component is responsible for
  // surfacing queue state to the user.
  return null;
}
