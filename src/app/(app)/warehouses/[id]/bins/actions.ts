"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability, planCapabilityError } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { barcodeValueSchema } from "@/lib/validation/barcode";
import { binInputSchema } from "@/lib/validation/bin";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function formToInput(formData: FormData) {
  return Object.fromEntries(formData);
}

export async function createBinAction(
  warehouseId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "bins.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Phase 13.2 — bins require PRO or BUSINESS plan
  const binPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(binPlan, "bins")) {
    return { ok: false, error: planCapabilityError("bins") };
  }

  // Verify warehouse belongs to the org
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!warehouse) {
    return { ok: false, error: t.warehouses.errors.notFound };
  }

  const parsed = binInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.bins.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const bin = await db.bin.create({
      data: {
        warehouseId,
        code: input.code,
        label: input.label ?? null,
        description: input.description ?? null,
      },
      select: { id: true },
    });

    revalidatePath(`/warehouses/${warehouseId}/bins`);
    revalidatePath(`/warehouses/${warehouseId}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "bin.created",
      entityType: "bin",
      entityId: bin.id,
      metadata: { warehouseId, code: input.code, label: input.label },
    });
    return { ok: true, id: bin.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.bins.errors.codeExists,
        fieldErrors: { code: [t.bins.errors.codeExists] },
      };
    }
    return { ok: false, error: t.bins.errors.createFailed };
  }
}

export async function updateBinAction(
  warehouseId: string,
  binId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "bins.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!warehouse) {
    return { ok: false, error: t.warehouses.errors.notFound };
  }

  const parsed = binInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.bins.errors.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const updated = await db.bin.update({
      where: { id: binId, warehouseId },
      data: {
        code: input.code,
        label: input.label ?? null,
        description: input.description ?? null,
      },
      select: { id: true },
    });

    revalidatePath(`/warehouses/${warehouseId}/bins`);
    revalidatePath(`/warehouses/${warehouseId}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "bin.updated",
      entityType: "bin",
      entityId: updated.id,
      metadata: { warehouseId, code: input.code, label: input.label },
    });
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: t.bins.errors.codeExists,
          fieldErrors: { code: [t.bins.errors.codeExists] },
        };
      }
      if (error.code === "P2025") {
        return { ok: false, error: t.bins.errors.notFound };
      }
    }
    return { ok: false, error: t.bins.errors.updateFailed };
  }
}

export async function deleteBinAction(warehouseId: string, binId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "bins.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!warehouse) {
    return { ok: false, error: t.warehouses.errors.notFound };
  }

  try {
    const target = await db.bin.findUnique({
      where: { id: binId, warehouseId },
      select: { code: true, label: true },
    });
    if (!target) {
      return { ok: false, error: t.bins.errors.notFound };
    }

    // Nullify binId on stock levels before deleting to revert to
    // warehouse-level tracking rather than cascading deletes.
    await db.$transaction(async (tx) => {
      await tx.stockLevel.updateMany({
        where: { binId },
        data: { binId: null },
      });
      await tx.stockMovement.updateMany({
        where: { binId },
        data: { binId: null },
      });
      await tx.stockMovement.updateMany({
        where: { toBinId: binId },
        data: { toBinId: null },
      });
      await tx.countEntry.updateMany({
        where: { binId },
        data: { binId: null },
      });
      await tx.bin.delete({ where: { id: binId } });
    });

    revalidatePath(`/warehouses/${warehouseId}/bins`);
    revalidatePath(`/warehouses/${warehouseId}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "bin.deleted",
      entityType: "bin",
      entityId: null,
      metadata: { binId, warehouseId, code: target.code, label: target.label },
    });
    return { ok: true, id: binId };
  } catch {
    return { ok: false, error: t.bins.errors.deleteFailed };
  }
}

export async function updateBinDisplayNameAction(
  warehouseId: string,
  binId: string,
  displayName: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "bins.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!warehouse) {
    return { ok: false, error: t.warehouses.errors.notFound };
  }

  // Validate displayName is a non-empty string
  const trimmedName = displayName.trim();
  if (!trimmedName || trimmedName.length > 120) {
    return {
      ok: false,
      error: "Please provide a display name",
      fieldErrors: { displayName: ["Please provide a display name"] },
    };
  }

  try {
    const updated = await db.bin.update({
      where: { id: binId, warehouseId },
      data: { displayName: trimmedName },
      select: { id: true },
    });

    revalidatePath(`/warehouses/${warehouseId}/bins`);
    revalidatePath(`/warehouses/${warehouseId}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "bin.updated",
      entityType: "bin",
      entityId: updated.id,
      metadata: { warehouseId, displayName: trimmedName },
    });
    return { ok: true, id: updated.id };
  } catch {
    return { ok: false, error: t.bins.errors.updateFailed };
  }
}

export async function assignBinBarcodeAction(
  warehouseId: string,
  binId: string,
  barcodeValue: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "bins.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!warehouse) {
    return { ok: false, error: t.warehouses.errors.notFound };
  }

  const parsed = barcodeValueSchema.safeParse(barcodeValue);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please provide a valid barcode",
      fieldErrors: { barcodeValue: parsed.error.errors.map((e) => e.message) },
    };
  }

  try {
    const updated = await db.bin.update({
      where: { id: binId, warehouseId },
      data: { barcodeValue: parsed.data },
      select: { id: true },
    });

    revalidatePath(`/warehouses/${warehouseId}/bins`);
    revalidatePath(`/warehouses/${warehouseId}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "bin.barcode_assigned",
      entityType: "bin",
      entityId: updated.id,
      metadata: { warehouseId, barcodeValue: parsed.data },
    });
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: "A bin with this barcode already exists",
          fieldErrors: { barcodeValue: ["A bin with this barcode already exists"] },
        };
      }
    }
    return { ok: false, error: t.bins.errors.updateFailed };
  }
}

export async function bulkAssignBinBarcodesAction(
  warehouseId: string,
  binIds: string[],
  prefix: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "bins.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true },
  });
  if (!warehouse) {
    return { ok: false, error: t.warehouses.errors.notFound };
  }

  if (!binIds || binIds.length === 0) {
    return { ok: false, error: "No bins selected" };
  }

  try {
    // Verify all bins exist in this warehouse
    const bins = await db.bin.findMany({
      where: { id: { in: binIds }, warehouseId },
      select: { id: true, code: true },
    });

    if (bins.length !== binIds.length) {
      return { ok: false, error: t.bins.errors.notFound };
    }

    // Generate barcode for each bin: {prefix}-{index}-{timestamp}
    const timestamp = Date.now();
    const updates = bins.map((bin, index) => {
      const barcodeValue = `${prefix.toUpperCase()}-${String(index + 1).padStart(3, "0")}-${timestamp}`;
      return db.bin.update({
        where: { id: bin.id },
        data: { barcodeValue },
      });
    });

    await db.$transaction(updates);

    revalidatePath(`/warehouses/${warehouseId}/bins`);
    revalidatePath(`/warehouses/${warehouseId}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "bin.barcode_assigned",
      entityType: "bin",
      entityId: null,
      metadata: { warehouseId, binCount: bins.length, prefix },
    });
    return { ok: true, id: warehouseId };
  } catch {
    return { ok: false, error: t.bins.errors.updateFailed };
  }
}
