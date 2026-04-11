"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import {
  type PurchaseOrderOutput,
  purchaseOrderInputSchema,
  receivePurchaseOrderSchema,
} from "@/lib/validation/purchase-order";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export type ReceiveResult =
  | { ok: true; id: string; receivedLineCount: number; fullyReceived: boolean }
  | { ok: false; error: string };

const PO_NUMBER_PAD = 6;

async function nextPoNumber(orgId: string, tx: Prisma.TransactionClient): Promise<string> {
  // Simple monotonic counter — count existing PO rows + 1, zero-padded.
  // Good enough for single-writer inboxes; the caller retries on P2002 so a
  // rare race between two concurrent creates is self-healing.
  const count = await tx.purchaseOrder.count({
    where: { organizationId: orgId },
  });
  return `PO-${String(count + 1).padStart(PO_NUMBER_PAD, "0")}`;
}

function parseJsonLines(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function formToInput(formData: FormData) {
  const raw: Record<string, unknown> = Object.fromEntries(formData);
  raw.lines = parseJsonLines(raw.lines);
  // Normalise Radix Select "__none__" sentinel if present.
  for (const key of Object.keys(raw)) {
    if (raw[key] === "__none__") raw[key] = "";
  }
  return raw;
}

type ScopeFailure = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
};
type ScopeSuccess = {
  ok: true;
  costMap: Map<string, Prisma.Decimal>;
};

// Shared membership-scope guard for supplier + warehouse + line items.
// Returns a failure record on validation errors, or { ok: true, costMap }
// with a resolved map of itemId → Prisma.Decimal cost used for filling in
// null unitCost entries.
async function resolveOrgScope(
  orgId: string,
  input: PurchaseOrderOutput,
  t: Awaited<ReturnType<typeof getMessages>>,
): Promise<ScopeSuccess | ScopeFailure> {
  const [supplier, warehouse] = await Promise.all([
    db.supplier.findFirst({
      where: { id: input.supplierId, organizationId: orgId },
      select: { id: true },
    }),
    db.warehouse.findFirst({
      where: { id: input.warehouseId, organizationId: orgId },
      select: { id: true },
    }),
  ]);

  if (!supplier) {
    return {
      ok: false,
      error: t.purchaseOrders.errors.supplierNotFound,
      fieldErrors: { supplierId: [t.purchaseOrders.errors.supplierNotFound] },
    };
  }
  if (!warehouse) {
    return {
      ok: false,
      error: t.purchaseOrders.errors.warehouseNotFound,
      fieldErrors: { warehouseId: [t.purchaseOrders.errors.warehouseNotFound] },
    };
  }

  const uniqueItemIds = Array.from(new Set(input.lines.map((l) => l.itemId)));
  const items = await db.item.findMany({
    where: { id: { in: uniqueItemIds }, organizationId: orgId },
    select: { id: true, costPrice: true },
  });
  if (items.length !== uniqueItemIds.length) {
    return {
      ok: false,
      error: t.purchaseOrders.errors.itemNotFound,
      fieldErrors: { lines: [t.purchaseOrders.errors.itemNotFound] },
    };
  }

  const costMap = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    costMap.set(item.id, item.costPrice ?? new Prisma.Decimal(0));
  }
  return { ok: true, costMap };
}

export async function createPurchaseOrderAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = purchaseOrderInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    const rawFieldErrors = parsed.error.flatten().fieldErrors;
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(rawFieldErrors)) {
      if (value && value.length > 0) fieldErrors[key] = value;
    }
    return { ok: false, error: t.purchaseOrders.errors.createFailed, fieldErrors };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  const scope = await resolveOrgScope(orgId, input, t);
  if (!scope.ok) {
    return scope;
  }
  const { costMap } = scope;

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const result = await db.$transaction(async (tx) => {
        const poNumber = input.poNumber ?? (await nextPoNumber(orgId, tx));
        const created = await tx.purchaseOrder.create({
          data: {
            organizationId: orgId,
            supplierId: input.supplierId,
            warehouseId: input.warehouseId,
            poNumber,
            status: input.status,
            currency: input.currency,
            orderedAt: input.orderDate ?? new Date(),
            expectedAt: input.expectedDate,
            notes: input.notes,
            createdByUserId: session.user.id,
            lines: {
              create: input.lines.map((line) => ({
                organizationId: orgId,
                itemId: line.itemId,
                orderedQty: line.quantity,
                unitCost:
                  line.unitCost !== null
                    ? new Prisma.Decimal(line.unitCost)
                    : (costMap.get(line.itemId) ?? new Prisma.Decimal(0)),
                note: line.notes,
              })),
            },
          },
          select: { id: true },
        });
        return created;
      });

      revalidatePath("/purchase-orders");
      return { ok: true, id: result.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // poNumber collision — only retry when we're auto-generating.
        if (input.poNumber === null) continue;
        return {
          ok: false,
          error: t.purchaseOrders.errors.poNumberExists,
          fieldErrors: { poNumber: [t.purchaseOrders.errors.poNumberExists] },
        };
      }
      return { ok: false, error: t.purchaseOrders.errors.createFailed };
    }
  }
  return { ok: false, error: t.purchaseOrders.errors.createFailed };
}

