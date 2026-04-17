"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import type { ActionResult } from "@/lib/validation/action-result";
import {
  createLocationLevelSchema,
  reorderLocationLevelsSchema,
  updateLocationLevelSchema,
} from "@/lib/validation/location-level";

export async function createLocationLevelAction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "locations.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createLocationLevelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.locations?.errors?.createFailed || "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Verify warehouse exists and belongs to the organization
  const warehouse = await db.warehouse.findFirst({
    where: { id: data.warehouseId, organizationId: membership.organizationId },
    select: { id: true },
  });

  if (!warehouse) {
    return { ok: false, error: t.warehouses.errors.notFound };
  }

  // If parentId provided, verify it exists
  if (data.parentId) {
    const parent = await db.locationLevel.findFirst({
      where: {
        id: data.parentId,
        warehouseId: data.warehouseId,
        organizationId: membership.organizationId,
      },
      select: { id: true },
    });

    if (!parent) {
      return {
        ok: false,
        error: t.locations?.errors?.parentNotFound || "Parent location not found",
      };
    }
  }

  try {
    // Get max sortOrder for this parent
    const maxSort = await db.locationLevel.findFirst({
      where: {
        warehouseId: data.warehouseId,
        parentId: data.parentId ?? null,
      },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
    });

    const location = await db.locationLevel.create({
      data: {
        organizationId: membership.organizationId,
        warehouseId: data.warehouseId,
        parentId: data.parentId ?? null,
        type: data.type as typeof data.type,
        name: data.name,
        code: data.code,
        barcodeValue: data.barcodeValue ?? null,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });

    revalidatePath(`/warehouses/${data.warehouseId}/locations`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "location.created",
      entityType: "location_level",
      entityId: location.id,
      metadata: { warehouseId: data.warehouseId, code: data.code, type: data.type },
    });

    return { ok: true, id: location.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.locations?.errors?.codeExists || "Location code already exists in this warehouse",
        fieldErrors: { code: [t.locations?.errors?.codeExists || "Code already exists"] },
      };
    }
    return { ok: false, error: t.locations?.errors?.createFailed || "Failed to create location" };
  }
}

export async function updateLocationLevelAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "locations.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updateLocationLevelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.locations?.errors?.updateFailed || "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  const location = await db.locationLevel.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { id: true, warehouseId: true },
  });

  if (!location) {
    return { ok: false, error: t.locations?.errors?.notFound || "Location not found" };
  }

  try {
    const updated = await db.locationLevel.update({
      where: { id },
      data: {
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.type && { type: data.type as typeof data.type }),
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.barcodeValue !== undefined && { barcodeValue: data.barcodeValue }),
      },
      select: { id: true },
    });

    revalidatePath(`/warehouses/${location.warehouseId}/locations`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "location.updated",
      entityType: "location_level",
      entityId: id,
      metadata: { warehouseId: location.warehouseId },
    });

    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.locations?.errors?.codeExists || "Location code already exists in this warehouse",
        fieldErrors: { code: [t.locations?.errors?.codeExists || "Code already exists"] },
      };
    }
    return { ok: false, error: t.locations?.errors?.updateFailed || "Failed to update location" };
  }
}

export async function deleteLocationLevelAction(
  id: string,
  warehouseId: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "locations.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const location = await db.locationLevel.findFirst({
    where: { id, warehouseId, organizationId: membership.organizationId },
    select: { id: true, code: true },
  });

  if (!location) {
    return { ok: false, error: t.locations?.errors?.notFound || "Location not found" };
  }

  try {
    await db.locationLevel.delete({
      where: { id },
    });

    revalidatePath(`/warehouses/${warehouseId}/locations`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "location.deleted",
      entityType: "location_level",
      entityId: null,
      metadata: { locationId: id, warehouseId, code: location.code },
    });

    return { ok: true, id };
  } catch (_error) {
    return { ok: false, error: t.locations?.errors?.deleteFailed || "Failed to delete location" };
  }
}

export async function reorderLocationLevelsAction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "locations.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = reorderLocationLevelsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.locations?.errors?.reorderFailed || "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  try {
    // Update sortOrder for each location
    const updates = data.ids.map((id, index) =>
      db.locationLevel.update({
        where: { id, warehouseId: data.warehouseId },
        data: { sortOrder: index },
      }),
    );

    await db.$transaction(updates);

    revalidatePath(`/warehouses/${data.warehouseId}/locations`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "location.reordered",
      entityType: "location_level",
      entityId: null,
      metadata: { warehouseId: data.warehouseId, count: data.ids.length },
    });

    return { ok: true, id: data.warehouseId };
  } catch (_error) {
    return {
      ok: false,
      error: t.locations?.errors?.reorderFailed || "Failed to reorder locations",
    };
  }
}
