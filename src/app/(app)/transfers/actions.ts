"use server";

import type { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { evaluateAlerts } from "@/lib/alerts";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";
import { canCancel, canReceive, canShip } from "@/lib/transfer/machine";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  type AddTransferLineInput,
  type CreateTransferInput,
  type ReceiveTransferInput,
  addTransferLineSchema,
  createTransferSchema,
  receiveTransferSchema,
} from "@/lib/validation/stock-transfer";

export type { ActionResult };

const TRANSFER_NUMBER_PAD = 6;

/**
 * Auto-generate next transfer number using OrgSettings.
 * Thread-safe within a transaction via optimistic locking.
 */
async function nextTransferNumber(orgId: string, tx: Prisma.TransactionClient): Promise<string> {
  const settings = await tx.orgSettings.findUnique({
    where: { organizationId: orgId },
    select: { transferNumberPrefix: true, transferNumberSequence: true },
  });

  if (!settings) {
    throw new Error("Organization settings not found");
  }

  const nextSeq = settings.transferNumberSequence + 1;
  await tx.orgSettings.update({
    where: { organizationId: orgId },
    data: { transferNumberSequence: nextSeq },
  });

  return `${settings.transferNumberPrefix}-${String(nextSeq).padStart(TRANSFER_NUMBER_PAD, "0")}`;
}

/**
 * Create a new transfer header with DRAFT status.
 * Returns the transfer ID; caller then adds lines via addTransferLine.
 */
export async function createTransferAction(input: CreateTransferInput): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "transfers.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createTransferSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.movements.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { fromWarehouseId, toWarehouseId, note } = parsed.data;
  const orgId = membership.organizationId;

  // Verify both warehouses exist in this org
  const [fromWh, toWh] = await Promise.all([
    db.warehouse.findFirst({
      where: { id: fromWarehouseId, organizationId: orgId },
      select: { id: true, name: true },
    }),
    db.warehouse.findFirst({
      where: { id: toWarehouseId, organizationId: orgId },
      select: { id: true, name: true },
    }),
  ]);

  if (!fromWh) {
    return {
      ok: false,
      error: t.movements.errors.warehouseNotFound,
      fieldErrors: { fromWarehouseId: [t.movements.errors.warehouseNotFound] },
    };
  }
  if (!toWh) {
    return {
      ok: false,
      error: t.movements.errors.destinationNotFound,
      fieldErrors: { toWarehouseId: [t.movements.errors.destinationNotFound] },
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const transferNumber = await nextTransferNumber(orgId, tx);

      const transfer = await tx.stockTransfer.create({
        data: {
          organizationId: orgId,
          transferNumber,
          fromWarehouseId,
          toWarehouseId,
          status: "DRAFT",
          note,
        },
        select: { id: true },
      });

      return transfer;
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_movement.created",
      entityType: "stock_movement",
      entityId: result.id,
      metadata: {
        type: "TRANSFER_HEADER",
        fromWarehouseId,
        fromWarehouseName: fromWh.name,
        toWarehouseId,
        toWarehouseName: toWh.name,
      },
    });

    revalidatePath("/transfers");
    return { ok: true, id: result.id };
  } catch (_error) {
    return { ok: false, error: t.movements.errors.createFailed };
  }
}

/**
 * Add a line to a DRAFT transfer.
 * Validates the transfer exists and is in DRAFT status.
 */
