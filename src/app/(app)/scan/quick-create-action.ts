"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

/**
 * Lightweight item creation from the scanner's "unknown barcode"
 * quick-add sheet. Accepts only the minimum viable fields: name,
 * barcode, and optional category. SKU is auto-generated.
 *
 * Returns the created item id on success so the scanner can
 * immediately show the "found" result card.
 */
export type QuickCreateResult =
  | { ok: true; id: string; name: string; sku: string }
  | { ok: false; error: string };

export async function quickCreateItemAction(input: {
  barcode: string;
  name: string;
  categoryId?: string | null;
}): Promise<QuickCreateResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const name = input.name.trim();
  const barcode = input.barcode.trim();

  if (!name) {
    return { ok: false, error: t.scan.quickAdd.nameRequired };
  }
  if (!barcode) {
    return { ok: false, error: t.scan.quickAdd.barcodeRequired };
  }

  // Auto-generate a SKU from the barcode prefix + timestamp suffix.
  const skuBase = barcode.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const skuSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const sku = `${skuBase}-${skuSuffix}`;

  try {
    const item = await db.item.create({
      data: {
        organizationId: membership.organizationId,
        sku,
        barcode,
        name,
        categoryId: input.categoryId || null,
        unit: "pcs",
        status: "ACTIVE",
      },
      select: { id: true, name: true, sku: true },
    });

    revalidatePath("/items");
    revalidatePath("/scan");

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "item.created",
      entityType: "item",
      entityId: item.id,
      metadata: { sku, barcode, name, source: "scanner-quick-add" },
    });

    return { ok: true, id: item.id, name: item.name, sku: item.sku };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: t.items.errors.skuExists ?? "An item with this barcode already exists." };
    }
    return { ok: false, error: t.items.errors.createFailed ?? "Failed to create item." };
  }
}
