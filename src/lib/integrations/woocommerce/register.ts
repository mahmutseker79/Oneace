/**
 * Audit v1.3 §5.53 F-09 — WooCommerce dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set derived from the
 * WooCommerceSyncEngine's entityType switch ("Item" | "SalesOrder"
 * | "Customer" | "StockLevel").
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const WOOCOMMERCE_TASK_KINDS = [
  "sync_products",
  "sync_orders",
  "sync_customers",
  "sync_stock_levels",
] as const;

export type WooCommerceTaskKind = (typeof WOOCOMMERCE_TASK_KINDS)[number];

async function runWooCommerceSync(
  task: ClaimedTask,
  kind: WooCommerceTaskKind,
): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "WOOCOMMERCE",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `WooCommerce integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_WOOCOMMERCE_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `WooCommerce adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb v3 REST client construction`,
  );
  (err as { code?: string }).code = "TRANSPORT_WOOCOMMERCE_EXECUTION_PENDING";
  throw err;
}

for (const kind of WOOCOMMERCE_TASK_KINDS) {
  registerHandler("woocommerce", kind, (task) => runWooCommerceSync(task, kind));
}
