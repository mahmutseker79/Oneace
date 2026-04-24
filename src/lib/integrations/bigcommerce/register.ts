/**
 * Audit v1.3 §5.53 F-09 — BigCommerce dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set derived from the
 * BigCommerceSyncEngine's entityType switch ("Item" | "SalesOrder"
 * | "StockLevel").
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const BIGCOMMERCE_TASK_KINDS = [
  "sync_items",
  "sync_sales_orders",
  "sync_stock_levels",
] as const;

export type BigCommerceTaskKind = (typeof BIGCOMMERCE_TASK_KINDS)[number];

async function runBigCommerceSync(task: ClaimedTask, kind: BigCommerceTaskKind): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "BIGCOMMERCE",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `BigCommerce integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_BIGCOMMERCE_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `BigCommerce adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb v3 API client construction`,
  );
  (err as { code?: string }).code = "TRANSPORT_BIGCOMMERCE_EXECUTION_PENDING";
  throw err;
}

for (const kind of BIGCOMMERCE_TASK_KINDS) {
  registerHandler("bigcommerce", kind, (task) => runBigCommerceSync(task, kind));
}
