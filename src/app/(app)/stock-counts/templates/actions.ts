"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  createTemplateSchema,
  deleteTemplateSchema,
  updateTemplateSchema,
} from "@/lib/validation/count-template";

/**
 * Create a count template.
 */
export async function createTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "countTemplates.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

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

  // Verify items belong to org
  const itemCount = await db.item.count({
    where: {
      id: { in: data.itemIds },
      organizationId: orgId,
      status: "ACTIVE",
    },
  });
  if (itemCount !== data.itemIds.length) {
    return {
      ok: false,
      error: "Some items not found",
      fieldErrors: { itemIds: ["All items must exist in your organization"] },
    };
  }

  try {
    const template = await db.countTemplate.create({
      data: {
        organizationId: orgId,
        name: data.name,
        description: data.description,
        methodology: data.methodology,
        scope: data.scope,
        departmentId: data.departmentId,
        warehouseId: data.warehouseId,
        categoryIds: data.itemIds,
        cronExpression: data.cronExpression,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "count_template.created",
      entityType: "count_template",
      entityId: template.id,
      metadata: { name: data.name, scope: data.scope },
    });

    revalidatePath("/stock-counts/templates");
    return { ok: true, id: template.id };
  } catch (err) {
    console.error("createTemplateAction failed:", err);
    return { ok: false, error: "Failed to create template" };
  }
}

/**
 * Update a count template.
 */
export async function updateTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "countTemplates.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

  // Verify template exists and belongs to org
  const existing = await db.countTemplate.findFirst({
    where: { id: data.id, organizationId: orgId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "Template not found" };
  }

  // Verify department if provided
  if (data.departmentId !== undefined && data.departmentId) {
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
  if (data.warehouseId !== undefined && data.warehouseId) {
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

  // Verify items if provided
  if (data.itemIds) {
    const itemCount = await db.item.count({
      where: {
        id: { in: data.itemIds },
        organizationId: orgId,
        status: "ACTIVE",
      },
    });
    if (itemCount !== data.itemIds.length) {
      return {
        ok: false,
        error: "Some items not found",
        fieldErrors: { itemIds: ["All items must exist in your organization"] },
      };
    }
  }

  try {
    const updated = await db.countTemplate.update({
      where: { id: data.id },
      data: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        methodology: data.methodology ?? undefined,
        scope: data.scope ?? undefined,
        departmentId: data.departmentId ?? undefined,
        warehouseId: data.warehouseId ?? undefined,
        categoryIds: data.itemIds ?? undefined,
        cronExpression: data.cronExpression ?? undefined,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "count_template.updated",
      entityType: "count_template",
      entityId: updated.id,
      metadata: { changes: data },
    });

    revalidatePath("/stock-counts/templates");
    revalidatePath(`/stock-counts/templates/${updated.id}`);
    return { ok: true, id: updated.id };
  } catch (err) {
    console.error("updateTemplateAction failed:", err);
    return { ok: false, error: "Failed to update template" };
  }
}

/**
 * Delete a count template.
 */
export async function deleteTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "countTemplates.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = deleteTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { id } = parsed.data;
  const orgId = membership.organizationId;

  // Verify template exists and belongs to org
  const existing = await db.countTemplate.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, error: "Template not found" };
  }

  try {
    await db.countTemplate.delete({
      where: { id },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "count_template.deleted",
      entityType: "count_template",
      entityId: id,
      metadata: { name: existing.name },
    });

    revalidatePath("/stock-counts/templates");
    return { ok: true, id };
  } catch (err) {
    console.error("deleteTemplateAction failed:", err);
    return { ok: false, error: "Failed to delete template" };
  }
}
