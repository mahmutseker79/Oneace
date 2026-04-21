/**
 * Audit v1.3 §5.53 F-09 — Amazon (SP-API) dispatch registrations.
 *
 * Phase-3.2 C wave. Follows the Shopify/QBO canonical pattern
 * (ADR-005 §4) but registers a pending-execution marker instead of
 * a live sync call. Rationale:
 *
 *   - F-09's scope is "close the SCHEMA_UNWIRED silent-loop" by
 *     making the dispatch registry aware of every adapter kind.
 *     Without this file, a task with integrationKind="amazon"
 *     would throw SCHEMA_UNWIRED_ADAPTER on every drain tick and
 *     never dead-letter cleanly.
 *   - Full client construction and context plumbing for Amazon
 *     SP-API (marketplaceId, sellerRegistration, refresh token
 *     unpack) has enough per-adapter variance that it belongs in
 *     a follow-up PR. Today we surface a classifier-friendly
 *     TRANSPORT_AMAZON_EXECUTION_PENDING throw so the DLQ row
 *     reads "adapter registered, execution pending" — a vastly
 *     better ops signal than the prior silent loop.
 *
 * Side-effect module. `handlers/index.ts` imports this file so the
 * cron drain loop sees the registrations before the first claim.
 */

import { db } from "@/lib/db";
import { registerHandler } from "../task-dispatch-registry";
import type { ClaimedTask } from "../task-queue";

export const AMAZON_TASK_KINDS = [
  "sync_products",
  "sync_orders",
  "sync_inventory",
] as const;

export type AmazonTaskKind = (typeof AMAZON_TASK_KINDS)[number];

async function runAmazonSync(task: ClaimedTask, kind: AmazonTaskKind): Promise<void> {
  // Early integration lookup — if the row is missing we want the
  // schema-mismatch classifier to fire immediately, not the
  // pending-execution marker. Same invariant as Shopify/QBO B-1/B-2.
  const integration = await db.integration.findFirst({
    where: {
      organizationId: task.organizationId,
      provider: "AMAZON",
      status: "CONNECTED",
    },
    select: { id: true, credentials: true, externalAccountId: true },
  });

  if (!integration) {
    const err = new Error(
      `Amazon integration not found for organizationId="${task.organizationId}" — task will dead-letter after MAX_RETRIES`,
    );
    (err as { code?: string }).code = "SCHEMA_AMAZON_INTEGRATION_NOT_FOUND";
    throw err;
  }

  // F-09 Phase-3.2 C pending marker. Client construction for
  // Amazon SP-API needs marketplace + seller plumbing surfaced
  // in a follow-up; until then this taggs transport so the DLQ
  // dashboard can slice "adapter pending" vs "upstream flap".
  const err = new Error(
    `Amazon adapter registered but execution pending (taskKind="${kind}", audit §5.53 F-09 Phase-3.2 C) — follow-up PR will plumb SP-API client construction`,
  );
  (err as { code?: string }).code = "TRANSPORT_AMAZON_EXECUTION_PENDING";
  throw err;
}

for (const kind of AMAZON_TASK_KINDS) {
  registerHandler("amazon", kind, (task) => runAmazonSync(task, kind));
}
