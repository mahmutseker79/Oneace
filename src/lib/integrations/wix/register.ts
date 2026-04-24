/**
 * Audit v1.3 §5.53 F-09 — Wix dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set derived from the
 * WixSyncEngine's entityType switch ("Item" | "SalesOrder"
 * | "StockLevel" | "Contact").
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const WIX_TASK_KINDS = [
  "sync_products",
  "sync_orders",
  "sync_inventory",
  "sync_contacts",
] as const;

export type WixTaskKind = (typeof WIX_TASK_KINDS)[number];

async function runWixSync(task: ClaimedTask, kind: WixTaskKind): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "WIX",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `Wix integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_WIX_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `Wix adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb Wix Headless API client construction`,
  );
  (err as { code?: string }).code = "TRANSPORT_WIX_EXECUTION_PENDING";
  throw err;
}

for (const kind of WIX_TASK_KINDS) {
  registerHandler("wix", kind, (task) => runWixSync(task, kind));
}
