"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  createDepartmentSchema,
  deleteDepartmentSchema,
  updateDepartmentSchema,
} from "@/lib/validation/department";

/**
 * Create a new department.
 */
export async function createDepartmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "departments.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createDepartmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

  // If manager ID provided, verify user belongs to org
  if (data.managerId) {
    const manager = await db.user.findFirst({
      where: {
        id: data.managerId,
        memberships: { some: { organizationId: orgId } },
      },
      select: { id: true },
    });
    if (!manager) {
      return {
        ok: false,
        error: "Manager not found",
        fieldErrors: { managerId: ["Manager must belong to your organization"] },
      };
    }
  }

  // If warehouse ID provided, verify it belongs to org
  if (data.warehouseId) {
    const warehouse = await db.warehouse.findFirst({
      where: { id: data.warehouseId, organizationId: orgId, isArchived: false },
      select: { id: true },
    });
    if (!warehouse) {
      return {
        ok: false,
        error: "Warehouse not found",
        fieldErrors: { warehouseId: ["Warehouse not found"] },
      };
    }
  }

  // Check if code is unique within org (if provided)
  if (data.code) {
    const existing = await db.department.findFirst({
      where: { organizationId: orgId, code: data.code },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: false,
        error: "Department code already exists",
        fieldErrors: { code: ["Code must be unique"] },
      };
    }
  }

  try {
    const department = await db.department.create({
      data: {
        organizationId: orgId,
        name: data.name,
        code: data.code,
        color: data.color,
        managerId: data.managerId,
        warehouseId: data.warehouseId,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "department.created",
      entityType: "department",
      entityId: department.id,
      metadata: { name: data.name, code: data.code },
    });

    revalidatePath("/departments");
    return { ok: true, id: department.id };
  } catch (err) {
    console.error("createDepartmentAction failed:", err);
    return { ok: false, error: "Failed to create department" };
  }
}

/**
 * Update an existing department.
 */
export async function updateDepartmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "departments.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updateDepartmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

  // Verify department exists and belongs to org
  const existing = await db.department.findFirst({
    where: { id: data.id, organizationId: orgId },
    select: { id: true, name: true, code: true, color: true },
  });

  if (!existing) {
    return { ok: false, error: "Department not found" };
  }

  // If manager ID provided, verify user belongs to org
  if (data.managerId !== undefined) {
    if (data.managerId) {
      const manager = await db.user.findFirst({
        where: {
          id: data.managerId,
          memberships: { some: { organizationId: orgId } },
        },
        select: { id: true },
      });
      if (!manager) {
        return {
          ok: false,
          error: "Manager not found",
          fieldErrors: { managerId: ["Manager must belong to your organization"] },
        };
      }
    }
  }

  // If warehouse ID provided, verify it belongs to org
  if (data.warehouseId !== undefined) {
    if (data.warehouseId) {
      const warehouse = await db.warehouse.findFirst({
        where: { id: data.warehouseId, organizationId: orgId, isArchived: false },
        select: { id: true },
      });
      if (!warehouse) {
        return {
          ok: false,
          error: "Warehouse not found",
          fieldErrors: { warehouseId: ["Warehouse not found"] },
        };
      }
    }
  }

  // Check if code is unique within org (if provided and changed)
  if (data.code !== undefined && data.code !== existing.code) {
    const conflicting = await db.department.findFirst({
      where: { organizationId: orgId, code: data.code },
      select: { id: true },
    });
    if (conflicting) {
      return {
        ok: false,
        error: "Department code already exists",
        fieldErrors: { code: ["Code must be unique"] },
      };
    }
  }

  try {
    const updated = await db.department.update({
      where: { id: data.id },
      data: {
        name: data.name ?? undefined,
        code: data.code ?? undefined,
        color: data.color ?? undefined,
        managerId: data.managerId ?? undefined,
        warehouseId: data.warehouseId ?? undefined,
        isActive: data.isActive ?? undefined,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "department.updated",
      entityType: "department",
      entityId: updated.id,
      metadata: { before: existing, after: data },
    });

    revalidatePath("/departments");
    revalidatePath(`/departments/${updated.id}`);
    return { ok: true, id: updated.id };
  } catch (err) {
    console.error("updateDepartmentAction failed:", err);
    return { ok: false, error: "Failed to update department" };
  }
}

/**
 * Delete a department.
 */
export async function deleteDepartmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "departments.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = deleteDepartmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { id } = parsed.data;
  const orgId = membership.organizationId;

  // Verify department exists and belongs to org
  const existing = await db.department.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, name: true },
  });

  if (!existing) {
    return { ok: false, error: "Department not found" };
  }

  try {
    await db.department.delete({
      where: { id },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "department.deleted",
      entityType: "department",
      entityId: id,
      metadata: { name: existing.name },
    });

    revalidatePath("/departments");
    return { ok: true, id };
  } catch (err) {
    console.error("deleteDepartmentAction failed:", err);
    return { ok: false, error: "Failed to delete department" };
  }
}
