"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import type { ActionResult } from "@/lib/validation/action-result.ts";
import {
  bulkCreateSerialsSchema,
  createSerialSchema,
  moveSerialSchema,
  updateSerialStatusSchema,
} from "@/lib/validation/serial-number";

export async function createSerialAction(input: Record<string, unknown>): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "items.serials.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createSerialSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Verify item exists and belongs to the organization
  const item = await db.item.findFirst({
    where: { id: data.itemId, organizationId: membership.organizationId },
    select: { id: true, trackSerialNumbers: true },
  });

  if (!item || !item.trackSerialNumbers) {
    return { ok: false, error: t.items.errors.notFound };
  }

  try {
    const serial = await db.serialNumber.create({
      data: {
        organizationId: membership.organizationId,
        itemId: data.itemId,
        serialNumber: data.serialNumber,
        warehouseId: data.warehouseId ?? null,
        binId: data.binId ?? null,
        batchId: data.batchId ?? null,
        note: data.note ?? null,
        status: "IN_STOCK",
        receivedDate: new Date(),
      },
      select: { id: true },
    });

    // Create initial RECEIVED history entry
    await db.serialHistory.create({
      data: {
        serialNumberId: serial.id,
        action: "RECEIVED",
        performedByUserId: session.user.id,
        toWarehouseId: data.warehouseId ?? null,
      },
    });

    revalidatePath(`/items/${data.itemId}/serials`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "serial.created",
      entityType: "serial_number",
      entityId: serial.id,
      metadata: { itemId: data.itemId, serialNumber: data.serialNumber },
    });

    return { ok: true, id: serial.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.items.errors.serialExists || "Serial number already exists",
        fieldErrors: {
          serialNumber: [t.items.errors.serialExists || "Serial number already exists"],
        },
      };
    }
    return { ok: false, error: t.items.errors.createFailed };
  }
}

export async function bulkCreateSerialsAction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "items.serials.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = bulkCreateSerialsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Verify item exists and belongs to the organization
  const item = await db.item.findFirst({
    where: { id: data.itemId, organizationId: membership.organizationId },
    select: { id: true, trackSerialNumbers: true },
  });

  if (!item || !item.trackSerialNumbers) {
    return { ok: false, error: t.items.errors.notFound };
  }

  try {
    const serials = [];
    for (let i = 0; i < data.count; i++) {
      const paddedNumber = String(data.startNumber + i).padStart(4, "0");
      serials.push({
        organizationId: membership.organizationId,
        itemId: data.itemId,
        serialNumber: `${data.prefix}-${paddedNumber}`,
        warehouseId: data.warehouseId ?? null,
        binId: null,
        batchId: null,
        note: null,
        status: "IN_STOCK" as const,
        receivedDate: new Date(),
      });
    }

    const created = await db.serialNumber.createMany({
      data: serials,
      skipDuplicates: true,
    });

    // Create RECEIVED history for each serial
    const historyEntries = serials.map((s) => ({
      action: "RECEIVED" as const,
      performedByUserId: session.user.id,
      toWarehouseId: s.warehouseId,
    }));

    revalidatePath(`/items/${data.itemId}/serials`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "serial.bulk_created",
      entityType: "serial_number",
      entityId: null,
      metadata: { itemId: data.itemId, count: created.count, prefix: data.prefix },
    });

    return { ok: true, id: data.itemId };
  } catch (_error) {
    return { ok: false, error: t.items.errors.createFailed };
  }
}

export async function moveSerialAction(input: Record<string, unknown>): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "items.serials.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = moveSerialSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  const serial = await db.serialNumber.findFirst({
    where: { id: data.serialNumberId, organizationId: membership.organizationId },
    select: { id: true, itemId: true, warehouseId: true },
  });

  if (!serial) {
    return { ok: false, error: "Serial number not found" };
  }

  try {
    await db.serialNumber.update({
      where: { id: data.serialNumberId },
      data: {
        warehouseId: data.toWarehouseId,
        lastMovedAt: new Date(),
      },
    });

    await db.serialHistory.create({
      data: {
        serialNumberId: data.serialNumberId,
        action: "MOVED",
        fromWarehouseId: serial.warehouseId ?? undefined,
        toWarehouseId: data.toWarehouseId,
        performedByUserId: session.user.id,
        note: data.note ?? null,
      },
    });

    revalidatePath(`/items/${serial.itemId}/serials`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "serial.moved",
      entityType: "serial_number",
      entityId: data.serialNumberId,
      metadata: { toWarehouseId: data.toWarehouseId },
    });

    return { ok: true, id: data.serialNumberId };
  } catch (_error) {
    return { ok: false, error: "Failed to move serial" };
  }
}

export async function updateSerialStatusAction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "items.serials.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updateSerialStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  const serial = await db.serialNumber.findFirst({
    where: { id: data.serialNumberId, organizationId: membership.organizationId },
    select: { id: true, itemId: true, status: true },
  });

  if (!serial) {
    return { ok: false, error: "Serial number not found" };
  }

  const actionMap: Record<string, "ISSUED" | "RETURNED" | "DISPOSED"> = {
    ISSUED: "ISSUED",
    RETURNED: "RETURNED",
    DISPOSED: "DISPOSED",
  };

  const historyAction = actionMap[data.status];

  try {
    await db.serialNumber.update({
      where: { id: data.serialNumberId },
      data: {
        status: data.status as any,
        lastMovedAt: new Date(),
      },
    });

    if (historyAction) {
      await db.serialHistory.create({
        data: {
          serialNumberId: data.serialNumberId,
          action: historyAction,
          performedByUserId: session.user.id,
          note: data.note ?? null,
        },
      });
    }

    revalidatePath(`/items/${serial.itemId}/serials`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "serial.status_updated",
      entityType: "serial_number",
      entityId: data.serialNumberId,
      metadata: { status: data.status },
    });

    return { ok: true, id: data.serialNumberId };
  } catch (_error) {
    return { ok: false, error: "Failed to update serial status" };
  }
}
