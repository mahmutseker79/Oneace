"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { evaluateAlerts } from "@/lib/alerts";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";
import { type PutawayInput, putawayInputSchema } from "@/lib/validation/putaway";

export { putawayInputSchema };
export type { PutawayInput };

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type PutawayResult =
  | { ok: true; movementIds: string[] }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Putaway action
// ---------------------------------------------------------------------------

/**
 * Phase 11.3 — Putaway: move stock from warehouse-level (binId = null)
 * into a specific bin.
 *
 * Mechanically this is a BIN_TRANSFER where the source bin is null
 * (warehouse-level unassigned stock) and the destination is a real bin.
 * The existing BIN_TRANSFER movement type is reused so putaway is visible
 * in the ledger alongside standard bin-to-bin transfers.
 *
 * Each line is written in its own $transaction (debit warehouse-level
 * stock, credit bin-level stock) with an idempotency key per line.
 *
 * Stock integrity:
 *   - Over-assignment is rejected: quantity must not exceed the available
 *     unbinned stock for the item at this warehouse.
 *   - Negative unbinned stock is prevented (unlike the general movement
 *     policy): putaway semantically means "assign existing stock", not
 *     "create new stock at a bin".
 *   - Each line is atomic via $transaction.
 *   - Idempotency keys prevent double-apply on resubmit.
 *
 * Audit: each BIN_TRANSFER movement is logged via recordAudit with a
 * `putaway: true` flag for filtering.
 */
export async function putawayAction(
  input: PutawayInput,
  idempotencyKeys: string[],
): Promise<PutawayResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "bins.transfer")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Re-validate on server.
  const parsed = putawayInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.movements.errors.createFailed,
    };
  }

  if (idempotencyKeys.length !== parsed.data.lines.length) {
    return { ok: false, error: t.movements.errors.createFailed };
  }

  const { warehouseId, lines } = parsed.data;
  const orgId = membership.organizationId;
  const userId = session.user.id;

  // Scope check: warehouse belongs to org.
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: orgId },
    select: { id: true, name: true },
  });
  if (!warehouse) {
    return { ok: false, error: t.warehouses.errors.notFound };
  }

  // Validate all referenced bins belong to this warehouse.
  const binIds = [...new Set(lines.map((l) => l.toBinId))];
  const bins = await db.bin.findMany({
    where: { id: { in: binIds }, warehouseId },
    select: { id: true, code: true },
  });
  const binMap = new Map(bins.map((b) => [b.id, b]));
  const missingBin = binIds.find((id) => !binMap.has(id));
  if (missingBin) {
    return { ok: false, error: t.bins.errors.notFound };
  }

  // Validate all items belong to org.
  const itemIds = [...new Set(lines.map((l) => l.itemId))];
  const items = await db.item.findMany({
    where: { id: { in: itemIds }, organizationId: orgId },
    select: { id: true, name: true },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const missingItem = itemIds.find((id) => !itemMap.has(id));
  if (missingItem) {
    return { ok: false, error: t.movements.errors.itemNotFound };
  }

  // Load current unbinned stock levels for all items in this warehouse.
  // This is the available "pool" for putaway. We check before writing.
  const stockLevels = await db.stockLevel.findMany({
    where: {
      organizationId: orgId,
      warehouseId,
      itemId: { in: itemIds },
      binId: null,
    },
    select: { itemId: true, quantity: true },
  });
  const unbinnedByItem = new Map(stockLevels.map((sl) => [sl.itemId, sl.quantity]));

  // Aggregate total quantity being put away per item (may span multiple bins).
  const totalPutawayByItem = new Map<string, number>();
  for (const line of lines) {
    totalPutawayByItem.set(line.itemId, (totalPutawayByItem.get(line.itemId) ?? 0) + line.quantity);
  }

  // Over-assignment check: total putaway qty per item must not exceed unbinned stock.
  for (const [itemId, totalQty] of totalPutawayByItem) {
    const available = unbinnedByItem.get(itemId) ?? 0;
    if (totalQty > available) {
      const itemName = itemMap.get(itemId)?.name ?? itemId;
      return {
        ok: false,
        error: `Cannot put away ${totalQty} units of "${itemName}" — only ${available} unbinned units available at this location.`,
      };
    }
  }

  // Write each line independently.
  const movementIds: string[] = [];
  const affectedItemIds: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idempotencyKey = idempotencyKeys[i];
    if (!line || !idempotencyKey) continue;

    const bin = binMap.get(line.toBinId);
    if (!bin) continue; // validated above

    // Pre-check idempotency.
    const existing = await db.stockMovement.findUnique({
      where: {
        organizationId_idempotencyKey: { organizationId: orgId, idempotencyKey },
      },
      select: { id: true },
    });
    if (existing) {
      movementIds.push(existing.id);
      continue;
    }

    try {
      const movement = await db.$transaction(async (tx) => {
        // BIN_TRANSFER with binId=null (warehouse-level source) → toBinId.
        const created = await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            itemId: line.itemId,
            warehouseId,
            // binId intentionally null: source is warehouse-level unassigned stock.
            binId: null,
            toBinId: line.toBinId,
            type: "BIN_TRANSFER",
            quantity: line.quantity,
            direction: 1,
            createdByUserId: userId,
            idempotencyKey,
          },
          select: { id: true },
        });

        // Debit warehouse-level (binId=null) stock.
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: line.itemId,
          warehouseId,
          binId: null,
          quantityDelta: -line.quantity,
        });

        // Credit bin-level stock.
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: line.itemId,
          warehouseId,
          binId: line.toBinId,
          quantityDelta: line.quantity,
        });

        return created;
      });

      movementIds.push(movement.id);
      affectedItemIds.push(line.itemId);

      await recordAudit({
        organizationId: orgId,
        actorId: userId,
        action: "stock_movement.created",
        entityType: "stock_movement",
        entityId: movement.id,
        metadata: {
          type: "BIN_TRANSFER",
          putaway: true,
          itemId: line.itemId,
          itemName: itemMap.get(line.itemId)?.name ?? null,
          warehouseId,
          warehouseName: warehouse.name,
          toBinId: line.toBinId,
          toBinCode: bin.code,
          quantity: line.quantity,
        },
      });
    } catch (error) {
      // Handle idempotency race.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const safeKey = idempotencyKey as string;
        const collision = await db.stockMovement.findUnique({
          where: {
            organizationId_idempotencyKey: { organizationId: orgId, idempotencyKey: safeKey },
          },
          select: { id: true },
        });
        if (collision) {
          movementIds.push(collision.id);
          continue;
        }
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : t.movements.errors.createFailed,
      };
    }
  }

  // Fire-and-forget alert evaluation.
  if (affectedItemIds.length > 0) {
    void evaluateAlerts(orgId, affectedItemIds);
  }

  // Revalidate affected surfaces.
  revalidatePath("/movements");
  revalidatePath("/items");
  revalidatePath("/dashboard");
  revalidatePath("/warehouses");
  revalidatePath(`/warehouses/${warehouseId}`);
  revalidatePath(`/warehouses/${warehouseId}/bins`);

  return { ok: true, movementIds };
}
