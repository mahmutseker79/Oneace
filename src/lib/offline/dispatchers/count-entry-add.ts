/*
 * dispatchCountEntryAdd — Sprint 27 (PWA Sprint 4 follow-on).
 *
 * Second concrete dispatcher registered with the Sprint 25 queue
 * substrate. Given a pending-op row whose `opType` is
 * `"countEntry.add"`, this module:
 *
 *   1. Parses the row's `payload` as a `CountEntryOpPayload`
 *      (`{ idempotencyKey, input }`).
 *   2. Calls the `submitCountEntryOpAction` server action.
 *   3. Translates the server's `CountEntryOpResult` into a runner-
 *      shaped `DispatcherResult` (`ok | retry | fatal`).
 *
 * Design notes — mirror movement-create.ts so both dispatchers follow
 * the same contract:
 *
 *   - Pure client-side module, no "use client" needed because there
 *     are no JSX or React hooks. Imports the Server Action directly;
 *     the Next.js compiler lifts it to an RPC boundary at build time.
 *
 *   - Defensive Zod parse on the payload we pulled out of IndexedDB.
 *     A stale client that shipped a malformed op from a prior schema
 *     version gets marked `fatal` here so it surfaces in the
 *     failed-ops UI instead of looping.
 *
 *   - The server action never throws — every error path returns a
 *     structured `CountEntryOpResult`. The try/catch here only
 *     catches RPC transport failures (fetch, network, CORS, 5xx),
 *     which map to `retry` because they're transient.
 *
 *   - The queue row id (internal handle) and the `idempotencyKey`
 *     (server-side dedupe key) are distinct values. The key is
 *     stamped on the pending op BEFORE enqueue so a crash between
 *     "write to Dexie" and "dispatch" never produces a fresh key on
 *     replay.
 */

import { submitCountEntryOpAction } from "@/app/(app)/stock-counts/actions";
import type { DispatcherResult, OpDispatcher } from "@/components/offline/offline-queue-runner";
import type { CachedPendingOp } from "@/lib/offline/db";
import { type CountEntryOpPayload, countEntryOpPayloadSchema } from "@/lib/validation/stockcount";

export const COUNT_ENTRY_ADD_OP_TYPE = "countEntry.add" as const;

/**
 * Narrowing helper used by the entry form so it enqueues the exact
 * payload shape the dispatcher will re-validate. Colocated with the
 * dispatcher to keep producer and consumer in lockstep.
 */
export function buildCountEntryAddPayload(payload: CountEntryOpPayload): CountEntryOpPayload {
  return countEntryOpPayloadSchema.parse(payload);
}

export const dispatchCountEntryAdd: OpDispatcher = async (
  op: CachedPendingOp,
): Promise<DispatcherResult> => {
  const parsed = countEntryOpPayloadSchema.safeParse(op.payload);
  if (!parsed.success) {
    return {
      kind: "fatal",
      reason: `countEntry.add payload failed validation: ${parsed.error.message}`,
    };
  }

  try {
    const result = await submitCountEntryOpAction(parsed.data);
    if (result.ok) {
      return { kind: "ok" };
    }
    if (result.retryable) {
      return { kind: "retry", reason: result.error };
    }
    return { kind: "fatal", reason: result.error };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "retry", reason: `transport error: ${reason}` };
  }
};