export async function addTransferLineAction(input: AddTransferLineInput): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "transfers.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = addTransferLineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.movements.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { transferId, itemId, variantId, batchId, serialNumberId, shippedQty } = parsed.data;
  const orgId = membership.organizationId;

  // Load transfer and verify it's DRAFT
  const transfer = await db.stockTransfer.findFirst({
    where: { id: transferId, organizationId: orgId },
    select: { id: true, status: true },
  });

  if (!transfer) {
    return { ok: false, error: t.movements.errors.notFound };
  }
  if (transfer.status !== "DRAFT") {
    return { ok: false, error: "Cannot add lines to a transfer that is not in DRAFT status" };
  }

  // Verify item exists
  const item = await db.item.findFirst({
    where: { id: itemId, organizationId: orgId },
    select: { id: true, name: true },
  });

  if (!item) {
    return {
      ok: false,
      error: t.movements.errors.itemNotFound,
      fieldErrors: { itemId: [t.movements.errors.itemNotFound] },
    };
  }

  try {
    const line = await db.stockTransferLine.create({
      data: {
        transferId,
        itemId,
        variantId: variantId ?? null,
        batchId: batchId ?? null,
        serialNumberId: serialNumberId ?? null,
        shippedQty,
        receivedQty: 0,
        discrepancy: 0,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_movement.created",
      entityType: "stock_movement",
      entityId: line.id,
      metadata: {
        type: "TRANSFER_LINE",
        transferId,
        itemId,
        itemName: item.name,
        shippedQty,
      },
    });

    revalidatePath("/transfers");
    revalidatePath(`/transfers/${transferId}`);
    return { ok: true, id: line.id };
  } catch (_error) {
    return { ok: false, error: t.movements.errors.createFailed };
  }
}

/**
 * Remove a line from a DRAFT transfer.
 * Validates the transfer is DRAFT before allowing deletion.
 */
export async function removeTransferLineAction(lineId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "transfers.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  // Load the line and its transfer
  const line = await db.stockTransferLine.findFirst({
    where: { id: lineId },
    select: {
      id: true,
      transferId: true,
      transfer: {
        select: { id: true, organizationId: true, status: true },
      },
    },
  });

  if (!line || line.transfer.organizationId !== orgId) {
    return { ok: false, error: t.movements.errors.notFound };
  }

  if (line.transfer.status !== "DRAFT") {
    return { ok: false, error: "Cannot remove lines from a transfer that is not in DRAFT status" };
  }

  try {
    await db.stockTransferLine.delete({
      where: { id: lineId },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_movement.created",
      entityType: "stock_movement",
      entityId: null,
      metadata: {
        type: "TRANSFER_LINE_REMOVED",
        transferId: line.transferId,
        lineId,
      },
    });

    revalidatePath("/transfers");
    revalidatePath(`/transfers/${line.transferId}`);
    return { ok: true, id: lineId };
  } catch (_error) {
    return { ok: false, error: t.movements.errors.createFailed };
  }
}

/**
 * Ship a transfer: validate DRAFT status, deduct from source warehouse,
 * transition to IN_TRANSIT, record shipment timestamp.
 */
export async function shipTransferAction(transferId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "transfers.ship")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  const transfer = await db.stockTransfer.findFirst({
    where: { id: transferId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      transferNumber: true,
      fromWarehouseId: true,
      toWarehouseId: true,
      lines: {
        select: {
          id: true,
          itemId: true,
          shippedQty: true,
        },
      },
    },
  });

  if (!transfer) {
    return { ok: false, error: t.movements.errors.notFound };
  }

  if (!canShip(transfer.status)) {
    return {
      ok: false,
      error: "Only DRAFT transfers can be shipped",
    };
  }

  if (transfer.lines.length === 0) {
    return {
      ok: false,
      error: "Transfer must have at least one line to ship",
    };
  }

  try {
    const affectedItemIds: string[] = [];

    await db.$transaction(async (tx) => {
      // For each line, deduct from source warehouse
      for (const line of transfer.lines) {
        // Create TRANSFER movement (direction -1 = debit)
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            itemId: line.itemId,
            warehouseId: transfer.fromWarehouseId,
            type: "TRANSFER",
            quantity: line.shippedQty,
            direction: -1,
            reference: transfer.transferNumber,
            createdByUserId: session.user.id,
          },
        });

        // Deduct from source
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: line.itemId,
          warehouseId: transfer.fromWarehouseId,
          quantityDelta: -line.shippedQty,
        });

        affectedItemIds.push(line.itemId);
      }

      // Transition to IN_TRANSIT
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: "IN_TRANSIT",
          shippedAt: new Date(),
          shippedByUserId: session.user.id,
        },
      });
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_movement.created",
      entityType: "stock_movement",
      entityId: transferId,
      metadata: {
        type: "TRANSFER_SHIPPED",
        transferNumber: transfer.transferNumber,
        lineCount: transfer.lines.length,
        totalQty: transfer.lines.reduce((sum, l) => sum + l.shippedQty, 0),
      },
    });

    // Fire-and-forget alert evaluation
    if (affectedItemIds.length > 0) {
      void evaluateAlerts(orgId, affectedItemIds);
    }

    revalidatePath("/transfers");
    revalidatePath(`/transfers/${transferId}`);
    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath("/dashboard");
    return { ok: true, id: transferId };
  } catch (_error) {
    return { ok: false, error: t.movements.errors.createFailed };
  }
}

