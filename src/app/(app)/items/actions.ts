"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { itemInputSchema } from "@/lib/validation/item";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createItemAction(formData: FormData): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = itemInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;

  try {
    const item = await db.item.create({
      data: {
        organizationId: membership.organizationId,
        sku: input.sku,
        barcode: input.barcode,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        unit: input.unit,
        costPrice: input.costPrice !== null ? new Prisma.Decimal(input.costPrice) : null,
        salePrice: input.salePrice !== null ? new Prisma.Decimal(input.salePrice) : null,
        currency: input.currency,
        reorderPoint: input.reorderPoint,
        reorderQty: input.reorderQty,
        status: input.status,
        imageUrl: input.imageUrl,
      },
      select: { id: true },
    });

    revalidatePath("/items");
    return { ok: true, id: item.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.items.errors.skuExists,
        fieldErrors: { sku: [t.items.errors.skuExists] },
      };
    }
    return { ok: false, error: t.items.errors.createFailed };
  }
}

export async function updateItemAction(id: string, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = itemInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const updated = await db.item.update({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      data: {
        sku: input.sku,
        barcode: input.barcode,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        unit: input.unit,
        costPrice: input.costPrice !== null ? new Prisma.Decimal(input.costPrice) : null,
        salePrice: input.salePrice !== null ? new Prisma.Decimal(input.salePrice) : null,
        currency: input.currency,
        reorderPoint: input.reorderPoint,
        reorderQty: input.reorderQty,
        status: input.status,
        imageUrl: input.imageUrl,
      },
      select: { id: true },
    });

    revalidatePath("/items");
    revalidatePath(`/items/${id}`);
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: t.items.errors.skuExists,
          fieldErrors: { sku: [t.items.errors.skuExists] },
        };
      }
      if (error.code === "P2025") {
        return { ok: false, error: t.items.errors.notFound };
      }
    }
    return { ok: false, error: t.items.errors.updateFailed };
  }
}

export async function deleteItemAction(id: string): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  try {
    await db.item.delete({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });
    revalidatePath("/items");
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: t.items.errors.notFound };
    }
    return { ok: false, error: t.items.errors.deleteFailed };
  }
}
