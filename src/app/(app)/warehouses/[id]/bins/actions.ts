"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
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

export async function deleteBinAction(
  warehouseId: string,
  binId: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

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
