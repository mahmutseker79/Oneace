"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { canAddEntry, canCancel, canReconcile } from "@/lib/stockcount/machine";
import { calculateVariances } from "@/lib/stockcount/variance";
import {
  addEntryInputSchema,
  cancelCountInputSchema,
  completeCountInputSchema,
  createCountInputSchema,
} from "@/lib/validation/stockcount";

export type ActionResult<T extends object = { id: string }> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function cleanFieldErrors(raw: Record<string, string[] | undefined>): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value && value.length > 0) fieldErrors[key] = value;
  }
  return fieldErrors;
}

function revalidateCount(id: string) {
  revalidatePath("/stock-counts");
  revalidatePath(`/stock-counts/${id}`);
  revalidatePath(`/stock-counts/${id}/reconcile`);
}

/**
 * Create a stock count + frozen snapshot in a single transaction.
 *
 * The snapshot rows are the immutable "expected qty" reference that
 * reconcile measures variance against — we must freeze them inside the
 * same transaction as the StockCount insert so a concurrent movement
 * can't race us and skew the snapshot by one quantity.
 *
 * Scope rules:
 *   - warehouseId null → every warehouse owned by the org that has a
 *     stock level for the chosen item.
 *   - warehouseId set  → only that warehouse (if it's in the org).
 *
 * A (item, warehouse) pair with no StockLevel row is snapshotted with
 * `expectedQuantity = 0` so the counter can still record "I found X
 * units here" and reconcile will treat X as a positive variance.
 */
export async function createStockCountAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = createCountInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.stockCounts.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  const data = parsed.data;
  const orgId = membership.organizationId;

  // Validate warehouse belongs to org (if provided)
  let warehouseId: string | null = null;
  if (data.warehouseId) {
    const warehouse = await db.warehouse.findFirst({
      where: { id: data.warehouseId, organizationId: orgId, isArchived: false },
      select: { id: true },
    });
    if (!warehouse) {
      return {
        ok: false,
        error: t.stockCounts.errors.warehouseNotFound,
        fieldErrors: { warehouseId: [t.stockCounts.errors.warehouseNotFound] },
      };
    }
    warehouseId = warehouse.id;
  }

  // Validate every itemId belongs to the org. Drop ids that don't.
  const items = await db.item.findMany({
    where: {
      id: { in: data.itemIds },
      organizationId: orgId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (items.length === 0) {
    return {
      ok: false,
      error: t.stockCounts.errors.noValidItems,
      fieldErrors: { itemIds: [t.stockCounts.errors.noValidItems] },
    };
  }
  const itemIds = items.map((item) => item.id);

  // Resolve the warehouse set for the snapshot. When warehouseId is
  // null we snapshot every warehouse the org owns. Archived warehouses
  // are excluded — counting frozen inventory is nonsense.
  const warehouses = warehouseId
    ? [{ id: warehouseId }]
    : await db.warehouse.findMany({
        where: { organizationId: orgId, isArchived: false },
        select: { id: true },
        orderBy: { name: "asc" },
      });

  if (warehouses.length === 0) {
    return {
      ok: false,
      error: t.stockCounts.errors.noWarehouses,
    };
  }

  // Read current stock levels for the (item, warehouse) pairs we're
  // about to freeze. Anything missing defaults to 0.
  const stockLevels = await db.stockLevel.findMany({
    where: {
      organizationId: orgId,
      itemId: { in: itemIds },
      warehouseId: { in: warehouses.map((w) => w.id) },
    },
    select: { itemId: true, warehouseId: true, quantity: true },
  });
  const levelByKey = new Map<string, number>();
  for (const level of stockLevels) {
    levelByKey.set(`${level.itemId}::${level.warehouseId}`, level.quantity);
  }

  const snapshotRows = itemIds.flatMap((itemId) =>
    warehouses.map((warehouse) => ({
      organizationId: orgId,
      itemId,
      warehouseId: warehouse.id,
      expectedQuantity: levelByKey.get(`${itemId}::${warehouse.id}`) ?? 0,
    })),
  );

  try {
    const count = await db.$transaction(async (tx) => {
      const created = await tx.stockCount.create({
        data: {
          organizationId: orgId,
          warehouseId,
          name: data.name,
          methodology: data.methodology,
          state: "OPEN",
          createdByUserId: session.user.id,
        },
        select: { id: true },
      });

      // createMany is the fastest path — ~10k rows stays well inside
      // Postgres's parameter budget when we only send 4 columns per row.
      await tx.countSnapshot.createMany({
        data: snapshotRows.map((row) => ({ ...row, countId: created.id })),
      });

      return created;
    });

    revalidatePath("/stock-counts");
    return { ok: true, id: count.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: t.stockCounts.errors.duplicate };
    }
    return { ok: false, error: t.stockCounts.errors.createFailed };
  }
}

/**
 * Append a counted-qty entry to an open or in-progress count.
 *
 * First entry auto-transitions OPEN → IN_PROGRESS, and we stamp
 * `startedAt` at the same moment. The (item, warehouse) pair must
 * exist in the count's snapshot — we refuse entries for rows that
 * weren't part of the original scope to keep the audit trail honest.
 */
export async function addCountEntryAction(
  input: unknown,
): Promise<ActionResult<{ entryId: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = addEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.stockCounts.errors.entryFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  const data = parsed.data;
  const orgId = membership.organizationId;

  const count = await db.stockCount.findFirst({
    where: { id: data.countId, organizationId: orgId },
    select: { id: true, state: true },
  });
  if (!count) {
    return { ok: false, error: t.stockCounts.errors.notFound };
  }
  if (!canAddEntry(count.state)) {
    return { ok: false, error: t.stockCounts.errors.notEditable };
  }

  // Confirm (item, warehouse) is actually part of this count's scope.
  const snapshot = await db.countSnapshot.findFirst({
    where: {
      countId: data.countId,
      itemId: data.itemId,
      warehouseId: data.warehouseId,
    },
    select: { id: true },
  });
  if (!snapshot) {
    return {
      ok: false,
      error: t.stockCounts.errors.outOfScope,
      fieldErrors: { itemId: [t.stockCounts.errors.outOfScope] },
    };
  }

  try {
    const entry = await db.$transaction(async (tx) => {
      const created = await tx.countEntry.create({
        data: {
          organizationId: orgId,
          countId: data.countId,
          itemId: data.itemId,
          warehouseId: data.warehouseId,
          countedQuantity: data.countedQuantity,
          counterTag: data.counterTag,
          note: data.note,
          countedByUserId: session.user.id,
        },
        select: { id: true },
      });

      if (count.state === "OPEN") {
        await tx.stockCount.update({
          where: { id: data.countId },
          data: { state: "IN_PROGRESS", startedAt: new Date() },
        });
      }

      return created;
    });

    revalidateCount(data.countId);
    return { ok: true, entryId: entry.id };
  } catch {
    return { ok: false, error: t.stockCounts.errors.entryFailed };
  }
}

/**
 * Terminal cancel. Snapshot + entries stay on disk so auditors can
 * see what was in scope when the count was aborted.
 */
export async function cancelStockCountAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = cancelCountInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.stockCounts.errors.cancelFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  const data = parsed.data;
  const orgId = membership.organizationId;

  const count = await db.stockCount.findFirst({
    where: { id: data.countId, organizationId: orgId },
    select: { id: true, state: true },
  });
  if (!count) return { ok: false, error: t.stockCounts.errors.notFound };
  if (!canCancel(count.state)) {
    return { ok: false, error: t.stockCounts.errors.notEditable };
  }

  try {
    await db.stockCount.update({
      where: { id: count.id },
      data: {
        state: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: data.reason,
      },
    });
    revalidateCount(count.id);
    return { ok: true, id: count.id };
  } catch {
    return { ok: false, error: t.stockCounts.errors.cancelFailed };
  }
}

