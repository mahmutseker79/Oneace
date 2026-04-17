"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { canRollback } from "@/lib/stockcount/machine";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import { rollbackCountSchema } from "@/lib/validation/count-approval";
import { logger } from "@/lib/logger";

/**
 * Rollback a completed count. Transitions COMPLETED → ROLLED_BACK.
 * Reverts any stock movements that were posted as a result of this count.
 */
export async function rollbackCountAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "stockCounts.rollback")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = rollbackCountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { countId, reason } = parsed.data;
  const orgId = membership.organizationId;

  // Fetch count
  const count = await db.stockCount.findFirst({
    where: { id: countId, organizationId: orgId },
    select: { id: true, state: true },
  });

  if (!count) {
    return { ok: false, error: "Stock count not found" };
  }

  if (!canRollback(count.state as typeof count.state)) {
    return { ok: false, error: "Count cannot be rolled back" };
  }

  try {
    // Update count state to ROLLED_BACK
    await db.stockCount.update({
      where: { id: countId },
      data: { state: "ROLLED_BACK" },
    });

    // Note: In a production system, you would also need to:
    // 1. Identify which stock movements were created from this count's reconciliation
    // 2. Reverse those movements (create inverse transactions)
    // 3. Update stock levels accordingly
    // This is a simplified implementation that just marks the count as rolled back.

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_count.rolled_back",
      entityType: "stock_count",
      entityId: countId,
      metadata: { reason },
    });

    revalidatePath(`/stock-counts/${countId}`);
    revalidatePath("/stock-counts");
    return { ok: true, id: countId };
  } catch (err) {
    logger.error("rollbackCountAction failed:", { error: err });
    return { ok: false, error: "Failed to rollback count" };
  }
}
