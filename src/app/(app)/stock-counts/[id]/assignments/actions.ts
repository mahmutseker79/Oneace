"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import { logger } from "@/lib/logger";
import {
  createAssignmentSchema,
  removeAssignmentSchema,
  updateAssignmentSchema,
} from "@/lib/validation/count-assignment";

/**
 * Create a count assignment.
 */
export async function createAssignmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "countAssignments.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

  // Verify count exists and belongs to org
  const count = await db.stockCount.findFirst({
    where: { id: data.countId, organizationId: orgId },
    select: { id: true },
  });
  if (!count) {
    return {
      ok: false,
      error: "Stock count not found",
      fieldErrors: { countId: ["Stock count not found"] },
    };
  }

  // Verify user exists and belongs to org
  const user = await db.user.findFirst({
    where: { id: data.userId, memberships: { some: { organizationId: orgId } } },
    select: { id: true },
  });
  if (!user) {
    return {
      ok: false,
      error: "User not found",
      fieldErrors: { userId: ["User not found"] },
    };
  }

  // Verify department if provided
  if (data.departmentId) {
    const dept = await db.department.findFirst({
      where: { id: data.departmentId, organizationId: orgId },
      select: { id: true },
    });
    if (!dept) {
      return {
        ok: false,
        error: "Department not found",
        fieldErrors: { departmentId: ["Department not found"] },
      };
    }
  }

  // Verify warehouse if provided
  if (data.warehouseId) {
    const wh = await db.warehouse.findFirst({
      where: { id: data.warehouseId, organizationId: orgId, isArchived: false },
      select: { id: true },
    });
    if (!wh) {
      return {
        ok: false,
        error: "Warehouse not found",
        fieldErrors: { warehouseId: ["Warehouse not found"] },
      };
    }
  }

  try {
    const assignment = await db.countAssignment.create({
      data: {
        organizationId: orgId,
        countId: data.countId,
        userId: data.userId,
        departmentId: data.departmentId,
        warehouseId: data.warehouseId,
        role: data.role,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "count_assignment.created",
      entityType: "count_assignment",
      entityId: assignment.id,
      metadata: { countId: data.countId, userId: data.userId, role: data.role },
    });

    revalidatePath(`/stock-counts/${data.countId}/assignments`);
    return { ok: true, id: assignment.id };
  } catch (err) {
    logger.error("createAssignmentAction failed:", { error: err });
    return { ok: false, error: "Failed to create assignment" };
  }
}

/**
 * Update an assignment.
 */
export async function updateAssignmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "countAssignments.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updateAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

  // Verify assignment exists and belongs to org
  const existing = await db.countAssignment.findFirst({
    where: { id: data.id, organizationId: orgId },
    select: { id: true, countId: true },
  });
  if (!existing) {
    return { ok: false, error: "Assignment not found" };
  }

  try {
    const updated = await db.countAssignment.update({
      where: { id: data.id },
      data: {
        role: data.role ?? undefined,
        status: data.status ?? undefined,
        itemsCounted: data.itemsCounted ?? undefined,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "count_assignment.created",
      entityType: "count_assignment",
      entityId: updated.id,
      metadata: { changes: data },
    });

    revalidatePath(`/stock-counts/${existing.countId}/assignments`);
    return { ok: true, id: updated.id };
  } catch (err) {
    logger.error("updateAssignmentAction failed:", { error: err });
    return { ok: false, error: "Failed to update assignment" };
  }
}

/**
 * Remove an assignment.
 */
export async function removeAssignmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "countAssignments.remove")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = removeAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { id } = parsed.data;
  const orgId = membership.organizationId;

  // Verify assignment exists and belongs to org
  const existing = await db.countAssignment.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, countId: true },
  });
  if (!existing) {
    return { ok: false, error: "Assignment not found" };
  }

  try {
    await db.countAssignment.delete({
      where: { id },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "count_assignment.removed",
      entityType: "count_assignment",
      entityId: id,
      metadata: { countId: existing.countId },
    });

    revalidatePath(`/stock-counts/${existing.countId}/assignments`);
    return { ok: true, id };
  } catch (err) {
    logger.error("removeAssignmentAction failed:", { error: err });
    return { ok: false, error: "Failed to remove assignment" };
  }
}