/**
 * Reconcile: transition IN_PROGRESS → COMPLETED and optionally post
 * ledger adjustments for every non-zero variance.
 *
 * The variance calculation runs through the SAME pure
 * `calculateVariances` function the client uses on the reconcile preview
 * — this is what makes the preview match the post result byte-for-byte.
 *
 * Positive variance (counted > expected) → +ADJUSTMENT, direction +1
 * Negative variance (counted < expected) → -ADJUSTMENT, direction -1
 * Zero variance rows are skipped entirely (no movement created).
 *
 * Every posted movement carries `reference = count-<id>` so the ledger
 * can be filtered by reconcile source, and updates StockLevel in the
 * same transaction. The whole thing is atomic — a mid-reconcile crash
 * can never leave the count half-completed.
 */
export async function completeStockCountAction(
  input: unknown,
): Promise<ActionResult<{ id: string; postedMovements: number }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = completeCountInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.stockCounts.errors.completeFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }
  const data = parsed.data;
  const orgId = membership.organizationId;

  const count = await db.stockCount.findFirst({
    where: { id: data.countId, organizationId: orgId },
    include: {
      snapshots: {
        select: {
          itemId: true,
          warehouseId: true,
          expectedQuantity: true,
        },
      },
      entries: {
        select: {
          itemId: true,
          warehouseId: true,
          countedQuantity: true,
        },
      },
    },
  });
  if (!count) return { ok: false, error: t.stockCounts.errors.notFound };
  if (!canReconcile(count.state)) {
    return { ok: false, error: t.stockCounts.errors.notReconcilable };
  }

  const variances = calculateVariances(count.snapshots, count.entries);
  const postable = data.applyAdjustments ? variances.filter((row) => row.variance !== 0) : [];

  try {
    const result = await db.$transaction(async (tx) => {
      for (const row of postable) {
        const quantity = Math.abs(row.variance);
        const direction = row.variance > 0 ? 1 : -1;
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            itemId: row.itemId,
            warehouseId: row.warehouseId,
            type: "ADJUSTMENT",
            quantity,
            direction,
            reference: `count-${count.id}`,
            note: `Stock count reconcile: ${count.name}`,
            createdByUserId: session.user.id,
          },
        });
        await tx.stockLevel.upsert({
          where: {
            itemId_warehouseId: {
              itemId: row.itemId,
              warehouseId: row.warehouseId,
            },
          },
          create: {
            organizationId: orgId,
            itemId: row.itemId,
            warehouseId: row.warehouseId,
            quantity: direction * quantity,
          },
          update: {
            quantity: { increment: direction * quantity },
          },
        });
      }
      await tx.stockCount.update({
        where: { id: count.id },
        data: { state: "COMPLETED", completedAt: new Date() },
      });
      return { posted: postable.length };
    });

    revalidateCount(count.id);
    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath("/dashboard");

    return { ok: true, id: count.id, postedMovements: result.posted };
  } catch {
    return { ok: false, error: t.stockCounts.errors.completeFailed };
  }
}
