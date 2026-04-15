"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { checkPlanLimit, planLimitError } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { warehouseInputSchema } from "@/lib/validation/warehouse";
import { barcodeValueSchema } from "@/lib/validation/barcode";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function formToInput(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return {
    ...raw,
    isDefault: formData.get("isDefault") === "on" || raw.isDefault === "true",
  };
}

export async function createWarehouseAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "warehouses.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Phase 13.2 — plan warehouse limit (FREE: 1 warehouse)
  const whPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  const currentWhCount = await db.warehouse.count({
    where: { organizationId: membership.organizationId, isArchived: false },
  });
  const whLimitCheck = checkPlanLimit(whPlan, "warehouses", currentWhCount);
  if (!whLimitCheck.allowed) {
    return { ok: false, error: planLimitError("warehouses", whLimitCheck) };
  }

  const parsed = warehouseInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.warehouses.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const warehouse = await db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.warehouse.updateMany({
          where: { organizationId: membership.organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.warehouse.create({
        data: {
          organizationId: membership.organizationId,
          name: input.name,
          code: input.code,
          address: input.address,
          city: input.city,
          region: input.region,
          country: input.country,
          isDefault: input.isDefault,
        },
        select: { id: true },
      });
    });

    revalidatePath("/warehouses");
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "warehouse.created",
      entityType: "warehouse",
      entityId: warehouse.id,
      metadata: {
        name: input.name,
        code: input.code,
        isDefault: input.isDefault,
      },
    });
    return { ok: true, id: warehouse.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.warehouses.errors.codeExists,
        fieldErrors: { code: [t.warehouses.errors.codeExists] },
      };
    }
    return { ok: false, error: t.warehouses.errors.createFailed };
  }
}

export async function updateWarehouseAction(id: string, formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "warehouses.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = warehouseInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.warehouses.errors.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const updated = await db.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.warehouse.updateMany({
          where: {
            organizationId: membership.organizationId,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }
      return tx.warehouse.update({
        where: { id, organizationId: membership.organizationId },
        data: {
          name: input.name,
          code: input.code,
          address: input.address,
          city: input.city,
          region: input.region,
          country: input.country,
          isDefault: input.isDefault,
        },
        select: { id: true },
      });
    });

    revalidatePath("/warehouses");
    revalidatePath(`/warehouses/${id}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "warehouse.updated",
      entityType: "warehouse",
      entityId: updated.id,
      metadata: {
        name: input.name,
        code: input.code,
        isDefault: input.isDefault,
      },
    });
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: t.warehouses.errors.codeExists,
          fieldErrors: { code: [t.warehouses.errors.codeExists] },
        };
      }
      if (error.code === "P2025") {
        return { ok: false, error: t.warehouses.errors.notFound };
      }
    }
    return { ok: false, error: t.warehouses.errors.updateFailed };
  }
}

export async function deleteWarehouseAction(id: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "warehouses.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  try {
    const remaining = await db.warehouse.count({
      where: {
        organizationId: membership.organizationId,
        id: { not: id },
      },
    });

    const target = await db.warehouse.findUnique({
      where: { id, organizationId: membership.organizationId },
      select: { isDefault: true, name: true, code: true },
    });

    if (!target) {
      return { ok: false, error: t.warehouses.errors.notFound };
    }

    if (target.isDefault && remaining === 0) {
      return { ok: false, error: t.warehouses.errors.defaultRequired };
    }

    await db.$transaction(async (tx) => {
      await tx.warehouse.delete({
        where: { id, organizationId: membership.organizationId },
      });
      if (target.isDefault) {
        const first = await tx.warehouse.findFirst({
          where: { organizationId: membership.organizationId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (first) {
          await tx.warehouse.update({
            where: { id: first.id },
            data: { isDefault: true },
          });
        }
      }
    });

    revalidatePath("/warehouses");
    // entityId intentionally omitted — the Warehouse row is gone.
    // Metadata preserves the durable identifiers (code + name) for
    // the /audit reader.
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "warehouse.deleted",
      entityType: "warehouse",
      entityId: null,
      metadata: {
        warehouseId: id,
        code: target.code,
        name: target.name,
        wasDefault: target.isDefault,
      },
    });
    return { ok: true, id };
  } catch {
    return { ok: false, error: t.warehouses.errors.deleteFailed };
  }
}

export async function assignWarehouseBarcodeAction(
  warehouseId: string,
  barcodeValue: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "warehouses.edit")) {
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
      error: "Please provide a valid code",
      fieldErrors: { barcodeValue: parsed.error.errors.map((e) => e.message) },
    };
  }

  try {
    const updated = await db.warehouse.update({
      where: { id: warehouseId, organizationId: membership.organizationId },
      data: { barcodeValue: parsed.data },
      select: { id: true },
    });

    revalidatePath("/warehouses");
    revalidatePath(`/warehouses/${warehouseId}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "warehouse.barcode_assigned",
      entityType: "warehouse",
      entityId: updated.id,
      metadata: { barcodeValue: parsed.data },
    });
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: "A location with this code already exists",
          fieldErrors: { barcodeValue: ["A location with this code already exists"] },
        };
      }
    }
    return { ok: false, error: t.warehouses.errors.updateFailed };
  }
}