export async function updatePurchaseOrderAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = purchaseOrderInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    const rawFieldErrors = parsed.error.flatten().fieldErrors;
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(rawFieldErrors)) {
      if (value && value.length > 0) fieldErrors[key] = value;
    }
    return { ok: false, error: t.purchaseOrders.errors.updateFailed, fieldErrors };
  }
  const input = parsed.data;
  const orgId = membership.organizationId;

  const existing = await db.purchaseOrder.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return { ok: false, error: t.purchaseOrders.errors.notFound };
  }
  if (existing.status !== "DRAFT" && existing.status !== "SENT") {
    return { ok: false, error: t.purchaseOrders.errors.notEditable };
  }

  const scope = await resolveOrgScope(orgId, input, t);
  if (!scope.ok) {
    return scope;
  }
  const { costMap } = scope;

  try {
    await db.$transaction(async (tx) => {
      await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrder.update({
        where: { id, organizationId: orgId },
        data: {
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          currency: input.currency,
          orderedAt: input.orderDate ?? undefined,
          expectedAt: input.expectedDate,
          notes: input.notes,
          status: input.status,
          ...(input.poNumber !== null ? { poNumber: input.poNumber } : {}),
          lines: {
            create: input.lines.map((line) => ({
              organizationId: orgId,
              itemId: line.itemId,
              orderedQty: line.quantity,
              unitCost:
                line.unitCost !== null
                  ? new Prisma.Decimal(line.unitCost)
                  : (costMap.get(line.itemId) ?? new Prisma.Decimal(0)),
              note: line.notes,
            })),
          },
        },
      });
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${id}`);
    revalidatePath(`/purchase-orders/${id}/edit`);
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: t.purchaseOrders.errors.poNumberExists,
          fieldErrors: { poNumber: [t.purchaseOrders.errors.poNumberExists] },
        };
      }
      if (error.code === "P2025") {
        return { ok: false, error: t.purchaseOrders.errors.notFound };
      }
    }
    return { ok: false, error: t.purchaseOrders.errors.updateFailed };
  }
}

export async function markPurchaseOrderSentAction(id: string): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const existing = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, error: t.purchaseOrders.errors.notFound };
  if (existing.status !== "DRAFT") {
    return { ok: false, error: t.purchaseOrders.errors.notEditable };
  }

  await db.purchaseOrder.update({
    where: { id, organizationId: membership.organizationId },
    data: { status: "SENT" },
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  return { ok: true, id };
}

export async function cancelPurchaseOrderAction(id: string): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const existing = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, error: t.purchaseOrders.errors.notFound };
  if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
    return { ok: false, error: t.purchaseOrders.errors.cancelFailed };
  }

  await db.purchaseOrder.update({
    where: { id, organizationId: membership.organizationId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  return { ok: true, id };
}

export async function deletePurchaseOrderAction(id: string): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const existing = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { id: true, status: true, lines: { select: { receivedQty: true } } },
  });
  if (!existing) return { ok: false, error: t.purchaseOrders.errors.notFound };

  // Safety: never delete a PO that already has received stock — the audit
  // trail matters more than tidiness. Draft-only deletes.
  if (existing.status !== "DRAFT") {
    return { ok: false, error: t.purchaseOrders.errors.deleteFailed };
  }
  if (existing.lines.some((line) => line.receivedQty > 0)) {
    return { ok: false, error: t.purchaseOrders.errors.deleteFailed };
  }

  await db.purchaseOrder.delete({
    where: { id, organizationId: membership.organizationId },
  });

  revalidatePath("/purchase-orders");
  return { ok: true, id };
}

/**
 * Receive stock against a purchase order. Transactional:
 *   1. Load the PO with all lines (scoped by org)
 *   2. Validate each incoming receipt against the remaining open qty
 *   3. For every non-zero delta:
 *      a. Create a StockMovement(type=RECEIPT, quantity=delta, direction=+1)
 *         referencing this PO via `reference` field
 *      b. Upsert the destination StockLevel
 *      c. Increment PurchaseOrderLine.receivedQty
 *   4. Recompute PO status — RECEIVED if every line is fully received,
 *      PARTIALLY_RECEIVED if at least one has > 0 received, DRAFT otherwise.
 */
export async function receivePurchaseOrderAction(formData: FormData): Promise<ReceiveResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const rawReceipts = formData.get("receipts");
  let receipts: unknown[] = [];
  if (typeof rawReceipts === "string") {
    try {
      const json = JSON.parse(rawReceipts);
      if (Array.isArray(json)) receipts = json;
    } catch {
      return { ok: false, error: t.purchaseOrders.errors.receiveFailed };
    }
  }

  const parsed = receivePurchaseOrderSchema.safeParse({
    purchaseOrderId: formData.get("purchaseOrderId") ?? "",
    receipts,
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: t.purchaseOrders.errors.receiveFailed };
  }
  const input = parsed.data;
  const orgId = membership.organizationId;

  // Map of lineId → incoming quantity. Filter out zero rows so the UI can
  // submit the whole table without us creating no-op movements.
  const deltaByLine = new Map<string, number>();
  for (const r of input.receipts) {
    if (r.quantity > 0) deltaByLine.set(r.lineId, r.quantity);
  }
  if (deltaByLine.size === 0) {
    return { ok: false, error: t.purchaseOrders.errors.nothingToReceive };
  }

  const existing = await db.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      warehouseId: true,
      poNumber: true,
      lines: {
        select: {
          id: true,
          itemId: true,
          orderedQty: true,
          receivedQty: true,
        },
      },
    },
  });

  if (!existing) return { ok: false, error: t.purchaseOrders.errors.notFound };
  if (
    existing.status !== "SENT" &&
    existing.status !== "PARTIALLY_RECEIVED" &&
    existing.status !== "DRAFT"
  ) {
    return { ok: false, error: t.purchaseOrders.errors.notReceivable };
  }

  // Validate every incoming line belongs to this PO and doesn't overflow.
  const lineMap = new Map(existing.lines.map((line) => [line.id, line]));
  for (const [lineId, delta] of deltaByLine) {
    const line = lineMap.get(lineId);
    if (!line) {
      return { ok: false, error: t.purchaseOrders.errors.receiveFailed };
    }
    const open = line.orderedQty - line.receivedQty;
    if (delta > open) {
      return { ok: false, error: t.purchaseOrders.errors.receiveOverflow };
    }
  }

  try {
    const receivedLineCount = deltaByLine.size;
    const fullyReceived = await db.$transaction(async (tx) => {
      for (const [lineId, delta] of deltaByLine) {
        const line = lineMap.get(lineId);
        if (!line) continue; // unreachable — validated above

        await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            itemId: line.itemId,
            warehouseId: existing.warehouseId,
            type: "RECEIPT",
            quantity: delta,
            direction: 1,
            reference: existing.poNumber,
            note: input.notes,
            createdByUserId: session.user.id,
          },
        });

        await tx.stockLevel.upsert({
          where: {
            itemId_warehouseId: {
              itemId: line.itemId,
              warehouseId: existing.warehouseId,
            },
          },
          create: {
            organizationId: orgId,
            itemId: line.itemId,
            warehouseId: existing.warehouseId,
            quantity: delta,
          },
          update: { quantity: { increment: delta } },
        });

        await tx.purchaseOrderLine.update({
          where: { id: lineId },
          data: { receivedQty: { increment: delta } },
        });
      }

      // Recompute PO status from fresh totals
      const refreshed = await tx.purchaseOrder.findUnique({
        where: { id: existing.id },
        select: { lines: { select: { orderedQty: true, receivedQty: true } } },
      });
      const lines = refreshed?.lines ?? [];
      const allReceived = lines.length > 0 && lines.every((l) => l.receivedQty >= l.orderedQty);
      const anyReceived = lines.some((l) => l.receivedQty > 0);

      const nextStatus = allReceived
        ? "RECEIVED"
        : anyReceived
          ? "PARTIALLY_RECEIVED"
          : existing.status;

      await tx.purchaseOrder.update({
        where: { id: existing.id, organizationId: orgId },
        data: {
          status: nextStatus,
          receivedAt: allReceived ? new Date() : null,
        },
      });

      return allReceived;
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${existing.id}`);
    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath("/dashboard");

    return { ok: true, id: existing.id, receivedLineCount, fullyReceived };
  } catch {
    return { ok: false, error: t.purchaseOrders.errors.receiveFailed };
  }
}
