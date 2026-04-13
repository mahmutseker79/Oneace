/**
 * Upsert helper for StockLevel that handles the nullable binId in the
 * compound unique constraint `[itemId, warehouseId, binId]`.
 *
 * Prisma's generated `itemId_warehouseId_binId` compound unique input
 * requires all three fields to be non-null strings. Since `binId` is
 * nullable (warehouse-level stock has `binId = null`), we can't use the
 * compound unique `where` directly. This helper does a findFirst +
 * create/update instead.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type UpsertStockLevelInput = {
  organizationId: string;
  itemId: string;
  warehouseId: string;
  binId?: string | null;
  quantityDelta?: number;
  /** Only used for create — sets the initial absolute quantity. */
  quantityAbsolute?: number;
};

export async function upsertStockLevel(tx: TxClient, input: UpsertStockLevelInput) {
  const existing = await tx.stockLevel.findFirst({
    where: {
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      binId: input.binId ?? null,
    },
    select: { id: true },
  });

  const qty = input.quantityDelta ?? input.quantityAbsolute ?? 0;

  if (existing) {
    return tx.stockLevel.update({
      where: { id: existing.id },
      data: {
        quantity: input.quantityDelta != null ? { increment: input.quantityDelta } : qty,
      },
    });
  }

  return tx.stockLevel.create({
    data: {
      organizationId: input.organizationId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      binId: input.binId ?? null,
      quantity: qty,
    },
  });
}
