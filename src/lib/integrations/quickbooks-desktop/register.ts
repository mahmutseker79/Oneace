/**
 * Audit v1.3 §5.53 F-09 — QuickBooks Desktop dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set derived from the
 * QuickBooksDesktopSyncEngine's entityType switch across items,
 * customers, vendors, invoices, bills, purchase orders, and payments.
 *
 * Note: the `quickbooks` integrationKind is QuickBooks Online
 * (see ../quickbooks/register.ts); this module handles the
 * QBXML/Web Connector-backed Desktop product separately so
 * classifier buckets can distinguish transport failures.
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const QUICKBOOKS_DESKTOP_TASK_KINDS = [
  "sync_items",
  "sync_customers",
  "sync_vendors",
  "sync_invoices",
  "sync_bills",
  "sync_purchase_orders",
  "sync_payments",
] as const;

export type QuickBooksDesktopTaskKind =
  (typeof QUICKBOOKS_DESKTOP_TASK_KINDS)[number];

async function runQuickBooksDesktopSync(
  task: ClaimedTask,
  kind: QuickBooksDesktopTaskKind,
): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "QUICKBOOKS_DESKTOP",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `QuickBooks Desktop integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code =
      "SCHEMA_QUICKBOOKS_DESKTOP_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `QuickBooks Desktop adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb Web Connector / QBXML session bridge`,
  );
  (err as { code?: string }).code =
    "TRANSPORT_QUICKBOOKS_DESKTOP_EXECUTION_PENDING";
  throw err;
}

for (const kind of QUICKBOOKS_DESKTOP_TASK_KINDS) {
  registerHandler("quickbooks-desktop", kind, (task) =>
    runQuickBooksDesktopSync(task, kind),
  );
}
