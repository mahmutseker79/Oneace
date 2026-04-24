/**
 * Audit v1.3 §5.53 F-09 — Zoho Inventory dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set derived from the
 * ZohoSyncEngine's entityType switch across items, sales orders,
 * purchase orders, contacts, inventory, invoices, and bills.
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const ZOHO_TASK_KINDS = [
  "sync_items",
  "sync_sales_orders",
  "sync_purchase_orders",
  "sync_contacts",
  "sync_inventory",
  "sync_invoices",
  "sync_bills",
] as const;

export type ZohoTaskKind = (typeof ZOHO_TASK_KINDS)[number];

async function runZohoSync(task: ClaimedTask, kind: ZohoTaskKind): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "ZOHO_INVENTORY",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `Zoho Inventory integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_ZOHO_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `Zoho adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb OAuth2 + data-center-aware client construction`,
  );
  (err as { code?: string }).code = "TRANSPORT_ZOHO_EXECUTION_PENDING";
  throw err;
}

for (const kind of ZOHO_TASK_KINDS) {
  registerHandler("zoho", kind, (task) => runZohoSync(task, kind));
}
