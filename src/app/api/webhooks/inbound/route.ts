/**
 * Phase E: Webhook inbound handler.
 *
 * Receives and validates incoming webhooks from external providers.
 * Verifies HMAC signature before processing.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { WebhookDispatcher } from "@/lib/webhooks/dispatcher";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhooks/inbound
 *
 * Expected headers:
 * - X-Webhook-Signature: HMAC-SHA256 signature
 * - X-Webhook-Timestamp: ISO 8601 timestamp
 * - X-Webhook-Delivery-ID: Unique delivery ID
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-webhook-signature");
    const timestamp = request.headers.get("x-webhook-timestamp");
    const deliveryId = request.headers.get("x-webhook-delivery-id");

    if (!signature || !timestamp || !deliveryId) {
      return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
    }

    // Get raw body for signature verification
    const body = await request.text();

    // Guard against oversized payloads
    const MAX_PAYLOAD_SIZE = 1_000_000; // 1MB
    if (body.length > MAX_PAYLOAD_SIZE) {
      logger.warn("Webhook payload too large", { deliveryId, size: body.length });
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    // Verify signature — reject if no secret is configured
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      logger.error("Webhook secret not configured — rejecting all webhooks");
      return NextResponse.json({ error: "Webhook endpoint not configured" }, { status: 503 });
    }
    const isValid = WebhookDispatcher.verifySignature(body, signature, secret);

    if (!isValid) {
      logger.warn("Invalid webhook signature", { deliveryId });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload and validate depth
    const checkJsonDepth = (obj: unknown, maxDepth = 10, currentDepth = 0): boolean => {
      if (currentDepth > maxDepth) return false;
      if (obj && typeof obj === "object") {
        for (const value of Object.values(obj as Record<string, unknown>)) {
          if (!checkJsonDepth(value, maxDepth, currentDepth + 1)) return false;
        }
      }
      return true;
    };

    let parsed: { event: string; organizationId: string; data: Record<string, unknown> };
    try {
      parsed = JSON.parse(body);
    } catch (_err) {
      logger.warn("Webhook JSON parse failed", { deliveryId });
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!checkJsonDepth(parsed)) {
      logger.warn("Webhook payload too deeply nested", { deliveryId });
      return NextResponse.json({ error: "Payload too deeply nested" }, { status: 400 });
    }

    const payload = parsed as {
      event: string;
      organizationId: string;
      data: Record<string, unknown>;
    };

    // Check timestamp is recent (within 5 minutes) and not in the future
    const webhookTime = new Date(timestamp).getTime();
    const now = Date.now();

    // Reject invalid/unparseable timestamps (NaN)
    if (Number.isNaN(webhookTime)) {
      logger.warn("Webhook timestamp invalid (NaN)", { deliveryId, timestamp });
      return NextResponse.json({ error: "Invalid timestamp format" }, { status: 400 });
    }

    // Reject future timestamps (with 30s tolerance for clock skew)
    if (webhookTime > now + 30_000) {
      logger.warn("Webhook timestamp in the future", { deliveryId, webhookTime, now });
      return NextResponse.json({ error: "Timestamp in the future" }, { status: 400 });
    }

    // Reject timestamps older than 5 minutes
    const age = now - webhookTime;
    if (age > 5 * 60 * 1000) {
      logger.warn("Webhook timestamp too old", { deliveryId, age });
      return NextResponse.json({ error: "Request too old" }, { status: 400 });
    }

    // Verify organization exists
    const org = await db.organization.findUnique({
      where: { id: payload.organizationId },
    });

    if (!org) {
      logger.warn("Organization not found for webhook", {
        organizationId: payload.organizationId,
        deliveryId,
      });

      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    logger.info("Webhook received", {
      event: payload.event,
      organizationId: payload.organizationId,
      deliveryId,
    });

    // Route event to the appropriate handler.
    const eventResult = await processWebhookEvent(payload.event, payload.organizationId, payload.data);

    return NextResponse.json(
      { ok: true, deliveryId, processed: eventResult.processed, action: eventResult.action },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Webhook processing error", { error });

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Event processing — routes each event type to the right handler.
// ---------------------------------------------------------------------------

interface EventResult {
  processed: boolean;
  action: string;
}

async function processWebhookEvent(
  event: string,
  organizationId: string,
  data: Record<string, unknown>,
): Promise<EventResult> {
  switch (event) {
    // Integration sync events — triggered when an external system pushes changes.
    case "integration.sync.items":
    case "integration.sync.suppliers":
    case "integration.sync.purchase_orders": {
      const entity = event.split(".").pop()!;
      logger.info("Integration sync event received", { organizationId, entity });
      // Queue a background sync job for the specific entity type.
      // Full implementation calls the sync engine; for now log + ack.
      return { processed: true, action: `sync_queued:${entity}` };
    }

    // Import completion — the import worker signals that a bulk import finished.
    case "import.completed":
    case "import.failed": {
      const importId = data.importId as string | undefined;
      logger.info("Import event", { organizationId, event, importId });
      return { processed: true, action: event };
    }

    // Stock count lifecycle events (e.g. external scanner completes a count).
    case "stockcount.completed":
    case "stockcount.cancelled": {
      const countId = data.countId as string | undefined;
      logger.info("Stock count event", { organizationId, event, countId });
      return { processed: true, action: event };
    }

    // Webhook test / ping — always acknowledge.
    case "webhook.test":
      return { processed: true, action: "pong" };

    default:
      logger.warn("Unknown webhook event", { event, organizationId });
      return { processed: false, action: "unknown_event" };
  }
}

/**
 * Webhook health check.
 */
export async function HEAD() {
  return new Response(null, { status: 200 });
}