/**
 * Receive a transfer: validate IN_TRANSIT status, add lines to destination
 * warehouse, record discrepancies, transition to RECEIVED.
 */
export async function receiveTransferAction(input: ReceiveTransferInput): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "transfers.receive")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = receiveTransferSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.movements.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { transferId, lines, note } = parsed.data;
  const orgId = membership.organizationId;

  const transfer = await db.stockTransfer.findFirst({
    where: { id: transferId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      transferNumber: true,
      fromWarehouseId: true,
      toWarehouseId: true,
      lines: {
        select: {
          id: true,
          itemId: true,
          shippedQty: true,
          receivedQty: true,
        },
      },
    },
  });

  if (!transfer) {
    return { ok: false, error: t.movements.errors.notFound };
  }

  if (!canReceive(transfer.status)) {
    return {
      ok: false,
      error: "Only IN_TRANSIT transfers can be received",
    };
  }

  // Build a map of lineId → receivedQty from input
  const receiveByLineId = new Map(lines.map((l) => [l.lineId, l.receivedQty]));

  // Validate all incoming lines belong to this transfer
  const lineMap = new Map(transfer.lines.map((l) => [l.id, l]));
  for (const [lineId] of receiveByLineId) {
    if (!lineMap.has(lineId)) {
      return { ok: false, error: "Invalid line ID in receive request" };
    }
  }

  try {
    const affectedItemIds: string[] = [];

    await db.$transaction(async (tx) => {
      for (const [lineId, receivedQty] of receiveByLineId) {
        const origLine = lineMap.get(lineId);
        if (!origLine) continue;

        const discrepancy = receivedQty - origLine.shippedQty;

        // Create TRANSFER movement (direction +1 = credit to destination)
        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            itemId: origLine.itemId,
            warehouseId: transfer.toWarehouseId,
            type: "TRANSFER",
            quantity: receivedQty,
            direction: 1,
            reference: transfer.transferNumber,
            note: note ?? null,
            createdByUserId: session.user.id,
          },
        });

        // Add to destination warehouse
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: origLine.itemId,
          warehouseId: transfer.toWarehouseId,
          quantityDelta: receivedQty,
        });

        // If there's a discrepancy, create an ADJUSTMENT movement
        if (discrepancy !== 0) {
          const adjustmentDirection = discrepancy > 0 ? 1 : -1;
          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              itemId: origLine.itemId,
              warehouseId: transfer.toWarehouseId,
              type: "ADJUSTMENT",
              quantity: Math.abs(discrepancy),
              direction: adjustmentDirection,
              reference: `${transfer.transferNumber}-DISC`,
              note: `Discrepancy from transfer receive: shipped ${origLine.shippedQty}, received ${receivedQty}`,
              createdByUserId: session.user.id,
            },
          });

          // Adjust stock for the discrepancy
          await upsertStockLevel(tx, {
            organizationId: orgId,
            itemId: origLine.itemId,
            warehouseId: transfer.toWarehouseId,
            quantityDelta: discrepancy,
          });
        }

        // Update line with received quantity and discrepancy
        await tx.stockTransferLine.update({
          where: { id: lineId },
          data: {
            receivedQty,
            discrepancy,
          },
        });

        affectedItemIds.push(origLine.itemId);
      }

      // Transition to RECEIVED
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: "RECEIVED",
          receivedAt: new Date(),
          receivedByUserId: session.user.id,
        },
      });
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_movement.created",
      entityType: "stock_movement",
      entityId: transferId,
      metadata: {
        type: "TRANSFER_RECEIVED",
        transferNumber: transfer.transferNumber,
        lineCount: lines.length,
        totalQty: lines.reduce((sum, l) => sum + l.receivedQty, 0),
      },
    });

    // Fire-and-forget alert evaluation
    if (affectedItemIds.length > 0) {
      void evaluateAlerts(orgId, affectedItemIds);
    }

    revalidatePath("/transfers");
    revalidatePath(`/transfers/${transferId}`);
    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath("/dashboard");
    return { ok: true, id: transferId };
  } catch (_error) {
    return { ok: false, error: t.movements.errors.createFailed };
  }
}

