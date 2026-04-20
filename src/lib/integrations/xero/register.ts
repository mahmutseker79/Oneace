/**
 * Audit v1.3 §5.53 F-09 — Xero dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set derived from the
 * XeroSyncEngine's entityType switch across items, suppliers,
 * purchase orders, invoices, bills, payments, credit notes,
 * accounts, tax rates, bank transactions, and manual journals.
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const XERO_TASK_KINDS = [
  "sync_items",
  "sync_suppliers",
  "sync_purchase_orders",
  "sync_invoices",
  "sync_bills",
  "sync_payments",
  "sync_credit_notes",
  "sync_accounts",
  "sync_tax_rates",
  "sync_bank_transactions",
  "sync_manual_journals",
] as const;

export type XeroTaskKind = (typeof XERO_TASK_KINDS)[number];

async function runXeroSync(
  task: ClaimedTask,
  kind: XeroTaskKind,
): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "XERO",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `Xero integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_XERO_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `Xero adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb OAuth2 + tenant-id client construction`,
  );
  (err as { code?: string }).code = "TRANSPORT_XERO_EXECUTION_PENDING";
  throw err;
}

for (const kind of XERO_TASK_KINDS) {
  registerHandler("xero", kind, (task) => runXeroSync(task, kind));
}
