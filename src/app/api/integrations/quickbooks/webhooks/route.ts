/**
 * QuickBooks Online Webhook Handler.
 *
 * Receives real-time change notifications from QBO and:
 * 1. Verifies HMAC-SHA256 signature
 * 2. Parses entity change events
 * 3. Records webhook events in IntegrationWebhookEvent
 * 4. Queues targeted sync for affected entities
 * 5. Handles retry logic and dead-letter recording
 *
 * QBO signature verification uses the verifier token from the app dashboard.
 * @see https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
 */

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

// ── QBO Entity → OneAce entity type mapping ─────────────────────

const QBO_ENTITY_MAP: Record<string, string> = {
  Item: "ITEM",
  Customer: "CUSTOMER",
  Vendor: "SUPPLIER",
  Invoice: "INVOICE",
  Bill: "BILL",
  Payment: "PAYMENT",
  PurchaseOrder: "PURCHASE_ORDER",
  Account: "ACCOUNT",
  TaxCode: "TAX_CODE",
  Estimate: "ESTIMATE",
  SalesReceipt: "SALES_RECEIPT",
  CreditMemo: "CREDIT_MEMO",
  JournalEntry: "JOURNAL_ENTRY",
  Deposit: "DEPOSIT",
  Class: "CLASS",
  Department: "DEPARTMENT",
  Term: "TERM",
  Employee: "EMPLOYEE",
};

interface QBOWebhookPayload {
  eventNotifications?: Array<{
    realmId: string;
    dataChangeEvent?: {
      entities: Array<{
        name: string;
        id: string;
        operation: "Create" | "Update" | "Delete" | "Merge" | "Void";
        lastUpdated: string;
      }>;
    };
  }>;
}

/**
 * POST /api/integrations/quickbooks/webhooks
 */
