"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { canApprove, canReject, canSubmitForApproval } from "@/lib/stockcount/machine";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  type ApproveCountInput,
  type RejectCountInput,
  type SubmitForApprovalInput,
  approveCountSchema,
  rejectCountSchema,
  submitForApprovalSchema,
} from "@/lib/validation/count-approval";

/**
 * Submit a count for approval. Transitions IN_PROGRESS → PENDING_APPROVAL.
 */
export async function submitForApprovalAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "stockCounts.submitForApproval")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = submitForApprovalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { countId, comment } = parsed.data;
  const orgId = membership.organizationId;

  // Fetch count
  const count = await db.stockCount.findFirst({
    where: { id: countId, organizationId: orgId },
    select: { id: true, state: true },
  });

  if (!count) {
    return { ok: false, error: "Stock count not found" };
  }

  if (!canSubmitForApproval(count.state as any)) {
    return { ok: false, error: "Count not eligible for approval submission" };
  }

  try {
    // Create or update approval record
    const approval = await db.countApproval.upsert({
      where: { countId },
      create: {
        organizationId: orgId,
        countId,
        requestedById: session.user.id,
        comment,
      },
      update: {
        status: "PENDING",
        comment,
        requestedById: session.user.id,
        requestedAt: new Date(),
      },
      select: { id: true },
    });

    // Update count state
    await db.stockCount.update({
      where: { id: countId },
      data: { state: "PENDING_APPROVAL" },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_count.submitted_for_approval",
      entityType: "count_approval",
      entityId: approval.id,
      metadata: { countId, comment },
    });

    revalidatePath(`/stock-counts/${countId}`);
    revalidatePath("/stock-counts/pending-approvals");
    return { ok: true, id: countId };
  } catch (err) {
    console.error("submitForApprovalAction failed:", err);
    return { ok: false, error: "Failed to submit for approval" };
  }
}

/**
 * Approve a pending count. Transitions PENDING_APPROVAL → APPROVED.
 */
export async function approveCountAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "stockCounts.approve")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = approveCountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { countId, comment } = parsed.data;
  const orgId = membership.organizationId;

  // Fetch count and approval
  const count = await db.stockCount.findFirst({
    where: { id: countId, organizationId: orgId },
    select: { id: true, state: true },
  });

  if (!count) {
    return { ok: false, error: "Stock count not found" };
  }

  if (!canApprove(count.state as any)) {
    return { ok: false, error: "Count not pending approval" };
  }

  try {
    // Update approval
    const approval = await db.countApproval.update({
      where: { countId },
      data: {
        status: "APPROVED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        comment,
      },
      select: { id: true },
    });

    // Update count state
    await db.stockCount.update({
      where: { id: countId },
      data: { state: "APPROVED" },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_count.approved",
      entityType: "count_approval",
      entityId: approval.id,
      metadata: { countId, comment },
    });

    revalidatePath(`/stock-counts/${countId}`);
    revalidatePath("/stock-counts/pending-approvals");
    return { ok: true, id: countId };
  } catch (err) {
    console.error("approveCountAction failed:", err);
    return { ok: false, error: "Failed to approve count" };
  }
}

/**
 * Reject a pending count. Transitions PENDING_APPROVAL → IN_PROGRESS.
 */
export async function rejectCountAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "stockCounts.reject")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = rejectCountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { countId, comment } = parsed.data;
  const orgId = membership.organizationId;

  // Fetch count and approval
  const count = await db.stockCount.findFirst({
    where: { id: countId, organizationId: orgId },
    select: { id: true, state: true },
  });

  if (!count) {
    return { ok: false, error: "Stock count not found" };
  }

  if (!canReject(count.state as any)) {
    return { ok: false, error: "Count not pending approval" };
  }

  try {
    // Update approval
    const approval = await db.countApproval.update({
      where: { countId },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        comment,
      },
      select: { id: true },
    });

    // Update count state back to IN_PROGRESS
    await db.stockCount.update({
      where: { id: countId },
      data: { state: "IN_PROGRESS" },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_count.rejected",
      entityType: "count_approval",
      entityId: approval.id,
      metadata: { countId, comment },
    });

    revalidatePath(`/stock-counts/${countId}`);
    revalidatePath("/stock-counts/pending-approvals");
    return { ok: true, id: countId };
  } catch (err) {
    console.error("rejectCountAction failed:", err);
    return { ok: false, error: "Failed to reject count" };
  }
}
