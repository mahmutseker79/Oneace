/**
 * Phase E: Webhook inbound handler.
 *
 * Receives and validates incoming webhooks from external providers.
 * Verifies HMAC signature before processing.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { WebhookDispatcher } from "@/lib/webhooks/dispatcher";

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
      return NextResponse.json(
        { error: "Missing webhook headers" },
        { status: 400 },
      );
    }

    // Get raw body for signature verification
    const body = await request.text();

    // Verify signature
    const secret = process.env.WEBHOOK_SECRET || "default-secret";
    const isValid = WebhookDispatcher.verifySignature(body, signature, secret);

    if (!isValid) {
      logger.warn("Invalid webhook signature", { deliveryId });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    // Parse payload
    const payload = JSON.parse(body) as {
      event: string;
      organizationId: string;
      data: Record<string, unknown>;
    };

    // Check timestamp is recent (within 5 minutes)
    const webhookTime = new Date(timestamp).getTime();
    const now = Date.now();
    const age = now - webhookTime;

    if (age > 5 * 60 * 1000) {
      logger.warn("Webhook timestamp too old", {
        deliveryId,
        age,
      });

      return NextResponse.json(
        { error: "Request too old" },
        { status: 400 },
      );
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

      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    logger.info("Webhook received", {
      event: payload.event,
      organizationId: payload.organizationId,
      deliveryId,
    });

    // TODO: Process webhook based on event type
    // - Handle integration sync events
    // - Handle import completion events
    // - Trigger appropriate actions

    return NextResponse.json(
      { ok: true, deliveryId },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Webhook processing error", { error });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Webhook health check.
 */
export async function HEAD() {
  return new Response(null, { status: 200 });
}
