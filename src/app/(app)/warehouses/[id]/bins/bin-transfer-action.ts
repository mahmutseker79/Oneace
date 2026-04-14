"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability, planCapabilityError } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";

const binTransferSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  fromBinId: z.string().min(1, "Source bin is required"),
  toBinId: z.string().min(1, "Destination bin is required"),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .pipe(z.number().int().min(1, "Quantity must be at least 1")),
});

export type BinTransferResult = { ok: true; id: string } | { ok: false; error: string };

export async function binTransferAction(
  warehouseId: string,
  formData: FormData,
): Promise<BinTransferResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "bins.transfer")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Phase 13.2 — bin transfers require PRO or BUSINESS
  const btPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(btPlan, "bins")) {
    return { ok: false, error: planCapabilityError("bins") };
  }

  const parsed = binTransferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const firstErr = parsed.error.errors[0]?.message ?? t.movements.errors.createFailed;
    return { ok: false, error: firstErr };
  }
  const { itemId, fromBinId, toBinId, quantity } = parsed.data;

  if (fromBinId === toBinId) {
    return { ok: false, error: "Source and destination bins must be different." };
  }

  // Validate entities
  const [warehouse, item, fromBin, toBin] = await Promise.all([
    db.warehouse.findFirst({
      where: { id: warehouseId, organizationId: membership.organizationId },
      select: { id: true },
    }),
    db.item.findFirst({
      where: { id: itemId, organizationId: membership.organizationId },
      select: { id: true },
    }),
    db.bin.findFirst({ where: { id: fromBinId, warehouseId }, select: { id: true, code: true } }),
    db.bin.findFirst({ where: { id: toBinId, warehouseId }, select: { id: true, code: true } }),
  ]);

  if (!warehouse) return { ok: false, error: t.warehouses.errors.notFound };
  if (!item) return { ok: false, error: t.movements.errors.itemNotFound };
  if (!fromBin || !toBin) return { ok: false, error: t.bins.errors.notFound };

  try {
    const movement = await db.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: {
          organizationId: membership.organizationId,
          itemId,
          warehouseId,
          binId: fromBinId,
          toBinId,
          type: "BIN_TRANSFER",
          quantity,
          direction: 1,
          createdByUserId: session.user.id,
        },
        select: { id: true },
      });

      // Debit source bin
      await upsertStockLevel(tx, {
        organizationId: membership.organizationId,
        itemId,
        warehouseId,
        binId: fromBinId,
        quantityDelta: -quantity,
      });

      // Credit destination bin
      await upsertStockLevel(tx, {
        organizationId: membership.organizationId,
        itemId,
        warehouseId,
        binId: toBinId,
        quantityDelta: quantity,
      });

      return created;
    });

    revalidatePath(`/warehouses/${warehouseId}`);
    revalidatePath(`/warehouses/${warehouseId}/bins`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "stock_movement.created",
      entityType: "stock_movement",
      entityId: movement.id,
      metadata: {
        type: "BIN_TRANSFER",
        itemId,
        warehouseId,
        fromBin: fromBin.code,
        toBin: toBin.code,
        quantity,
      },
    });

    return { ok: true, id: movement.id };
  } catch {
    return { ok: false, error: t.movements.errors.createFailed };
  }
}
