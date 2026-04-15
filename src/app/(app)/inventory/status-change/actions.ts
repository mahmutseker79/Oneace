"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  type ChangeStockStatusInput,
  changeStockStatusSchema,
} from "@/lib/validation/stock-status";

export type { ActionResult };

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/status-change");
  revalidatePath("/items");
  revalidatePath("/movements");
}

/**
 * Change the status of stock (e.g., AVAILABLE -> DAMAGED).
 *
 * Creates a StockMovement with type "STATUS_CHANGE" and updates the
 * relevant StockLevel row. The reason code provides context for the change.
 */
export async function changeStockStatusAction(
  input: unknown,
): Promise<ActionResult<{ movementId: string; updatedQuantity: number }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "inventory.manageStatus")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = changeStockStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid stock status change data",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

  // Verify all entities belong to this org
  const [item, warehouse, reasonCode] = await Promise.all([
    db.item.findFirst({
      where: { id: data.itemId, organizationId: orgId, status: "ACTIVE" },
      select: { id: true, name: true },
    }),
    db.warehouse.findFirst({
      where: { id: data.warehouseId, organizationId: orgId, isArchived: false },
      select: { id: true, name: true },
    }),
    db.reasonCode.findFirst({
      where: { id: data.reasonCodeId, organizationId: orgId, isActive: true },
      select: { id: true, code: true, category: true },
    }),
  ]);

  if (!item) {
    return {
      ok: false,
      error: "Item not found",
      fieldErrors: { itemId: ["Invalid item"] },
    };
  }
  if (!warehouse) {
    return {
      ok: false,
      error: "Warehouse not found",
      fieldErrors: { warehouseId: ["Invalid warehouse"] },
    };
  }
  if (!reasonCode) {
    return {
      ok: false,
      error: "Reason code not found",
      fieldErrors: { reasonCodeId: ["Invalid reason code"] },
    };
  }

  // Check that the quantity is available at the fromStatus
  const currentLevel = await db.stockLevel.findFirst({
    where: {
      organizationId: orgId,
      itemId: data.itemId,
      warehouseId: data.warehouseId,
      binId: data.binId ?? undefined,
      stockStatus: data.fromStatus,
    },
    select: { id: true, quantity: true },
  });

  if (!currentLevel || currentLevel.quantity < data.quantity) {
    return {
      ok: false,
      error: `Insufficient quantity available (${currentLevel?.quantity ?? 0} in stock)`,
      fieldErrors: { quantity: ["Not enough in stock"] },
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Create a STATUS_CHANGE movement to track the transition
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          itemId: data.itemId,
          warehouseId: data.warehouseId,
          type: "STATUS_CHANGE",
          quantity: data.quantity,
          direction: 1, // Direction is always +1 for status change (reference only)
          reference: `status-${data.fromStatus}-to-${data.toStatus}`,
          note: data.note ?? `Status change: ${data.fromStatus} → ${data.toStatus}`,
          createdByUserId: session.user.id,
          reasonCodeId: data.reasonCodeId,
        },
        select: { id: true },
      });

      // Decrease from the old status
      await upsertStockLevel(tx, {
        organizationId: orgId,
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        binId: data.binId ?? null,
        stockStatus: data.fromStatus,
        quantityDelta: -data.quantity,
      });

      // Increase at the new status
      await upsertStockLevel(tx, {
        organizationId: orgId,
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        binId: data.binId ?? null,
        stockStatus: data.toStatus,
        quantityDelta: data.quantity,
      });

      return movement;
    });

    revalidateInventory();
    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock.status_changed",
      entityType: "stock_level",
      entityId: `${data.itemId}-${data.warehouseId}`,
      metadata: {
        itemId: data.itemId,
        itemName: item.name,
        warehouseId: data.warehouseId,
        warehouseName: warehouse.name,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        quantity: data.quantity,
        reasonCode: reasonCode.code,
        movementId: result.id,
      },
    });

    return { ok: true, movementId: result.id, updatedQuantity: data.quantity };
  } catch (error) {
    return { ok: false, error: "Failed to update stock status" };
  }
}
