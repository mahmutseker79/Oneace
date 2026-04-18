-- ─────────────────────────────────────────────────────────────────────────────
-- P1-3: Shopify webhook idempotency table
-- ─────────────────────────────────────────────────────────────────────────────
-- Audit v1.0 §5.7 — Shopify guarantees at-least-once webhook delivery and
-- retries on any non-2xx response (and occasionally on 2xx, by design).
-- Without dedup, a network blip or worker restart re-processes the same
-- inventory/order event and double-applies state.
--
-- Mirrors the Stripe pattern in `StripeWebhookEvent`: insert keyed on the
-- delivery's `X-Shopify-Webhook-Id` header. First insert succeeds → handler
-- proceeds. Duplicate insert hits the unique constraint (P2002) → handler
-- returns 200 + deduped:true and skips re-processing.
--
-- Idempotent: safe to reapply on any DB shape.

CREATE TABLE IF NOT EXISTS "ShopifyWebhookEvent" (
  "id"         TEXT NOT NULL,
  "webhookId"  TEXT NOT NULL,
  "topic"      TEXT NOT NULL,
  "shopDomain" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShopifyWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopifyWebhookEvent_webhookId_key"
  ON "ShopifyWebhookEvent"("webhookId");

CREATE INDEX IF NOT EXISTS "ShopifyWebhookEvent_createdAt_idx"
  ON "ShopifyWebhookEvent"("createdAt");

CREATE INDEX IF NOT EXISTS "ShopifyWebhookEvent_shopDomain_idx"
  ON "ShopifyWebhookEvent"("shopDomain");
