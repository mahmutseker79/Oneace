/**
 * Audit v1.3 §5.53 F-09 — Odoo dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set derived from the
 * OdooSyncEngine's entityType switch across products, sale/purchase
 * orders, partners, stock, and invoices.
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const ODOO_TASK_KINDS = [
  "sync_products",
  "sync_sale_orders",
  "sync_purchase_orders",
  "sync_partners",
  "sync_stock",
  "sync_invoices",
] as const;

export type OdooTaskKind = (typeof ODOO_TASK_KINDS)[number];

async function runOdooSync(
  task: ClaimedTask,
  kind: OdooTaskKind,
): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "ODOO",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `Odoo integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_ODOO_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `Odoo adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb XML-RPC client construction`,
  );
  (err as { code?: string }).code = "TRANSPORT_ODOO_EXECUTION_PENDING";
  throw err;
}

for (const kind of ODOO_TASK_KINDS) {
  registerHandler("odoo", kind, (task) => runOdooSync(task, kind));
}
