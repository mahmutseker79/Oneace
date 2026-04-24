/**
 * Audit v1.3 §5.53 F-09 — Custom Webhook dispatch registrations.
 *
 * Phase-3.2 C wave. See `../amazon/register.ts` for the shared
 * pending-execution rationale. Task-kind set is the minimal trio
 * the CustomWebhookSyncEngine dispatches today ("Item" |
 * "SalesOrder" | "StockLevel").
 *
 * Custom-webhook integrations are intentionally free-form; the
 * pending marker here closes the SCHEMA_UNWIRED silent-loop even
 * though per-tenant URL + auth wiring is still pending.
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const CUSTOM_WEBHOOK_TASK_KINDS = ["sync_items", "sync_orders", "sync_stock"] as const;

export type CustomWebhookTaskKind = (typeof CUSTOM_WEBHOOK_TASK_KINDS)[number];

async function runCustomWebhookSync(task: ClaimedTask, kind: CustomWebhookTaskKind): Promise<void> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "CUSTOM_WEBHOOK",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `Custom Webhook integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_CUSTOM_WEBHOOK_INTEGRATION_NOT_FOUND";
    throw err;
  }

  const err = new Error(
    `Custom Webhook adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb per-tenant URL + HMAC signer`,
  );
  (err as { code?: string }).code = "TRANSPORT_CUSTOM_WEBHOOK_EXECUTION_PENDING";
  throw err;
}

for (const kind of CUSTOM_WEBHOOK_TASK_KINDS) {
  registerHandler("custom-webhook", kind, (task) => runCustomWebhookSync(task, kind));
}
