/**
 * Audit v1.3 §5.53 F-09 B-2 — QuickBooks Online handler registrations.
 *
 * Second adapter wired to the dispatch registry (B-1 Shopify shipped
 * in v1.5.24 at commit fa6f6bf). The shape mirrors
 * `../shopify/register.ts` deliberately — ADR-005 §4 calls this the
 * "canonical adapter register.ts" pattern, and divergence here is
 * what every future adapter PR will copy. Two things that ARE
 * different from Shopify, documented inline:
 *
 *   1. **OAuth refresh contract.** Shopify access tokens are long-
 *      lived; QBO's are 60-minute access tokens backed by a 100-day
 *      refresh token. The base `IntegrationClient` auto-refreshes
 *      access tokens on expiry, but when the REFRESH token itself
 *      expires (user revoked access, 100-day idle), the refresh
 *      call returns `invalid_grant` and the integration is
 *      irrecoverably dead until the user reconnects. This register
 *      catches that marker and stamps `AUTH_QB_TOKEN_EXPIRED` so
 *      the queue's `classifyError` routes it to the `auth` bucket.
 *      The backoff curve will keep retrying pointlessly until
 *      MAX_RETRIES, at which point the row dead-letters and the
 *      owner is emailed — which is the correct signal to
 *      reconnect. (Short-circuiting earlier is a follow-up; for
 *      now we let the normal lifecycle run.)
 *
 *   2. **14 task kinds, not 4.** Shopify's pilot shipped 4
 *      (products/orders/inventory/customers). QBO covers 14 ERP
 *      entity types (invoices, bills, payments, journal entries,
 *      accounts, tax codes, deposits, …) because its sync engine
 *      already handles all 14. Registering fewer would create a
 *      "half-wired" state where some webhooks enqueue and some
 *      don't — worse than the log-only baseline. The single shared
 *      `runQboSync` wrapper keeps the registration loop one line.
 *
 * Side-effect module. Importing it calls `registerHandler(...)` at
 * module top-level; `src/lib/integrations/handlers/index.ts`
 * imports this file so the cron drain loop sees the registrations
 * before the first task is claimed.
 */

import { db } from "@/lib/db";
import type { OAuthToken } from "../base-client";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";
import { QBOClient } from "./qbo-client";
import type { QBOSyncEntityType } from "./qbo-sync";
import { QBOSyncEngine } from "./qbo-sync";

/**
 * The canonical task kinds this adapter answers to. Exported so
 * the pinned test can assert the set hasn't silently changed —
 * the webhook route's QBO-entity → taskKind map (see
 * `quickbooks/webhooks/route.ts`) depends on these exact strings.
 */
export const QBO_TASK_KINDS = [
  "sync_items",
  "sync_customers",
  "sync_suppliers",
  "sync_invoices",
  "sync_bills",
  "sync_payments",
  "sync_purchase_orders",
  "sync_accounts",
  "sync_tax_codes",
  "sync_estimates",
  "sync_sales_receipts",
  "sync_credit_memos",
  "sync_journal_entries",
  "sync_deposits",
] as const;

export type QboTaskKind = (typeof QBO_TASK_KINDS)[number];

/**
 * Maps `taskKind` → `SyncContext.entityType` the QBO sync engine
 * switches on. Keep in lockstep with `QBO_TASK_KINDS` above; the
 * pinned test asserts both the length and the pairing.
 */
const ENTITY_TYPE_BY_TASK: Record<QboTaskKind, QBOSyncEntityType> = {
  sync_items: "ITEM",
  sync_customers: "CUSTOMER",
  sync_suppliers: "SUPPLIER",
  sync_invoices: "INVOICE",
  sync_bills: "BILL",
  sync_payments: "PAYMENT",
  sync_purchase_orders: "PURCHASE_ORDER",
  sync_accounts: "ACCOUNT",
  sync_tax_codes: "TAX_CODE",
  sync_estimates: "ESTIMATE",
  sync_sales_receipts: "SALES_RECEIPT",
  sync_credit_memos: "CREDIT_MEMO",
  sync_journal_entries: "JOURNAL_ENTRY",
  sync_deposits: "DEPOSIT",
};

