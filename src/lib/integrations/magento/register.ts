/**
 * Audit v1.3 §5.53 F-09 — Magento dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set derived from the
 * MagentoSyncEngine's entityType switch.
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const MAGENTO_TASK_KINDS = [
  "sync_items",
  "sync_sales_orders",
  "sync_stock_levels",
] as const;

export type MagentoTaskKind = (typeof MAGENTO_TASK_KINDS)[number];

async function runMagentoSync(
  task: ClaimedTask,
  kind: MagentoTaskKind,
): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "MAGENTO",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `Magento integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_MAGENTO_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `Magento adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb REST client construction`,
  );
  (err as { code?: string }).code = "TRANSPORT_MAGENTO_EXECUTION_PENDING";
  throw err;
}

for (const kind of MAGENTO_TASK_KINDS) {
  registerHandler("magento", kind, (task) => runMagentoSync(task, kind));
}