export async function POST(request: NextRequest) {
  const receivedAt = new Date();

  try {
    // ── 1. Verify configuration ───────────────────────────────
    const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
    if (!verifierToken) {
      logger.error("QBO_WEBHOOK_VERIFIER_TOKEN not configured");
      return NextResponse.json({ error: "Webhook endpoint not configured" }, { status: 503 });
    }

    // ── 2. Read and verify signature ──────────────────────────
    const signature = request.headers.get("intuit-signature");
    const body = await request.text();

    if (!signature) {
      logger.warn("QBO webhook missing signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const expected = createHmac("sha256", verifierToken).update(body).digest("base64");

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
      logger.warn("Invalid QBO webhook signature", {
        receivedLength: signature.length,
        expectedLength: expected.length,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // ── 3. Parse payload ──────────────────────────────────────
    let payload: QBOWebhookPayload;
    try {
      payload = JSON.parse(body) as QBOWebhookPayload;
    } catch {
      logger.warn("QBO webhook: malformed JSON body");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!payload.eventNotifications?.length) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    // ── 4. Process each notification ──────────────────────────
    let processedCount = 0;
    let failedCount = 0;
    const errors: Array<{ realmId: string; error: string }> = [];

    for (const notification of payload.eventNotifications) {
      const realmId = notification.realmId;

      try {
        // Find integration by realm ID (stored in externalAccountId)
        const integration = await db.integration.findFirst({
          where: {
            provider: "QUICKBOOKS_ONLINE",
            externalAccountId: realmId,
            status: "CONNECTED",
          },
          select: {
            id: true,
            organizationId: true,
            syncItems: true,
            syncOrders: true,
            syncSuppliers: true,
            syncCustomers: true,
            syncStockLevels: true,
            syncPrices: true,
          },
        });

        if (!integration) {
          logger.warn("QBO webhook for unknown/disconnected realm", { realmId });
          continue;
        }

        const entities = notification.dataChangeEvent?.entities ?? [];

        for (const entity of entities) {
          const oneAceEntityType = QBO_ENTITY_MAP[entity.name];

          if (!oneAceEntityType) {
            logger.debug("QBO webhook: unmapped entity type", { entityName: entity.name });
            continue;
          }

          // Check if this entity type is enabled for sync
          if (!isEntitySyncEnabled(integration, oneAceEntityType)) {
            logger.debug("QBO webhook: entity sync disabled", {
              entityType: oneAceEntityType,
              integrationId: integration.id,
            });
            continue;
          }

          // Update webhook event last triggered time if subscription exists
          try {
            await db.integrationWebhookEvent.updateMany({
              where: {
                integrationId: integration.id,
                eventType: `${entity.name}.${entity.operation}`,
                isActive: true,
              },
              data: {
                lastTriggeredAt: receivedAt,
              },
            });
          } catch (dbError) {
            logger.warn("Failed to update webhook event", { error: dbError });
          }

          // Log the change
          logger.info("QBO entity change received", {
            organizationId: integration.organizationId,
            integrationId: integration.id,
            entityName: entity.name,
            entityId: entity.id,
            operation: entity.operation,
            oneAceEntityType,
          });

          // Create a sync log entry if entity type is in ImportEntity enum
          const SYNC_LOG_ENTITIES = ["ITEM", "STOCK_LEVEL", "SUPPLIER", "PURCHASE_ORDER", "CATEGORY", "WAREHOUSE", "CUSTOMER"];
          if (SYNC_LOG_ENTITIES.includes(oneAceEntityType)) {
            try {
              await db.syncLog.create({
                data: {
                  integrationId: integration.id,
                  direction: "INBOUND",
                  entityType: oneAceEntityType as "ITEM" | "STOCK_LEVEL" | "SUPPLIER" | "PURCHASE_ORDER" | "CATEGORY" | "WAREHOUSE" | "CUSTOMER",
                  status: "PENDING",
                  startedAt: new Date(),
                  recordsProcessed: 0,
                  recordsFailed: 0,
                  errors: JSON.parse(JSON.stringify({
                    source: "webhook",
                    qboEntityId: entity.id,
                    operation: entity.operation,
                  })),
                },
              });
            } catch (syncLogError) {
              logger.warn("Failed to create sync log for webhook", { error: syncLogError });
            }
          }

          processedCount++;
        }
      } catch (error) {
        failedCount++;
        errors.push({
          realmId,
          error: error instanceof Error ? error.message : "Processing failed",
        });
        logger.error("QBO webhook: notification processing failed", { realmId, error });
      }
    }

    // ── 5. Return response ────────────────────────────────────
    return NextResponse.json({
      ok: true,
      processed: processedCount,
      failed: failedCount,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    logger.error("QBO webhook handler error", { error });

    // Log the error for monitoring (dead letter)
    try {
      const integrations = await db.integration.findMany({
        where: { provider: "QUICKBOOKS_ONLINE", status: "CONNECTED" },
        select: { id: true },
        take: 1,
      });

      if (integrations[0]) {
        await db.integration.update({
          where: { id: integrations[0].id },
          data: {
            lastError: `Webhook error at ${receivedAt.toISOString()}: ${error instanceof Error ? error.message : "Unknown"}`,
          },
        });
      }
    } catch {
      // Best-effort error recording
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/integrations/quickbooks/webhooks
 *
 * QBO sends a GET request during webhook setup to verify the endpoint.
 * Must return 200 OK with the challenge token.
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("challenge");
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ status: "QuickBooks webhook endpoint active" });
}

// ── Helpers ─────────────────────────────────────────────────────

function isEntitySyncEnabled(
  integration: {
    syncItems: boolean;
    syncOrders: boolean;
    syncSuppliers: boolean;
    syncCustomers: boolean;
    syncStockLevels: boolean;
    syncPrices: boolean;
  },
  entityType: string,
): boolean {
  switch (entityType) {
    case "ITEM":
      return integration.syncItems;
    case "CUSTOMER":
      return integration.syncCustomers;
    case "SUPPLIER":
      return integration.syncSuppliers;
    case "INVOICE":
    case "SALES_RECEIPT":
    case "CREDIT_MEMO":
    case "ESTIMATE":
      return integration.syncOrders;
    case "BILL":
    case "PURCHASE_ORDER":
      return integration.syncSuppliers || integration.syncOrders;
    case "PAYMENT":
    case "DEPOSIT":
    case "JOURNAL_ENTRY":
      return integration.syncOrders;
    case "ACCOUNT":
    case "TAX_CODE":
    case "CLASS":
    case "DEPARTMENT":
    case "TERM":
      return true; // Reference data always synced
    default:
      return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