/**
 * QBO refresh-token-expired markers. Intuit returns `invalid_grant`
 * in the OAuth2 error body when the refresh token itself is dead
 * (user revoked access in Intuit admin, or the 100-day idle window
 * lapsed). We also catch the lower-level "refresh" substring so a
 * custom wrapper in `base-client` that surfaces the condition with
 * different wording still lands in the right bucket.
 *
 * Matching on `message` is a pragmatic choice — the typed QBO OAuth
 * error class isn't plumbed through `IntegrationClient.refresh()`
 * today. When the typed class lands (follow-up), delete this
 * heuristic and `instanceof` it.
 */
const QBO_REFRESH_EXPIRED_MARKERS = ["invalid_grant", "refresh_token_expired", "Refresh token has expired"];

function looksLikeRefreshExpired(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return QBO_REFRESH_EXPIRED_MARKERS.some((m) => msg.includes(m));
}

/**
 * Execute one QBO sync invocation for `task`. Throws with a tagged
 * `code` on every failure — the queue layer's retry machine depends
 * on the throw. No try/catch absorbs here; that was the F-09 failure
 * mode B-1 closed and B-2 must not reintroduce.
 *
 * Error-code convention (must match `classifyError` in
 * `task-queue.ts`):
 *
 *   SCHEMA_QB_INTEGRATION_NOT_FOUND   → schema-mismatch
 *   AUTH_QB_MISSING_CREDENTIALS       → auth
 *   AUTH_QB_TOKEN_EXPIRED             → auth
 *   TRANSPORT_QB_SYNC_FAILED          → transport
 *
 * Handlers NEVER enqueue follow-up retries — the queue does that.
 */
async function runQboSync(task: ClaimedTask, kind: QboTaskKind): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "QUICKBOOKS_ONLINE",
      status: "CONNECTED",
    },
    select: {
      id: true,
      credentials: true,
      externalAccountId: true,
    },
  });

  if (!integration) {
    const err = new Error(
      `QBO integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_QB_INTEGRATION_NOT_FOUND";
    throw err;
  }

  if (!integration.credentials || !integration.externalAccountId) {
    const err = new Error(
      `QBO integration id="${integration.id}" missing credentials or realmId (externalAccountId)`,
    );
    (err as { code?: string }).code = "AUTH_QB_MISSING_CREDENTIALS";
    throw err;
  }

  // `credentials` is a Prisma Json field; the adapter stores it as
  // an OAuthToken on connect. `externalAccountId` holds the QBO
  // realmId (Intuit company id). Same cast policy as Shopify.
  const credentials = integration.credentials as unknown as OAuthToken;
  const client = new QBOClient(credentials, integration.externalAccountId);
  const engine = new QBOSyncEngine(client);

  try {
    const result = await engine.sync({
      organizationId: task.organizationId,
      integrationId: integration.id,
      provider: "QUICKBOOKS_ONLINE",
      // Pilot is inbound-only to match Shopify B-1. QBOSyncEngine's
      // outbound push path is production-capable but exercising it
      // from the queue is reserved for a follow-up — outbound tasks
      // need a different taskKind family (`push_*`) to avoid
      // mixing directions in a single queue slot.
      direction: "INBOUND",
      entityType: ENTITY_TYPE_BY_TASK[kind],
    });

    if (!result.success) {
      const firstError = result.errors[0]?.error ?? "QBO sync returned success=false";
      const err = new Error(firstError);
      (err as { code?: string }).code = "TRANSPORT_QB_SYNC_FAILED";
      throw err;
    }
  } catch (rawErr) {
    // Refresh-token-expired is a hard auth failure — stamp distinct
    // from TRANSPORT so the DLQ dashboard can highlight "user must
    // reconnect" rows separately from "upstream flapping" rows.
    if (looksLikeRefreshExpired(rawErr)) {
      const err = new Error(
        `QBO refresh token expired for integration id="${integration.id}" — user must reconnect`,
      );
      (err as { code?: string }).code = "AUTH_QB_TOKEN_EXPIRED";
      throw err;
    }
    // Re-throw everything else unchanged — `catch` above only added
    // the refresh classification; TRANSPORT_QB_SYNC_FAILED thrown
    // from the `!result.success` branch still has its code intact.
    throw rawErr;
  }
}

// ─────────────────────────────────────────────────────────────────
// Registrations — side effect at module import time.
// ─────────────────────────────────────────────────────────────────

for (const kind of QBO_TASK_KINDS) {
  registerHandler("quickbooks", kind, (task) => runQboSync(task, kind));
}

// Exported for unit-test access to the refresh-detection heuristic
// without having to force a real OAuth failure through the engine.
export const __internal = { looksLikeRefreshExpired };
