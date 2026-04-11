/*
 * dispatchMovementCreate — Sprint 26 (PWA Sprint 4 Part B).
 *
 * The first concrete dispatcher registered with the Sprint 25 queue
 * substrate. Given a pending-op row whose `opType` is
 * `"movement.create"`, this module:
 *
 *   1. Parses the row's `payload` as a `MovementOpPayload`
 *      (`{ idempotencyKey, input }`).
 *   2. Calls the `submitMovementOpAction` server action.
 *   3. Translates the server's `MovementOpResult` into a runner-
 *      shaped `DispatcherResult` (`ok | retry | fatal`).
 *
 * Design notes:
 *
 *   - The module is pure client-side code (no "use client" directive
 *     is needed because it's not a React component). It imports the
 *     Server Action directly; the Next.js compiler lifts the action
 *     to an RPC boundary at build time so the runtime call is just
 *     `fetch` over the wire.
 *
 *   - The payload on the pending-op row is typed as `unknown` because
 *     it came out of IndexedDB. We run a defensive Zod parse here
 *     (via the server action's own validator) rather than trusting
 *     the shape. If a stale client shipped a malformed payload
 *     because of a schema change, the dispatcher marks the op as
 *     fatal so it surfaces in the failed-ops UI instead of looping.
 *
 *   - The server action never throws — every error path returns a
 *     structured `MovementOpResult`. But we still wrap the call in a
 *     try/catch because the RPC layer itself (fetch, network, CORS,
 *     5xx) can throw. A throw from fetch is a transient failure
 *     worth retrying, so it maps to `retry`. A throw from validation
 *     or anything else we caught is a fatal bug.
 *
 *   - The op id (queue row id) and the idempotencyKey are distinct
 *     values. The queue row id is the internal handle the runner
 *     uses to mark success/failure; the idempotencyKey is what the
 *     server uses to deduplicate replays. We generate the
 *     idempotencyKey in the form (before enqueue) so that a crash
 *     between "write to Dexie" and "dispatch" never creates a new
 *     key on retry.
 */

import { submitMovementOpAction } from "@/app/(app)/movements/actions";
import type { DispatcherResult, OpDispatcher } from "@/components/offline/offline-queue-runner";
import type { CachedPendingOp } from "@/lib/offline/db";
import { type MovementOpPayload, movementOpPayloadSchema } from "@/lib/validation/movement";

export const MOVEMENT_CREATE_OP_TYPE = "movement.create" as const;

/**
 * Narrowing helper used by the form so it enqueues the exact payload
 * shape the dispatcher will re-validate. Keeping this export colocated
 * with the dispatcher ensures the schema never drifts between
 * producer and consumer.
 */
export function buildMovementCreatePayload(payload: MovementOpPayload): MovementOpPayload {
  return movementOpPayloadSchema.parse(payload);
}

export const dispatchMovementCreate: OpDispatcher = async (
  op: CachedPendingOp,
): Promise<DispatcherResult> => {
  const parsed = movementOpPayloadSchema.safeParse(op.payload);
  if (!parsed.success) {
    // The queue row's payload is malformed — a stale client, a
    // mid-migration schema change, or hand-tampered IndexedDB. Not
    // something a retry will fix.
    return {
      kind: "fatal",
      reason: `movement.create payload failed validation: ${parsed.error.message}`,
    };
  }

  try {
    const result = await submitMovementOpAction(parsed.data);
    if (result.ok) {
      return { kind: "ok" };
    }
    if (result.retryable) {
      return { kind: "retry", reason: result.error };
    }
    return { kind: "fatal", reason: result.error };
  } catch (error) {
    // Fetch / network / 5xx made it past the action boundary. Every
    // throw at this layer is a transport issue, not a business-logic
    // failure, so the next drain should try again. The reason string
    // is truncated by `markOpFailed` downstream so we don't need to
    // clip it here.
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "retry", reason: `transport error: ${reason}` };
  }
};
