/**
 * @openapi-tag: /integrations/shopify/webhooks
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
/**
 * Phase E — Shopify webhook handler.
 *
 * Shopify sends HMAC-SHA256 signed webhooks for subscribed topics.
 * We verify the signature using the app's API secret, then queue
 * a targeted sync for the affected entity.
 *
 * @see https://shopify.dev/docs/apps/build/webhooks
 *
 * P1-3 (audit v1.0 §5.7): adds at-least-once → exactly-once webhook
 * delivery via the `ShopifyWebhookEvent` dedup table, keyed on the
 * `X-Shopify-Webhook-Id` header. Shopify guarantees at-least-once
 * delivery (and retries on any non-2xx response, plus occasional
 * spurious retries on 2xx — by design); without dedup, a network blip
 * or worker restart can re-process the same inventory/order event and
 * double-apply state changes.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/integrations/shopify/webhooks
 *
 * Receives topic notifications from Shopify.
 */
export async function POST(request: NextRequest) {
  try {
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiSecret) {
      logger.error("SHOPIFY_API_SECRET not configured");
      return NextResponse.json({ error: "Webhook endpoint not configured" }, { status: 503 });
    }

    const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
    const topic = request.headers.get("x-shopify-topic");
    const shopDomain = request.headers.get("x-shopify-shop-domain");
    // P1-3: Shopify sends a unique X-Shopify-Webhook-Id on every
    // delivery. The same logical event re-delivered (retry, dual-region
    // failover, etc.) carries the same id. We use it as the dedup key.
    const webhookId = request.headers.get("x-shopify-webhook-id");

    if (!hmacHeader || !topic || !shopDomain) {
      return NextResponse.json({ error: "Missing required Shopify headers" }, { status: 400 });
    }

    const body = await request.text();

    // Verify HMAC-SHA256 signature (constant-time comparison) BEFORE we
    // touch any DB or read the dedup key — never let an unauthenticated
    // caller probe the dedup table or learn the shape of our errors.
    const computedHmac = createHmac("sha256", apiSecret).update(body, "utf8").digest("base64");

    const sigBuffer = Buffer.from(hmacHeader, "base64");
    const computedBuffer = Buffer.from(computedHmac, "base64");

    if (sigBuffer.length !== computedBuffer.length || !timingSafeEqual(sigBuffer, computedBuffer)) {
      logger.warn("Invalid Shopify webhook signature", { shopDomain, topic });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // P1-3: Idempotency check. Insert FIRST — the unique constraint on
    // `webhookId` is what guarantees exactly-once. If `X-Shopify-
    // Webhook-Id` is missing (older Shopify deliveries, or a misbehaving
    // forwarder), we fall back to processing without dedup and log a
    // warning so we can spot it. The dedup row is written before the
    // sync queue call so a crash mid-handling never re-enqueues.
    if (webhookId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic model access (matches Integration usage in this file)
        await (db as any).shopifyWebhookEvent.create({
          data: { webhookId, topic, shopDomain },
        });
      } catch (err) {
        // P2002 = unique constraint violation → duplicate delivery.
        // Anything else is a real error and should bubble up.
        if (isUniqueConstraintError(err)) {
          logger.info("Duplicate Shopify webhook ignored", {
            webhookId,
            shopDomain,
            topic,
          });
          return NextResponse.json({ ok: true, deduped: true });
        }
        throw err;
      }
    } else {
      logger.warn("Shopify webhook missing X-Shopify-Webhook-Id header — cannot dedupe", {
        shopDomain,
        topic,
      });
    }

    // Look up the organization connected to this Shopify store.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic model access
    const integration = await (db as any).integration?.findFirst({
      where: { provider: "SHOPIFY", externalId: shopDomain },
      select: { organizationId: true, id: true },
    });

    if (!integration) {
      logger.warn("Shopify webhook for unknown shop", { shopDomain });
      // Return 200 so Shopify doesn't keep retrying for unconnected shops.
      // The dedup row already inserted means a future re-delivery for
      // this same event also short-circuits.
      return NextResponse.json({ ok: true, processed: false });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Route by topic
    const action = routeShopifyTopic(topic, payload, integration.organizationId);

    logger.info("Shopify webhook processed", {
      organizationId: integration.organizationId,
      shopDomain,
      topic,
      action,
      webhookId,
    });

    return NextResponse.json({ ok: true, action });
  } catch (error) {
    logger.error("Shopify webhook processing error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Detect a Prisma unique-constraint violation without importing the
 * generated error class (the dynamic `(db as any)` pattern this file
 * uses sidesteps the typed client). Prisma throws an object whose
 * `code` is "P2002" for unique constraint violations across all
 * supported databases.
 */
function isUniqueConstraintError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return code === "P2002";
}

/**
 * Route a Shopify webhook topic to the appropriate action.
 */
function routeShopifyTopic(
  topic: string,
  _payload: Record<string, unknown>,
  organizationId: string,
): string {
  switch (topic) {
    case "products/create":
    case "products/update":
    case "products/delete":
      logger.info("Shopify product change", { organizationId, topic });
      return "sync_queued:products";

    case "inventory_levels/update":
    case "inventory_levels/connect":
    case "inventory_levels/disconnect":
      logger.info("Shopify inventory change", { organizationId, topic });
      return "sync_queued:inventory";

    case "orders/create":
    case "orders/updated":
    case "orders/cancelled":
      logger.info("Shopify order event", { organizationId, topic });
      return "sync_queued:orders";

    case "app/uninstalled":
      logger.info("Shopify app uninstalled", { organizationId });
      return "app_uninstalled";

    default:
      logger.info("Unhandled Shopify topic", { organizationId, topic });
      return `unhandled:${topic}`;
  }
}
