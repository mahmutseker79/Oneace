"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { canRollback, rollbackDenialReason } from "@/lib/stockcount/machine";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import { rollbackCountSchema } from "@/lib/validation/count-approval";

/**
 * P0-4 remediation (audit v1.0): rollback is currently refused for every
 * state. The previous implementation silently flipped state to
 * ROLLED_BACK without reversing the posted movements — the ledger and
 * the inventory then diverged for that count's adjustments, which is
 * the opposite of what "rollback" should mean.
 *
 * This action intentionally remains deployed (rather than being
 * deleted) so links, tests, and the capability helper stay coherent.
 * Every call returns an ActionResult error with a specific code:
 *
 *   CANNOT_ROLLBACK_POST_POSTED  — COMPLETED / APPROVED states,
 *                                  requires reversing-movement impl
 *   CANNOT_ROLLBACK_TERMINAL     — already ROLLED_BACK / CANCELLED /
 *                                  REJECTED
 *   CANNOT_ROLLBACK_PRE_POST     — use CANCEL / REJECT instead
 *
 * When a true inverse-movement implementation is added, the fix is
 * to (1) relax `canRollback` in machine.ts, (2) re-enable the
 * COMPLETED → ROLLED_BACK transition in `canTransition`, and (3)
 * wrap the state change + inverse movements in a single
 * `db.$transaction(...)` below the permission check.
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
    // P0-4: do NOT flip state or pretend we rolled back. Record the
    // attempt for audit (useful when diagnosing why a user thought they
    // rolled something back) and return a machine-readable code so the
    // client can show a specific message / link to the right workflow.
    const code = rollbackDenialReason(count.state as typeof count.state);
    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_count.rollback_refused",
      entityType: "stock_count",
      entityId: countId,
      metadata: { reason, state: count.state, code },
    });
    const humanMessage =
      code === "CANNOT_ROLLBACK_POST_POSTED"
        ? "Rollback is temporarily unavailable for completed counts — the " +
          "inverse-movement step is not implemented. Contact support to " +
          "manually reverse this count's adjustments."
        : code === "CANNOT_ROLLBACK_TERMINAL"
          ? "This count is already in a terminal state and cannot be " +
            "rolled back."
          : "This count has not posted any stock movements yet — cancel " +
            "or reject it instead of rolling back.";
    return { ok: false, error: humanMessage, code };
  }

  // Unreachable under current policy. Kept here so the real
  // implementation has a landing spot — wrap the state change and the
  // inverse-movement creation in a single db.$transaction when added.
  try {
    await db.stockCount.update({
      where: { id: countId },
      data: { state: "ROLLED_BACK" },
    });

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
