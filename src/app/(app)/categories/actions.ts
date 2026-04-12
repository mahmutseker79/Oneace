"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { categoryInputSchema } from "@/lib/validation/item";
import { z } from "zod";

const categoryRenameSchema = z.object({
  name: z.string().min(1).max(80),
});

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function uniqueSlug(
  organizationId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  let slug = base;
  let n = 1;
  while (true) {
    const existing = await db.category.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return slug;
    n += 1;
    slug = `${base}-${n}`;
    if (n > 50) return `${base}-${Date.now()}`;
  }
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = categoryInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.categories.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const baseSlug = slugify(input.name) || "category";
    const slug = await uniqueSlug(membership.organizationId, baseSlug);

    const category = await db.category.create({
      data: {
        organizationId: membership.organizationId,
        name: input.name,
        description: input.description,
        parentId: input.parentId,
        slug,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "category.created",
      entityType: "category",
      entityId: category.id,
      metadata: { name: input.name, slug, parentId: input.parentId },
    });

    revalidatePath("/categories");
    revalidatePath("/items");
    return { ok: true, id: category.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.categories.errors.nameExists,
        fieldErrors: { name: [t.categories.errors.nameExists] },
      };
    }
    return { ok: false, error: t.categories.errors.createFailed };
  }
}

export async function updateCategoryAction(id: string, formData: FormData): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = categoryRenameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.categories.errors.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const existing = await db.category.findFirst({
      where: { id, organizationId: membership.organizationId },
      select: { id: true },
    });
    if (!existing) {
      return { ok: false, error: t.categories.errors.notFound };
    }

    const baseSlug = slugify(input.name) || "category";
    const slug = await uniqueSlug(membership.organizationId, baseSlug, id);

    await db.category.update({
      where: { id },
      data: { name: input.name, slug },
    });

    revalidatePath("/categories");
    revalidatePath("/items");
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.categories.errors.nameExists,
        fieldErrors: { name: [t.categories.errors.nameExists] },
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: t.categories.errors.notFound };
    }
    return { ok: false, error: t.categories.errors.updateFailed };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  // Read the name/slug BEFORE the delete so the audit row carries the
  // human-readable fields. Same pattern as item/warehouse delete.
  const snapshot = await db.category.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { name: true, slug: true },
  });

  try {
    await db.category.delete({
      where: { id, organizationId: membership.organizationId },
    });
    if (snapshot) {
      await recordAudit({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: "category.deleted",
        entityType: "category",
        entityId: id,
        metadata: { name: snapshot.name, slug: snapshot.slug },
      });
    }
    revalidatePath("/categories");
    revalidatePath("/items");
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: t.categories.errors.notFound };
    }
    return { ok: false, error: t.categories.errors.deleteFailed };
  }
}
