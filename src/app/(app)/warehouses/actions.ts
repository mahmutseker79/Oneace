"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { warehouseInputSchema } from "@/lib/validation/warehouse";

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
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

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
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

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
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  try {
    const remaining = await db.warehouse.count({
      where: {
        organizationId: membership.organizationId,
        id: { not: id },
      },
    });

    const target = await db.warehouse.findUnique({
      where: { id, organizationId: membership.organizationId },
      select: { isDefault: true },
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
    return { ok: true, id };
  } catch {
    return { ok: false, error: t.warehouses.errors.deleteFailed };
  }
}
