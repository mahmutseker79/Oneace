"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability, planCapabilityError } from "@/lib/plans";
import {
  canAddLines,
  canAllocate,
  canCancel,
  canRemoveLines,
  canShip,
} from "@/lib/sales-order/machine";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  addSalesOrderLineSchema,
  allocateSalesOrderSchema,
  cancelSalesOrderSchema,
  createSalesOrderSchema,
  shipSalesOrderSchema,
} from "@/lib/validation/sales-order";

export type { ActionResult };

const SO_NUMBER_PAD = 6;

async function nextSoNumber(orgId: string, tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.salesOrder.count({
    where: { organizationId: orgId },
  });
  return `SO-${String(count + 1).padStart(SO_NUMBER_PAD, "0")}`;
}

export async function createSalesOrderAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "salesOrders.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  if (
    !hasPlanCapability(membership.organization.plan as "FREE" | "PRO" | "BUSINESS", "salesOrders")
  ) {
    return { ok: false, error: planCapabilityError("salesOrders") };
  }

  const raw: Record<string, unknown> = Object.fromEntries(formData);
  for (const key of Object.keys(raw)) {
    if (raw[key] === "__none__") raw[key] = "";
  }

  const parsed = createSalesOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.createFailed ?? "Failed to create sales order",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const result = await db.$transaction(async (tx) => {
        const orderNumber = input.orderNumber ?? (await nextSoNumber(orgId, tx));
        return tx.salesOrder.create({
          data: {
            organizationId: orgId,
            orderNumber,
            customerName: input.customerName,
            customerRef: input.customerRef,
            status: "DRAFT",
            requiredDate: input.requiredDate,
            note: input.note,
            createdByUserId: session.user.id,
          },
          select: { id: true },
        });
      });

      await recordAudit({
        organizationId: orgId,
        actorId: session.user.id,
        action: "sales_order.created",
        entityType: "sales_order",
        entityId: result.id,
        metadata: {
          customerName: input.customerName,
          orderNumber: input.orderNumber ?? "(auto-generated)",
        },
      });

      revalidatePath("/sales-orders");
      return { ok: true, id: result.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        if (input.orderNumber === null) continue;
        return {
          ok: false,
          error: t.salesOrders?.errors?.orderNumberExists ?? "Order number already exists",
          fieldErrors: {
            orderNumber: [
              t.salesOrders?.errors?.orderNumberExists ?? "Order number already exists",
            ],
          },
        };
      }
      return {
        ok: false,
        error: t.salesOrders?.errors?.createFailed ?? "Failed to create sales order",
      };
    }
  }
  return {
    ok: false,
    error: t.salesOrders?.errors?.createFailed ?? "Failed to create sales order",
  };
}

export async function addSalesOrderLineAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "salesOrders.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const raw: Record<string, unknown> = Object.fromEntries(formData);
  for (const key of Object.keys(raw)) {
    if (raw[key] === "__none__") raw[key] = "";
  }

  const parsed = addSalesOrderLineSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.addLineFailed ?? "Failed to add line",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  const existing = await db.salesOrder.findFirst({
    where: { id: input.salesOrderId, organizationId: orgId },
    select: { id: true, status: true },
  });

  if (!existing) {
    return { ok: false, error: t.salesOrders?.errors?.notFound ?? "Sales order not found" };
  }

  if (!canAddLines(existing.status)) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.notEditable ?? "Cannot add lines to this order",
    };
  }

  try {
    const [item, warehouse] = await Promise.all([
      db.item.findFirst({
        where: { id: input.itemId, organizationId: orgId },
        select: { id: true },
      }),
      db.warehouse.findFirst({
        where: { id: input.warehouseId, organizationId: orgId },
        select: { id: true },
      }),
    ]);

    if (!item || !warehouse) {
      return {
        ok: false,
        error: t.salesOrders?.errors?.addLineFailed ?? "Item or warehouse not found",
      };
    }

    await db.salesOrderLine.create({
      data: {
        organizationId: orgId,
        salesOrderId: input.salesOrderId,
        itemId: input.itemId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        orderedQty: input.orderedQty,
        note: input.note,
      },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "sales_order.line_added",
      entityType: "sales_order",
      entityId: input.salesOrderId,
      metadata: { itemId: input.itemId, orderedQty: input.orderedQty },
    });

    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${input.salesOrderId}`);
    return { ok: true, id: input.salesOrderId };
  } catch (_error) {
    return { ok: false, error: t.salesOrders?.errors?.addLineFailed ?? "Failed to add line" };
  }
}

export async function removeSalesOrderLineAction(lineId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "salesOrders.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  const line = await db.salesOrderLine.findFirst({
    where: { id: lineId },
    select: { salesOrderId: true, salesOrder: { select: { organizationId: true, status: true } } },
  });

  if (!line || line.salesOrder.organizationId !== orgId) {
    return { ok: false, error: t.salesOrders?.errors?.notFound ?? "Line not found" };
  }

  if (!canRemoveLines(line.salesOrder.status)) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.notEditable ?? "Cannot remove lines from this order",
    };
  }

  try {
    await db.salesOrderLine.delete({ where: { id: lineId } });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "sales_order.line_removed",
      entityType: "sales_order",
      entityId: line.salesOrderId,
      metadata: { lineId },
    });

    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${line.salesOrderId}`);
    return { ok: true, id: line.salesOrderId };
  } catch (_error) {
    return { ok: false, error: t.salesOrders?.errors?.deleteLineFailed ?? "Failed to remove line" };
  }
}