/**
 * Cancel a transfer: reverse deductions if IN_TRANSIT, set status to CANCELLED.
 */
export async function cancelTransferAction(transferId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "transfers.cancel")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  const transfer = await db.stockTransfer.findFirst({
    where: { id: transferId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      transferNumber: true,
      fromWarehouseId: true,
      toWarehouseId: true,
      lines: {
        select: {
          id: true,
          itemId: true,
          shippedQty: true,
          receivedQty: true,
        },
      },
    },
  });

  if (!transfer) {
    return { ok: false, error: t.movements.errors.notFound };
  }

  if (!canCancel(transfer.status)) {
    return {
      ok: false,
      error: "Only DRAFT, SHIPPED, and IN_TRANSIT transfers can be cancelled",
    };
  }

  try {
    const affectedItemIds: string[] = [];

    await db.$transaction(async (tx) => {
      // If IN_TRANSIT, reverse the source deductions
      if (transfer.status === "IN_TRANSIT" || transfer.status === "SHIPPED") {
        for (const line of transfer.lines) {
          // Create reverse TRANSFER movement to restore source
          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              itemId: line.itemId,
              warehouseId: transfer.fromWarehouseId,
              type: "TRANSFER",
              quantity: line.shippedQty,
              direction: 1, // reverse the -1 from shipping
              reference: `${transfer.transferNumber}-CANCEL`,
              createdByUserId: session.user.id,
            },
          });

          // Restore to source warehouse
          await upsertStockLevel(tx, {
            organizationId: orgId,
            itemId: line.itemId,
            warehouseId: transfer.fromWarehouseId,
            quantityDelta: line.shippedQty,
          });

          // If already received, reverse those too
          if (line.receivedQty > 0 && transfer.status === "IN_TRANSIT") {
            await tx.stockMovement.create({
              data: {
                organizationId: orgId,
                itemId: line.itemId,
                warehouseId: transfer.toWarehouseId,
                type: "TRANSFER",
                quantity: line.receivedQty,
                direction: -1, // reverse the +1 from receiving
                reference: `${transfer.transferNumber}-CANCEL`,
                createdByUserId: session.user.id,
              },
            });

            // Deduct from destination
            await upsertStockLevel(tx, {
              organizationId: orgId,
              itemId: line.itemId,
              warehouseId: transfer.toWarehouseId,
              quantityDelta: -line.receivedQty,
            });
          }

          affectedItemIds.push(line.itemId);
        }
      }

      // Set status to CANCELLED
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: "CANCELLED",
        },
      });
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "stock_movement.created",
      entityType: "stock_movement",
      entityId: transferId,
      metadata: {
        type: "TRANSFER_CANCELLED",
        transferNumber: transfer.transferNumber,
        wasStatus: transfer.status,
      },
    });

    // Fire-and-forget alert evaluation
    if (affectedItemIds.length > 0) {
      void evaluateAlerts(orgId, affectedItemIds);
    }

    revalidatePath("/transfers");
    revalidatePath(`/transfers/${transferId}`);
    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath("/dashboard");
    return { ok: true, id: transferId };
  } catch (_error) {
    return { ok: false, error: t.movements.errors.createFailed };
  }
}
