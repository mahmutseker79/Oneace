/**
 * Phase 6C — replay protection for `receivePurchaseOrderAction`.
 *
 * Context: `StockMovement.idempotencyKey` + the compound
 * `@@unique([organizationId, idempotencyKey])` index already exist
 * in the schema (added in Sprint 26 for the single-row
 * `writeMovement` / `writeCountEntry` paths). PO receive creates N
 * movement rows in one transaction, so we can't reuse the template
 * verbatim — we need a DIFFERENT key per row so the unique index
 * doesn't collapse two rows of the same batch into a collision.
 *
 * The shape `po-receive:<nonce>:<lineId>` gives us:
 *
 *   1. A namespace prefix so the key can't collide with a
 *      single-row movement key from `writeMovement`.
 *   2. A stable per-form-mount nonce from the client, so that a
 *      retry from the SAME form instance re-derives the SAME set
 *      of keys. The receive action can pre-check the first key
 *      and short-circuit the whole batch as a replay.
 *   3. A per-line suffix so every row in one batch gets a
 *      distinct key, satisfying the compound-unique constraint.
 *
 * Non-goals: this helper does NOT defend against over-receive from
 * two concurrent form mounts (two tabs, two nonces, two successful
 * batches). That is the existing multi-writer concurrency bug
 * documented at `src/app/(app)/purchase-orders/actions.ts:482-489`
 * and is explicitly out of Phase 6C scope.
 */

/**
 * Derive the idempotency key that a PO-receive movement row should
 * carry. Pure function — no I/O, no randomness. Given the same
 * inputs it always returns the same output, which is the entire
 * point of a replay-protection key.
 *
 * @param submissionNonce  Stable per-form-mount nonce from the
 *                         client (e.g. `crypto.randomUUID()`).
 * @param lineId           The PO line id being received.
 */
export function deriveReceiveIdempotencyKey(submissionNonce: string, lineId: string): string {
  return `po-receive:${submissionNonce}:${lineId}`;
}

/** Shared namespace prefix — exported so tests can assert on it. */
export const PO_RECEIVE_KEY_PREFIX = "po-receive:";