export async function confirmSalesOrderAction(orderId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "salesOrders.confirm")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;
  const existing = await db.salesOrder.findFirst({
    where: { id: orderId, organizationId: orgId },
    select: { id: true, status: true, orderNumber: true, lines: { select: { id: true } } },
  });

  if (!existing)
    return { ok: false, error: t.salesOrders?.errors?.notFound ?? "Sales order not found" };
  if (existing.status !== "DRAFT") {
    return { ok: false, error: t.salesOrders?.errors?.notEditable ?? "Cannot confirm this order" };
  }
  if (existing.lines.length === 0) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.noLines ?? "Order must have at least one line",
    };
  }

  await db.salesOrder.update({
    where: { id: orderId, organizationId: orgId },
    data: { status: "CONFIRMED" },
  });

  await recordAudit({
    organizationId: orgId,
    actorId: session.user.id,
    action: "sales_order.confirmed",
    entityType: "sales_order",
    entityId: orderId,
    metadata: { orderNumber: existing.orderNumber, from: "DRAFT", to: "CONFIRMED" },
  });

  revalidatePath("/sales-orders");
  revalidatePath(`/sales-orders/${orderId}`);
  return { ok: true, id: orderId };
}

export async function allocateSalesOrderAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "salesOrders.allocate")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = allocateSalesOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.allocateFailed ?? "Failed to allocate",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  const existing = await db.salesOrder.findFirst({
    where: { id: input.salesOrderId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      lines: {
        select: { id: true, itemId: true, warehouseId: true, orderedQty: true, allocatedQty: true },
      },
    },
  });

  if (!existing)
    return { ok: false, error: t.salesOrders?.errors?.notFound ?? "Sales order not found" };
  if (!canAllocate(existing.status)) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.cannotAllocate ?? "Cannot allocate this order",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      // Check stock availability for all lines
      for (const line of existing.lines) {
        const stock = await tx.stockLevel.findFirst({
          where: {
            itemId: line.itemId,
            warehouseId: line.warehouseId,
          },
          select: { quantity: true, reservedQty: true },
        });

        const available = (stock?.quantity ?? 0) - (stock?.reservedQty ?? 0);
        const needed = line.orderedQty - line.allocatedQty;

        if (available < needed) {
          throw new Error(`Insufficient stock for item ${line.itemId}`);
        }
      }

      // All checks passed, allocate all lines
      for (const line of existing.lines) {
        const needed = line.orderedQty - line.allocatedQty;
        if (needed > 0) {
          // Increment reserved qty
          await upsertStockLevel(tx, {
            organizationId: orgId,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            quantityDelta: 0, // Don't change quantity
          });

          const stock = await tx.stockLevel.findFirst({
            where: { itemId: line.itemId, warehouseId: line.warehouseId },
            select: { id: true, reservedQty: true },
          });

          if (stock) {
            await tx.stockLevel.update({
              where: { id: stock.id },
              data: { reservedQty: (stock.reservedQty ?? 0) + needed },
            });
          }

          // Update line allocated qty
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: { allocatedQty: line.orderedQty },
          });
        }
      }

      // Transition to ALLOCATED
      await tx.salesOrder.update({
        where: { id: existing.id, organizationId: orgId },
        data: { status: "ALLOCATED" },
      });
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "sales_order.allocated",
      entityType: "sales_order",
      entityId: existing.id,
      metadata: { orderNumber: existing.orderNumber, lineCount: existing.lines.length },
    });

    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${existing.id}`);
    return { ok: true, id: existing.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Insufficient stock")) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: t.salesOrders?.errors?.allocateFailed ?? "Failed to allocate" };
  }
}

export async function shipSalesOrderAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "salesOrders.ship")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const raw: Record<string, unknown> = Object.fromEntries(formData);
  const linesRaw = raw.lines;
  let lines: unknown[] = [];
  if (typeof linesRaw === "string") {
    try {
      lines = JSON.parse(linesRaw);
    } catch {
      return { ok: false, error: t.salesOrders?.errors?.shipFailed ?? "Failed to ship" };
    }
  }

  const parsed = shipSalesOrderSchema.safeParse({
    salesOrderId: raw.salesOrderId,
    lines,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.shipFailed ?? "Failed to ship",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  const existing = await db.salesOrder.findFirst({
    where: { id: input.salesOrderId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      lines: {
        select: {
          id: true,
          itemId: true,
          warehouseId: true,
          allocatedQty: true,
          shippedQty: true,
          orderedQty: true,
        },
      },
    },
  });

  if (!existing)
    return { ok: false, error: t.salesOrders?.errors?.notFound ?? "Sales order not found" };
  if (!canShip(existing.status)) {
    return { ok: false, error: t.salesOrders?.errors?.cannotShip ?? "Cannot ship this order" };
  }

  try {
    await db.$transaction(async (tx) => {
      const lineMap = new Map(existing.lines.map((l: (typeof existing.lines)[0]) => [l.id, l]));

      for (const shipLine of input.lines) {
        const line = lineMap.get(shipLine.lineId);
        if (!line) continue;

        const shipped = line.shippedQty;
        const allocated = line.allocatedQty;
        const delta = shipLine.shippedQty - shipped;

        if (delta < 0 || shipLine.shippedQty > allocated) {
          throw new Error(`Invalid shipment quantity for line ${shipLine.lineId}`);
        }

        if (delta > 0) {
          // Create ISSUE movement
          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              itemId: line.itemId,
              warehouseId: line.warehouseId,
              type: "ISSUE",
              quantity: delta,
              direction: -1,
              reference: `SO-${existing.orderNumber}`,
              note: "Sales order shipment",
              createdByUserId: session.user.id,
            },
          });

          // Decrement both quantity and reservedQty
          const stock = await tx.stockLevel.findFirst({
            where: { itemId: line.itemId, warehouseId: line.warehouseId },
            select: { id: true, quantity: true, reservedQty: true },
          });

          if (stock) {
            await tx.stockLevel.update({
              where: { id: stock.id },
              data: {
                quantity: Math.max(0, stock.quantity - delta),
                reservedQty: Math.max(0, (stock.reservedQty ?? 0) - delta),
              },
            });
          }

          // Update line
          await tx.salesOrderLine.update({
            where: { id: shipLine.lineId },
            data: { shippedQty: shipLine.shippedQty },
          });
        }
      }

      // Recompute status
      const refreshed = await tx.salesOrder.findUnique({
        where: { id: existing.id },
        select: { lines: { select: { orderedQty: true, shippedQty: true } } },
      });

      const allLines = refreshed?.lines ?? [];
      const allShipped = allLines.length > 0 && allLines.every((l) => l.shippedQty >= l.orderedQty);
      const anyShipped = allLines.some((l) => l.shippedQty > 0);

      const nextStatus = allShipped
        ? "SHIPPED"
        : anyShipped
          ? "PARTIALLY_SHIPPED"
          : existing.status;

      await tx.salesOrder.update({
        where: { id: existing.id, organizationId: orgId },
        data: {
          status: nextStatus,
          shippedAt: allShipped ? new Date() : null,
        },
      });
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "sales_order.shipped",
      entityType: "sales_order",
      entityId: existing.id,
      metadata: {
        orderNumber: existing.orderNumber,
        lineCount: input.lines.length,
      },
    });

    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${existing.id}`);
    // Ship creates ISSUE movements and updates stock levels — bust caches
    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath("/dashboard");
    return { ok: true, id: existing.id };
  } catch (_error) {
    return { ok: false, error: t.salesOrders?.errors?.shipFailed ?? "Failed to ship" };
  }
}

