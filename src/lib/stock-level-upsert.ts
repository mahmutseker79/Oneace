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

  // Use raw SQL with ON CONFLICT + RETURNING to atomically upsert AND
  // return the result in a single statement. This prevents the stale-read
  // race condition where a separate findFirst could return an outdated
  // quantity if another transaction updated the row between the upsert
  // and the read.
  const rows = await tx.$queryRaw<Array<{
    id: string;
    organizationId: string;
    itemId: string;
    warehouseId: string;
    binId: string | null;
    quantity: number;
    reservedQty: number;
    updatedAt: Date;
  }>>`
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
    RETURNING *
  `;

  return rows[0] ?? null;
}
