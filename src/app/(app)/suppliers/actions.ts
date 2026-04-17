"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { supplierInputSchema } from "@/lib/validation/supplier";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function formToInput(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return {
    ...raw,
    isActive: formData.get("isActive") === "on" || raw.isActive === "true",
  };
}

export async function createSupplierAction(formData: FormData): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "suppliers.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = supplierInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.suppliers.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const supplier = await db.supplier.create({
      data: {
        organizationId: membership.organizationId,
        name: input.name,
        code: input.code,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        country: input.country,
        website: input.website,
        notes: input.notes,
        currency: input.currency,
        isActive: input.isActive,
      },
      select: { id: true },
    });

    revalidatePath("/suppliers");
    return { ok: true, id: supplier.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.suppliers.errors.codeExists,
        fieldErrors: { code: [t.suppliers.errors.codeExists] },
      };
    }
    return { ok: false, error: t.suppliers.errors.createFailed };
  }
}

export async function updateSupplierAction(id: string, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "suppliers.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = supplierInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.suppliers.errors.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const updated = await db.supplier.update({
      where: { id, organizationId: membership.organizationId },
      data: {
        name: input.name,
        code: input.code,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        country: input.country,
        website: input.website,
        notes: input.notes,
        currency: input.currency,
        isActive: input.isActive,
      },
      select: { id: true },
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}/edit`);
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: t.suppliers.errors.codeExists,
          fieldErrors: { code: [t.suppliers.errors.codeExists] },
        };
      }
      if (error.code === "P2025") {
        return { ok: false, error: t.suppliers.errors.notFound };
      }
    }
    return { ok: false, error: t.suppliers.errors.updateFailed };
  }
}

export async function deleteSupplierAction(id: string): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "suppliers.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  try {
    // Block deletion if the supplier has any purchase orders — we use
    // onDelete: Restrict at the DB level but return a friendly error
    // instead of leaking a Prisma code to the UI.
    const poCount = await db.purchaseOrder.count({
      where: { organizationId: membership.organizationId, supplierId: id },
    });
    if (poCount > 0) {
      return { ok: false, error: t.suppliers.errors.inUse };
    }

    await db.supplier.delete({
      where: { id, organizationId: membership.organizationId },
    });

    revalidatePath("/suppliers");
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { ok: false, error: t.suppliers.errors.notFound };
      }
      if (error.code === "P2003") {
        return { ok: false, error: t.suppliers.errors.inUse };
      }
    }
    return { ok: false, error: t.suppliers.errors.deleteFailed };
  }
}
