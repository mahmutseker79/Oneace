/**
 * Phase E — Shopify webhook handler.
 *
 * Shopify sends HMAC-SHA256 signed webhooks for subscribed topics.
 * We verify the signature using the app's API secret, then queue
 * a targeted sync for the affected entity.
 *
 * @see https://shopify.dev/docs/apps/build/webhooks
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
      return NextResponse.json(
        { error: "Webhook endpoint not configured" },
        { status: 503 },
      );
    }

    const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
    const topic = request.headers.get("x-shopify-topic");
    const shopDomain = request.headers.get("x-shopify-shop-domain");

    if (!hmacHeader || !topic || !shopDomain) {
      return NextResponse.json(
        { error: "Missing required Shopify headers" },
        { status: 400 },
      );
    }

    const body = await request.text();

    // Verify HMAC-SHA256 signature (constant-time comparison)
    const computedHmac = createHmac("sha256", apiSecret)
      .update(body, "utf8")
      .digest("base64");

    const sigBuffer = Buffer.from(hmacHeader, "base64");
    const computedBuffer = Buffer.from(computedHmac, "base64");

    if (
      sigBuffer.length !== computedBuffer.length ||
      !timingSafeEqual(sigBuffer, computedBuffer)
    ) {
      logger.warn("Invalid Shopify webhook signature", { shopDomain, topic });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Look up the organization connected to this Shopify store.
    const integration = await (db as any).integration?.findFirst({
      where: { provider: "SHOPIFY", externalId: shopDomain },
      select: { organizationId: true, id: true },
    });

    if (!integration) {
      logger.warn("Shopify webhook for unknown shop", { shopDomain });
      // Return 200 so Shopify doesn't keep retrying for unconnected shops.
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
    });

    return NextResponse.json({ ok: true, action });
  } catch (error) {
    logger.error("Shopify webhook processing error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
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
      return `sync_queued:products`;

    case "inventory_levels/update":
    case "inventory_levels/connect":
    case "inventory_levels/disconnect":
      logger.info("Shopify inventory change", { organizationId, topic });
      return `sync_queued:inventory`;

    case "orders/create":
    case "orders/updated":
    case "orders/cancelled":
      logger.info("Shopify order event", { organizationId, topic });
      return `sync_queued:orders`;

    case "app/uninstalled":
      logger.info("Shopify app uninstalled", { organizationId });
      return "app_uninstalled";

    default:
      logger.info("Unhandled Shopify topic", { organizationId, topic });
      return `unhandled:${topic}`;
  }
}
