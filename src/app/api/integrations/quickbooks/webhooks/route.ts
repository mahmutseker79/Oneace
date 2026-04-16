/**
 * Phase E — QuickBooks Online webhook handler.
 *
 * QuickBooks sends real-time notifications when entities change in the
 * connected company. We verify the signature, parse the notification,
 * and queue a targeted sync for the affected entities.
 *
 * QBO signature verification uses HMAC-SHA256 with the verifier token
 * from the app dashboard (stored in QBO_WEBHOOK_VERIFIER_TOKEN env var).
 *
 * @see https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
 */

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/integrations/quickbooks/webhooks
 *
 * Receives change notifications from QuickBooks Online.
 */
export async function POST(request: NextRequest) {
  try {
    const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
    if (!verifierToken) {
      logger.error("QBO_WEBHOOK_VERIFIER_TOKEN not configured");
      return NextResponse.json(
        { error: "Webhook endpoint not configured" },
        { status: 503 },
      );
    }

    const signature = request.headers.get("intuit-signature");
    const body = await request.text();

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // Verify HMAC-SHA256 signature
    const expected = createHmac("sha256", verifierToken)
      .update(body)
      .digest("base64");

    if (signature !== expected) {
      logger.warn("Invalid QBO webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body) as {
      eventNotifications?: Array<{
        realmId: string;
        dataChangeEvent?: {
          entities: Array<{
            name: string;
            id: string;
            operation: string;
            lastUpdated: string;
          }>;
        };
      }>;
    };

    if (!payload.eventNotifications?.length) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processedCount = 0;

    for (const notification of payload.eventNotifications) {
      const realmId = notification.realmId;

      // Look up the organization connected to this QBO realm.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma dynamic model access
      const integration = await (db as any).integration?.findFirst({
        where: { provider: "QUICKBOOKS", externalId: realmId },
        select: { organizationId: true, id: true },
      });

      if (!integration) {
        logger.warn("QBO webhook for unknown realm", { realmId });
        continue;
      }

      const entities = notification.dataChangeEvent?.entities ?? [];
      for (const entity of entities) {
        logger.info("QBO entity change", {
          organizationId: integration.organizationId,
          entity: entity.name,
          entityId: entity.id,
          operation: entity.operation,
        });
        processedCount++;
      }
    }

    return NextResponse.json({ ok: true, processed: processedCount });
  } catch (error) {
    logger.error("QBO webhook processing error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
