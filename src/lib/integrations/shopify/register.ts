/**
 * Audit v1.3 §5.53 F-09 — Shopify handler registrations (B-1 pilot).
 *
 * Binds Shopify task kinds to the dispatch registry. First of the
 * 15 adapters; the shape here is what `docs/ADR-005-integration-
 * handler-registry.md` calls the "canonical adapter register.ts".
 *
 * Side-effect module. Importing it calls `registerHandler(...)` at
 * module top-level; `src/lib/integrations/handlers/index.ts`
 * imports this file so the cron drain loop sees the registrations
 * before the first task is claimed.
 *
 * Why a thin `runShopifySync` wrapper instead of calling
 * `engine.sync()` directly from each `registerHandler` closure:
 *
 *   - Every handler needs the same integration look-up + credential
 *     unpack + error-code stamping boilerplate. Duplicating that
 *     four times is four places to miss when the credential shape
 *     changes.
 *   - When we add B-2 QuickBooks, it will do the exact same shape
 *     with a different provider. The future refactor is to pull
 *     `runSyncEngineTask` into the adapter base; keeping this
 *     function small now makes that diff obvious.
 */

import { db } from "@/lib/db";
import type { OAuthToken } from "../base-client";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";
import { ShopifyClient } from "./shopify-client";
import { ShopifySyncEngine } from "./shopify-sync";

/**
 * The canonical task kinds this adapter answers to. Exported so
 * the pinned test can assert the set hasn't silently changed —
 * the webhook route's topic → taskKind map depends on these
 * exact strings.
 */
export const SHOPIFY_TASK_KINDS = [
  "sync_products",
  "sync_orders",
  "sync_inventory",
  "sync_customers",
] as const;

export type ShopifyTaskKind = (typeof SHOPIFY_TASK_KINDS)[number];

/** Maps `taskKind` → `SyncContext.entityType`. */
const ENTITY_TYPE_BY_TASK: Record<ShopifyTaskKind, "PRODUCT" | "ORDER" | "INVENTORY" | "CUSTOMER"> =
  {
    sync_products: "PRODUCT",
    sync_orders: "ORDER",
    sync_inventory: "INVENTORY",
    sync_customers: "CUSTOMER",
  };

/**
 * Execute one Shopify sync invocation for `task`. Throws with a
 * tagged `code` on every failure — the queue layer's retry machine
 * depends on the throw. No try/catch absorbs here; that was the
 * F-09 failure mode.
 *
 * Error-code convention (must match `classifyError` in
 * `task-queue.ts`):
 *
 *   SCHEMA_INTEGRATION_NOT_FOUND        → schema-mismatch
 *   AUTH_SHOPIFY_MISSING_CREDENTIALS    → auth
 *   TRANSPORT_SHOPIFY_SYNC_FAILED       → transport
 *
 * Handlers NEVER enqueue follow-up retries — the queue does that.
 */
async function runShopifySync(task: ClaimedTask, kind: ShopifyTaskKind): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "SHOPIFY",
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
      `Shopify integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_INTEGRATION_NOT_FOUND";
    throw err;
  }

  if (!integration.credentials || !integration.externalAccountId) {
    const err = new Error(
      `Shopify integration id="${integration.id}" missing credentials or shop domain`,
    );
    (err as { code?: string }).code = "AUTH_SHOPIFY_MISSING_CREDENTIALS";
    throw err;
  }

  // `credentials` is a Prisma Json field; the adapter stores it as
  // an OAuthToken on connect. Cast is safe at runtime — if the
  // shape drifts, the underlying fetch call in `shopify-client`
  // will surface `AUTH_*` on its next refresh.
  const credentials = integration.credentials as unknown as OAuthToken;
  const client = new ShopifyClient(credentials, integration.externalAccountId);
  const engine = new ShopifySyncEngine(client);

  const result = await engine.sync({
    organizationId: task.organizationId,
    integrationId: integration.id,
    provider: "SHOPIFY",
    // Every pilot task is inbound from Shopify. Outbound sync
    // (push-to-Shopify) is a separate taskKind family reserved for
    // a follow-up PR — the current ShopifySyncEngine's outbound
    // path is stub-heavy and not production-ready.
    direction: "INBOUND",
    entityType: ENTITY_TYPE_BY_TASK[kind],
  });

  if (!result.success) {
    const firstError = result.errors[0]?.error ?? "Shopify sync returned success=false";
    const err = new Error(firstError);
    (err as { code?: string }).code = "TRANSPORT_SHOPIFY_SYNC_FAILED";
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// Registrations — side effect at module import time.
// ─────────────────────────────────────────────────────────────────

for (const kind of SHOPIFY_TASK_KINDS) {
  registerHandler("shopify", kind, (task) => runShopifySync(task, kind));
}
