/**
 * Upsert helper for StockLevel that handles the nullable binId in the
 * compound unique constraint `[itemId, warehouseId, binId]`.
 *
 * Prisma's generated `itemId_warehouseId_binId` compound unique input
 * requires all three fields to be non-null strings. Since `binId` is
 * nullable (warehouse-level stock has `binId = null`), we can't use the
 * compound unique `where` directly. This helper uses raw SQL ON CONFLICT
 * to atomically handle the upsert in a single database operation, preventing
 * race conditions in concurrent stock updates.
 */

import type { PrismaClient } from "@/generated/prisma";

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
  const qty = input.quantityDelta ?? input.quantityAbsolute ?? 0;

  // Use raw SQL with ON CONFLICT to atomically upsert, handling nullable binId.
  // This is more correct than findFirst + create/update because it's a single
  // atomic operation and prevents race conditions during concurrent stock updates.
  await tx.$executeRaw`
    INSERT INTO "StockLevel" (
      "id",
      "organizationId",
      "itemId",
      "warehouseId",
      "binId",
      "quantity",
      "reservedQty",
      "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text,
      ${input.organizationId},
      ${input.itemId},
      ${input.warehouseId},
      ${input.binId || null},
      ${qty},
      0,
      NOW()
    )
    ON CONFLICT ("itemId", "warehouseId", "binId")
    DO UPDATE SET
      "quantity" = "StockLevel"."quantity" + ${input.quantityDelta || 0},
      "updatedAt" = NOW()
  `;

  // Fetch and return the upserted record
  return tx.stockLevel.findFirst({
    where: {
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      binId: input.binId ?? null,
    },
  });
}
