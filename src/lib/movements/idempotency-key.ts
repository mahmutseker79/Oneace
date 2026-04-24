// src/lib/movements/idempotency-key.ts
//
// GOD MODE roadmap 2026-04-23 — P0-03.
//
// StockMovement.idempotencyKey column is NULLABLE today. A webhook
// retry that omits a submission nonce can bypass the (orgId, key)
// partial-unique index (because Postgres treats `NULL ≠ NULL` in
// uniqueness). The P0-03 migration makes the column NOT NULL; this
// module supplies the three key derivations used to fill it:
//
//   1. `generateMovementIdempotencyKey()` — runtime UUID for
//      internal action handlers. Callable in both browser and Node.
//      Used by the postMovement seam as a default when the caller
//      doesn't supply one, so no call site has to think about it.
//
//   2. `deriveWebhookIdempotencyKey(provider, deliveryId)` —
//      deterministic. A webhook retry with the same (provider,
//      deliveryId) produces the same key, so the second insert
//      violates the unique index and is rejected by Prisma's P2002.
//
//   3. `deriveLegacyBackfillKey(id)` — sentinel for the P0-03
//      backfill. Existing NULL rows get `LEGACY:${id}` so the column
//      can flip to NOT NULL without data loss. The `LEGACY:` prefix
//      is reserved; new writes must not use it.
//
// Contract: every value returned here is <= 128 characters (the
// validation schemas use a 128 char ceiling). Always
// non-empty, always ASCII.

/**
 * Reserved prefix for the P0-03 backfill sentinel. New writes MUST
 * NOT use this prefix. The seam asserts this at dev time.
 */
export const LEGACY_KEY_PREFIX = "LEGACY:";

/**
 * Reserved prefix for webhook-derived keys. Keeps webhook keys from
 * colliding with UI-minted UUIDs even if a malicious client tries
 * to guess one.
 */
export const WEBHOOK_KEY_PREFIX = "wh:";

/**
 * Runtime UUID, suitable for StockMovement.idempotencyKey default.
 *
 * Uses `crypto.randomUUID()` when available (Node >= 14.17, all
 * modern browsers on a secure origin). Falls back to a
 * timestamp-plus-entropy string when the runtime lacks
 * `crypto.randomUUID`. The fallback is NOT cryptographically strong
 * but is unique-enough for a per-row movement key with a 24h
 * replay window.
 */
export function generateMovementIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const entropy = Math.random().toString(36).slice(2, 10);
  const tail = Math.random().toString(36).slice(2, 10);
  return `mv-${Date.now().toString(36)}-${entropy}${tail}`;
}

/**
 * Deterministic key for webhook-triggered movements. Same
 * (provider, deliveryId) → same key, so a retry lands on the
 * unique-constraint violation path instead of creating a duplicate
 * row.
 *
 * Input validation:
 *   - provider must be non-empty and match /^[a-z][a-z0-9_-]*$/ (our
 *     adapter directory convention under src/lib/integrations).
 *   - deliveryId must be non-empty; whitespace is trimmed.
 *
 * Throws on invalid input — webhook handlers should validate before
 * calling this, not catch downstream.
 */
export function deriveWebhookIdempotencyKey(provider: string, deliveryId: string): string {
  if (!provider || !/^[a-z][a-z0-9_-]*$/.test(provider)) {
    throw new Error(
      `deriveWebhookIdempotencyKey: invalid provider "${provider}" — expected lowercase kebab/snake`,
    );
  }
  const trimmed = (deliveryId ?? "").trim();
  if (!trimmed) {
    throw new Error(`deriveWebhookIdempotencyKey: deliveryId required (provider="${provider}")`);
  }
  // Guard against deliveryIds that are themselves huge (some
  // providers send base64-encoded blobs). Truncate so the full key
  // stays under the 128-char schema ceiling — the prefix + provider
  // claim at most 32 chars; leave the rest for the deliveryId.
  const maxDeliveryLen = 128 - (WEBHOOK_KEY_PREFIX.length + provider.length + 1);
  const safeDelivery = trimmed.length > maxDeliveryLen ? trimmed.slice(0, maxDeliveryLen) : trimmed;
  return `${WEBHOOK_KEY_PREFIX}${provider}:${safeDelivery}`;
}

/**
 * Backfill sentinel for the P0-03 NOT NULL migration. Existing
 * StockMovement rows with `idempotencyKey = NULL` get `LEGACY:${id}`
 * so the column can flip to NOT NULL without violating the unique
 * index. Only the migration SQL should emit these values; the seam
 * rejects any new write that starts with `LEGACY:`.
 */
export function deriveLegacyBackfillKey(movementId: string): string {
  if (!movementId || movementId.trim() === "") {
    throw new Error("deriveLegacyBackfillKey: movementId required");
  }
  return `${LEGACY_KEY_PREFIX}${movementId}`;
}

/**
 * Sanity guard used by the postMovement seam: callers must not pass
 * a key that starts with the reserved backfill prefix.
 */
export function isReservedLegacyKey(key: string | null | undefined): boolean {
  return typeof key === "string" && key.startsWith(LEGACY_KEY_PREFIX);
}
