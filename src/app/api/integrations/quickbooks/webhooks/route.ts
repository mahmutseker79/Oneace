/**
 * @openapi-tag: /integrations/quickbooks/webhooks
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
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

import { createHash, createHmac } from "node:crypto";
import { db } from "@/lib/db";
// Audit v1.3 §5.53 F-09 B-2: QBO webhooks now enqueue into the
// durable IntegrationTask queue. The cron drain loop is the retry
// authority — the webhook used to only write a SyncLog PENDING
// breadcrumb that no consumer ever flipped to RUNNING. That
// breadcrumb is retained for UI compat (dashboards at
// `integrations/[slug]` read recent SyncLog rows) and runs in
// parallel with enqueue; the QBOSyncEngine will write its own
// SyncLog for the actual drain attempt. See
// `docs/ADR-005-integration-handler-registry.md`.
import { enqueue } from "@/lib/integrations/task-queue";
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

    // ── 2.5 Delivery dedup — P1-02 ────────────────────────────
    //
    // Intuit retries on any non-2xx response AND occasionally on
    // 2xx; without dedup the same payload was reprocessed N times,
    // double-applying every entity update. Key derivation: QBO does
    // not supply a stable per-delivery header, but retries carry the
    // exact same body + signature — so sha256(body) is a stable,
    // collision-resistant delivery id. The (provider, externalId)
    // unique index on WebhookDeliveryEvent turns the retry into a
    // P2002 we intercept and ack with 200 deduped.
    //
    // The insert happens BEFORE we parse or enqueue, so a retry of
    // a malformed body still deduplicates. The row's organizationId
    // is left NULL here (we don't know the realm until we parse);
    // the row is still a useful retry-blocker for that payload.
    const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
    try {
      await db.webhookDeliveryEvent.create({
        data: {
          provider: "quickbooks",
          externalId: bodyHash,
          bodyHash,
          eventType: "qbo.eventNotifications",
        },
      });
    } catch (dedupErr) {
      // P2002 = duplicate delivery. Ack 200 so Intuit stops
      // retrying; log at info level because this is a healthy
      // steady-state signal (retries happen) not an alert.
      if (
        typeof dedupErr === "object" &&
        dedupErr !== null &&
        (dedupErr as { code?: unknown }).code === "P2002"
      ) {
        logger.info("Duplicate QBO webhook ignored (P1-02 dedup)", {
          bodyHashPrefix: bodyHash.slice(0, 12),
        });
        return NextResponse.json({ ok: true, deduped: true });
      }
      // Any other DB error: log and keep going — the dedup table
      // is best-effort; we prefer to process than to bounce a
      // delivery because of an infrastructure hiccup.
      logger.warn("QBO webhook dedup insert failed — proceeding without guard", {
        error: dedupErr,
      });
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
          const SYNC_LOG_ENTITIES = [
            "ITEM",
            "STOCK_LEVEL",
            "SUPPLIER",
            "PURCHASE_ORDER",
            "CATEGORY",
            "WAREHOUSE",
            "CUSTOMER",
          ];
          if (SYNC_LOG_ENTITIES.includes(oneAceEntityType)) {
            try {
              await db.syncLog.create({
                data: {
                  integrationId: integration.id,
                  direction: "INBOUND",
                  entityType: oneAceEntityType as
                    | "ITEM"
                    | "STOCK_LEVEL"
                    | "SUPPLIER"
                    | "PURCHASE_ORDER"
                    | "CATEGORY"
                    | "WAREHOUSE"
                    | "CUSTOMER",
                  status: "PENDING",
                  startedAt: new Date(),
                  recordsProcessed: 0,
                  recordsFailed: 0,
                  errors: JSON.parse(
                    JSON.stringify({
                      source: "webhook",
                      qboEntityId: entity.id,
                      operation: entity.operation,
                    }),
                  ),
                },
              });
            } catch (syncLogError) {
              logger.warn("Failed to create sync log for webhook", { error: syncLogError });
            }
          }

          // Audit v1.3 §5.53 F-09 B-2: enqueue a durable task so the
          // cron drain actually runs the sync. Entities without a
          // pilot taskKind (Class, Department, Term, Employee) still
          // fall through to log-only — they're reference data that
          // QBOSyncEngine doesn't cover yet. See
          // `src/lib/integrations/quickbooks/register.ts`.
          const taskKind = qboEntityToTaskKind(entity.name);
          if (taskKind) {
            try {
              await enqueue({
                organizationId: integration.organizationId,
                integrationKind: "quickbooks",
                taskKind,
                payload: {
                  qboEntityName: entity.name,
                  qboEntityId: entity.id,
                  operation: entity.operation,
                  realmId,
                },
              });
            } catch (enqueueErr) {
              // Queue write failure must not swallow the webhook ACK —
              // Shopify would retry the delivery on non-2xx and we
              // already wrote the breadcrumb. Log loudly; DLQ covers
              // the retry authority once the queue row lands.
              logger.error("QBO webhook: enqueue failed", {
                enqueueErr,
                integrationId: integration.id,
                taskKind,
              });
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

/**
 * Audit v1.3 §5.53 F-09 B-2: QBO entity name → IntegrationTask
 * taskKind. Must stay aligned with `QBO_TASK_KINDS` exported from
 * `src/lib/integrations/quickbooks/register.ts` — the pinned test
 * in `task-dispatch-registry.test.ts` asserts every taskKind in
 * the register loop has a reverse mapping here.
 *
 * Returns null for entity names that don't have a pilot handler.
 * Class, Department, Term, Employee are currently log-only — they
 * are QBO reference tables without a corresponding sync path in
 * `QBOSyncEngine.ALL_SYNC_ENTITIES`.
 */
function qboEntityToTaskKind(entityName: string): string | null {
  switch (entityName) {
    case "Item":
      return "sync_items";
    case "Customer":
      return "sync_customers";
    case "Vendor":
      return "sync_suppliers";
    case "Invoice":
      return "sync_invoices";
    case "Bill":
      return "sync_bills";
    case "Payment":
      return "sync_payments";
    case "PurchaseOrder":
      return "sync_purchase_orders";
    case "Account":
      return "sync_accounts";
    case "TaxCode":
      return "sync_tax_codes";
    case "Estimate":
      return "sync_estimates";
    case "SalesReceipt":
      return "sync_sales_receipts";
    case "CreditMemo":
      return "sync_credit_memos";
    case "JournalEntry":
      return "sync_journal_entries";
    case "Deposit":
      return "sync_deposits";
    default:
      return null;
  }
}