export async function cancelSalesOrderAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "salesOrders.cancel")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = cancelSalesOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.salesOrders?.errors?.cancelFailed ?? "Failed to cancel",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  const existing = await db.salesOrder.findFirst({
    where: { id: input.salesOrderId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      lines: {
        select: { id: true, itemId: true, warehouseId: true, allocatedQty: true },
      },
    },
  });

  if (!existing)
    return { ok: false, error: t.salesOrders?.errors?.notFound ?? "Sales order not found" };
  if (!canCancel(existing.status)) {
    return { ok: false, error: t.salesOrders?.errors?.cancelFailed ?? "Cannot cancel this order" };
  }

  try {
    await db.$transaction(async (tx) => {
      // Release allocations if ALLOCATED or PARTIALLY_SHIPPED
      if (existing.status === "ALLOCATED") {
        for (const line of existing.lines) {
          const stock = await tx.stockLevel.findFirst({
            where: { itemId: line.itemId, warehouseId: line.warehouseId },
            select: { id: true, reservedQty: true },
          });

          if (stock) {
            await tx.stockLevel.update({
              where: { id: stock.id },
              data: { reservedQty: Math.max(0, (stock.reservedQty ?? 0) - line.allocatedQty) },
            });
          }
        }
      }

      await tx.salesOrder.update({
        where: { id: existing.id, organizationId: orgId },
        data: { status: "CANCELLED" },
      });
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "sales_order.cancelled",
      entityType: "sales_order",
      entityId: existing.id,
      metadata: {
        orderNumber: existing.orderNumber,
        from: existing.status,
        reason: input.reason,
      },
    });

    revalidatePath("/sales-orders");
    revalidatePath(`/sales-orders/${existing.id}`);
    return { ok: true, id: existing.id };
  } catch (_error) {
    return { ok: false, error: t.salesOrders?.errors?.cancelFailed ?? "Failed to cancel" };
  }
}
