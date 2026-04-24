// src/lib/movements/webhook.ts
//
// GOD MODE roadmap 2026-04-23 — P0-03 rc3.
//
// Thin helper over `postMovement` for webhook-driven ledger writes.
//
// Why a dedicated helper?
// -----------------------
// Today NO integration sync engine writes StockMovement rows — the
// Shopify and QuickBooks webhook handlers enqueue IntegrationTask
// rows, and the cron-drained sync engines touch external entities
// (products, orders, customers) without reaching the inventory
// ledger. When a future sync engine DOES add a movement-producing
// path (e.g. Shopify inventory_levels webhook → SEPA receipt), it
// must use a deterministic key derived from the provider's delivery
// id so that a retry lands on the (orgId, idempotencyKey) unique
// violation instead of double-booking.
//
// This helper is the documented call shape. The companion pinned
// test (integrations-must-use-webhook-helper.static.test.ts) fails
// CI if anything under `src/lib/integrations/**` or
// `src/app/api/integrations/**` calls `postMovement` directly
// without going through this helper — the seam pattern one layer up.
//
// What this is NOT:
//   - Not a webhook router. Route-level dedup stays in the
//     `ShopifyWebhookEvent` table and similar (see the webhook
//     route at `src/app/api/integrations/shopify/webhooks/route.ts`).
//   - Not a rate-limiter. Each provider's limits live in their
//     adapter's base-client.

import type { Prisma, StockMovement } from "@/generated/prisma";

import { deriveWebhookIdempotencyKey } from "./idempotency-key";
import { postMovement, type StockMovementInput, type TxClient } from "./post";

export interface WebhookMovementInput
  extends Omit<StockMovementInput, "idempotencyKey"> {
  /**
   * Provider slug — matches the adapter directory under
   * `src/lib/integrations/<provider>` (lowercase kebab/snake).
   */
  provider: string;
  /**
   * External delivery id. For Shopify this is
   * `X-Shopify-Webhook-Id`; for QuickBooks it's the event id from
   * the webhook body. MUST be unique per logical delivery; a retry
   * of the same delivery produces the same id.
   */
  deliveryId: string;
}

/**
 * Write a StockMovement in response to an external webhook. Derives
 * a deterministic idempotency key from (provider, deliveryId) so
 * that a retry hits the unique index instead of creating a
 * duplicate row.
 *
 * Usage:
 *
 *   await db.$transaction(async (tx) => {
 *     await postWebhookMovement(tx, {
 *       provider: "shopify",
 *       deliveryId: headers["x-shopify-webhook-id"],
 *       organizationId,
 *       itemId,
 *       warehouseId,
 *       type: "RECEIPT",
 *       quantity,
 *       reference: `shopify:${orderId}`,
 *     });
 *   });
 *
 * Throws `Error` if provider/deliveryId shape is invalid (see
 * deriveWebhookIdempotencyKey).
 */
export async function postWebhookMovement(
  tx: TxClient,
  input: WebhookMovementInput,
): Promise<StockMovement> {
  const { provider, deliveryId, ...rest } = input;
  const idempotencyKey = deriveWebhookIdempotencyKey(provider, deliveryId);
  return postMovement(tx, { ...rest, idempotencyKey });
}

// Re-export the companion types for convenience — integration
// authors don't need to chase two imports.
export type { Prisma };
