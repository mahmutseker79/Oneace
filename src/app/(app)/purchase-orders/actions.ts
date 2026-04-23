"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { evaluateAlerts } from "@/lib/alerts";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { logger } from "@/lib/logger";
// GOD MODE roadmap P0-04 rc3 — landed-cost allocation on receive.
// The allocator is a pure function (see src/lib/costing/landed.ts);
// PO header + line unit costs feed in, per-line allocations come out,
// the landedUnitCost value lands on StockMovement and the breakdown
// is persisted to LandedCostAllocation in the same transaction.
import {
  type AllocationBasis,
  type LandedPOLine,
  allocateLanded,
} from "@/lib/costing/landed";
// GOD MODE roadmap P0-01 (rc2): StockMovement inserts must flow through
// the postMovement seam so that future cost-attribution (ADR-001
// FIFO/WAC) and idempotency middleware hook in a single place.
import { postMovement } from "@/lib/movements";
// GOD MODE roadmap P0-02 (v1.6.1 rc2): receivePurchaseOrderAction wraps
// its body in withIdempotency keyed on submissionNonce. This is
// complementary to the existing Phase 6C line-level key derivation
// (see deriveReceiveIdempotencyKey): the line-level key protects the
// ledger from double rows even if the transaction retries; this
// wrapper caches the ActionResult so a client replay gets the exact
// same response without re-entering the transaction at all.
import {
  IdempotencyConflictError,
  IdempotencyInProgressError,
  withIdempotency,
} from "@/lib/idempotency/middleware";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability, planCapabilityError } from "@/lib/plans";
import { deriveReceiveIdempotencyKey } from "@/lib/purchase-orders/idempotency";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  type PurchaseOrderOutput,
  purchaseOrderInputSchema,
  receivePurchaseOrderSchema,
} from "@/lib/validation/purchase-order";

export type { ActionResult };

export type ReceiveResult =
  | { ok: true; id: string; receivedLineCount: number; fullyReceived: boolean }
  | { ok: false; error: string };

const PO_NUMBER_PAD = 6;

async function nextPoNumber(orgId: string, tx: Prisma.TransactionClient): Promise<string> {
  // Race-safety invariant (load-bearing — do not relax):
  //   count+1 is only safe because `createPurchaseOrderAction` wraps
  //   the transaction in a MAX_RETRIES=3 loop AND only continues that
  //   loop on P2002 when `input.poNumber === null` (i.e. auto-gen).
  //   A user-supplied poNumber short-circuits the retry — that's
  //   intentional: the user's explicit value cannot be "the next one".
  //   Two concurrent auto-gen creators will collide on P2002, and the
  //   retry will re-count and take the next slot. Single-writer
  //   inboxes only; concurrent PO creation at scale is Post-MVP.
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

  if (!hasCapability(membership.role, "purchaseOrders.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Phase 13.2 — purchase orders require PRO or BUSINESS
  const poPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(poPlan, "purchaseOrders")) {
    return { ok: false, error: planCapabilityError("purchaseOrders") };
  }

  const parsed = purchaseOrderInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.purchaseOrders.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
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

      await recordAudit({
        organizationId: orgId,
        actorId: session.user.id,
        action: "purchase_order.created",
        entityType: "purchase_order",
        entityId: result.id,
        metadata: {
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          status: input.status,
          lineCount: input.lines.length,
          currency: input.currency,
        },
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

  if (!hasCapability(membership.role, "purchaseOrders.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = purchaseOrderInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.purchaseOrders.errors.updateFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
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
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "purchaseOrders.send")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const existing = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { id: true, status: true, poNumber: true },
  });
  if (!existing) return { ok: false, error: t.purchaseOrders.errors.notFound };
  if (existing.status !== "DRAFT") {
    return { ok: false, error: t.purchaseOrders.errors.notEditable };
  }

  await db.purchaseOrder.update({
    where: { id, organizationId: membership.organizationId },
    data: { status: "SENT" },
  });
  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "purchase_order.sent",
    entityType: "purchase_order",
    entityId: existing.id,
    metadata: { poNumber: existing.poNumber, from: existing.status, to: "SENT" },
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  return { ok: true, id };
}

export async function cancelPurchaseOrderAction(id: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "purchaseOrders.cancel")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const existing = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { id: true, status: true, poNumber: true },
  });
  if (!existing) return { ok: false, error: t.purchaseOrders.errors.notFound };
  if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
    return { ok: false, error: t.purchaseOrders.errors.cancelFailed };
  }

  await db.purchaseOrder.update({
    where: { id, organizationId: membership.organizationId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "purchase_order.cancelled",
    entityType: "purchase_order",
    entityId: existing.id,
    metadata: { poNumber: existing.poNumber, from: existing.status },
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  return { ok: true, id };
}

export async function deletePurchaseOrderAction(id: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "purchaseOrders.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const existing = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: {
      id: true,
      status: true,
      poNumber: true,
      lines: { select: { receivedQty: true } },
    },
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
  // NOTE: entityId intentionally omitted — the PO row is gone; the
  // poNumber in metadata is the durable reference for the /audit reader.
  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "purchase_order.deleted",
    entityType: "purchase_order",
    entityId: null,
    metadata: { poNumber: existing.poNumber, wasStatus: existing.status },
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
 *
 * Phase 6C — replay protection:
 *   The receive form mints a stable per-mount `submissionNonce`
 *   (`crypto.randomUUID()`) and resubmits it on every retry. We
 *   derive a per-line idempotency key as
 *   `po-receive:<nonce>:<lineId>` and stamp each inserted
 *   `StockMovement` row with it. The compound
 *   `@@unique([organizationId, idempotencyKey])` index
 *   (already present in the schema) then guarantees that a replay
 *   cannot create duplicate movements.
 *
 *   Before opening the transaction, we pre-check the first derived
 *   key. If it's present, we short-circuit with a side-effect-free
 *   replay response: NO second transaction, NO second audit record,
 *   NO second revalidate. This is the whole point of the phase.
 *
 *   Replay protection is ONLY defended against retries from the
 *   SAME form mount. Two tabs open on the same PO mint DIFFERENT
 *   nonces and can still over-receive — that's the pre-existing
 *   multi-writer concurrency bug tracked below (single-writer
 *   receive inboxes only) and is explicitly out of Phase 6C scope.
 */
export async function receivePurchaseOrderAction(formData: FormData): Promise<ReceiveResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "purchaseOrders.receive")) {
    return { ok: false, error: t.permissions.forbidden };
  }

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
    submissionNonce: formData.get("submissionNonce") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: t.purchaseOrders.errors.receiveFailed };
  }
  const input = parsed.data;
  const orgId = membership.organizationId;
  const submissionNonce = input.submissionNonce;

  // P2-6 (audit v1.0 §5.13) — fail closed on a missing nonce.
  //
  // Pre-audit this branch only logged and continued, keeping the
  // legacy unprotected path alive for "older clients". In practice
  // the only client is our own receive form (which has shipped the
  // nonce since Phase 6C), and leaving the fallback open means
  // anyone who strips the field from a replayed request gets
  // unbounded duplicate receipts. Inventory integrity is the
  // guarantee this action exists to keep, so we refuse instead.
  //
  // Rollout: if a 3rd-party integration shows up that legitimately
  // cannot mint a nonce, the fix is to add a documented
  // service-account path with its own idempotency story — not to
  // reopen this hole.
  if (!submissionNonce) {
    logger.warn("po.receive: submission nonce missing — rejecting to preserve replay protection", {
      tag: "po.receive.nonce-missing",
      userId: session.user.id,
      orgId,
      purchaseOrderId: input.purchaseOrderId,
    });
    return { ok: false, error: t.purchaseOrders.errors.receiveFailed };
  }

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
      // GOD MODE roadmap P0-04 rc3 — pull the landed-cost header so
      // the allocator can distribute freight/duty/insurance/other
      // across lines on this receive cycle. All six fields are
      // nullable (pre-P0-04 POs didn't capture them); the allocator
      // short-circuits to zero-allocations when every component is
      // null / zero, so legacy POs receive exactly as before.
      freightCost: true,
      dutyCost: true,
      insuranceCost: true,
      otherLandedCost: true,
      landedAllocationBasis: true,
      lines: {
        select: {
          id: true,
          itemId: true,
          orderedQty: true,
          receivedQty: true,
          // P0-04 rc3 — unitCost is the BY_VALUE denominator seed
          // (extended value = unitCost × qty) and also the
          // purchaseUnitCost audit column on the resulting
          // StockMovement.
          unitCost: true,
        },
      },
    },
  });

  if (!existing) return { ok: false, error: t.purchaseOrders.errors.notFound };

  // Phase 6C — replay pre-check. If this submission nonce has
  // already been persisted, the whole batch ran (`db.$transaction`
  // below is atomic: either every movement row in the batch got
  // stamped with its derived key or none did). We short-circuit
  // here WITHOUT entering the transaction, WITHOUT re-auditing,
  // and WITHOUT re-revalidating. Deliberately we also skip the
  // status gate below on the replay branch — if the original
  // submission fully received the PO and flipped its status to
  // RECEIVED, a retry from the same form mount should still
  // report success, not "not receivable".
  const orderedLineIds = Array.from(deltaByLine.keys());
  const firstLineId = orderedLineIds[0];
  if (submissionNonce && firstLineId) {
    const sentinelKey = deriveReceiveIdempotencyKey(submissionNonce, firstLineId);
    const alreadyApplied = await db.stockMovement.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: orgId,
          idempotencyKey: sentinelKey,
        },
      },
      select: { id: true },
    });
    if (alreadyApplied) {
      return {
        ok: true,
        id: existing.id,
        receivedLineCount: deltaByLine.size,
        fullyReceived: existing.status === "RECEIVED",
      };
    }
  }

  if (
    existing.status !== "SENT" &&
    existing.status !== "PARTIALLY_RECEIVED" &&
    existing.status !== "DRAFT"
  ) {
    return { ok: false, error: t.purchaseOrders.errors.notReceivable };
  }

  // Validate every incoming line belongs to this PO and doesn't overflow.
  //
  // Pre-check note: this runs BEFORE the transaction opens. Moving it
  // inside would not make it race-safe — two concurrent receivers
  // could still both pass an inner SELECT before either UPDATE lands
  // — and would cost an extra round-trip per line. The accepted
  // posture today is single-writer receive inboxes. Concurrent
  // receive against the same PO line is Post-MVP; the fix then is
  // `SELECT ... FOR UPDATE` on the PO lines at tx open, not this
  // pre-check.
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
    // P0-02 idempotency wrapper. Keyed on submissionNonce (already
    // required above). Complements the existing Phase 6C line-level
    // key — this wrapper caches the full ActionResult so a client
    // replay avoids the transaction entirely.
    return await withIdempotency(
      {
        organizationId: orgId,
        actionName: "receivePurchaseOrder",
        key: submissionNonce,
        payload: {
          purchaseOrderId: input.purchaseOrderId,
          // Sort deltaByLine by lineId for a stable fingerprint even
          // if the UI orders receipts differently between attempts.
          receipts: Array.from(deltaByLine.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([lineId, quantity]) => ({ lineId, quantity })),
          notes: input.notes,
        },
      },
      async () => {
    const receivedLineCount = deltaByLine.size;
    // GOD MODE roadmap P0-04 rc3 — compute landed-cost allocation
    // against the FULL PO line structure (ordered qty × unit cost),
    // NOT this receive's deltas. Rationale: landedUnitCost is a
    // per-unit figure that must stay stable across successive
    // partial receives, and the allocator's rounding invariant
    // (sum === header total) only holds once per call. Per-partial
    // scaling happens below when we write the LandedCostAllocation
    // rows — each row carries the share that this receive cycle
    // materialized.
    const toNum = (d: unknown): number => (d == null ? 0 : Number(d));
    const hasLanded =
      toNum(existing.freightCost) > 0 ||
      toNum(existing.dutyCost) > 0 ||
      toNum(existing.insuranceCost) > 0 ||
      toNum(existing.otherLandedCost) > 0;
    const allocations = hasLanded
      ? allocateLanded(
          {
            freight: toNum(existing.freightCost),
            duty: toNum(existing.dutyCost),
            insurance: toNum(existing.insuranceCost),
            other: toNum(existing.otherLandedCost),
            basis: existing.landedAllocationBasis as AllocationBasis,
          },
          existing.lines.map(
            (l): LandedPOLine => ({
              id: l.id,
              unitCost: toNum(l.unitCost),
              qty: l.orderedQty,
            }),
          ),
        )
      : null;
    const fullyReceived = await db.$transaction(async (tx) => {
      // Sprint 4: Lock PO lines with SELECT FOR UPDATE to prevent
      // double-receive from concurrent tabs. Two tabs would each get
      // a different submissionNonce, bypassing idempotency, and both
      // increment receivedQty. The lock ensures serialized access.
      const lockedLines = await tx.$queryRaw<
        Array<{
          id: string;
          itemId: string;
          orderedQty: number;
          receivedQty: number;
        }>
      >`
        SELECT id, "itemId", "orderedQty", "receivedQty"
        FROM "PurchaseOrderLine"
        WHERE "purchaseOrderId" = ${existing.id}
        FOR UPDATE
      `;
      const freshLineMap = new Map(lockedLines.map((l) => [l.id, l]));

      // Re-validate with locked (fresh) data — catches concurrent overwrites
      for (const [lineId, delta] of deltaByLine) {
        const freshLine = freshLineMap.get(lineId);
        if (!freshLine) throw new Error("Line not found after lock");
        const open = freshLine.orderedQty - freshLine.receivedQty;
        if (delta > open)
          throw new Error("Receive overflow after lock (concurrent receive detected)");
      }

      for (const [lineId, delta] of deltaByLine) {
        const line = freshLineMap.get(lineId);
        if (!line) continue;

        // P0-04 rc3 — per-line cost figures.
        // purchaseUnitCost is the original supplier price (audit).
        // landedUnitCost is the allocator's per-unit output; falls
        // back to purchaseUnitCost when the PO has no landed-cost
        // header.
        const poLine = existing.lines.find((l) => l.id === lineId);
        const purchaseUnitCost = toNum(poLine?.unitCost);
        const allocation = allocations?.get(lineId);
        const landedUnitCost = allocation?.landedUnitCost ?? purchaseUnitCost;

        // rc2: migrated from direct `tx.stockMovement.create(...)` to
        // the seam. Shape is identical; the seam drops unknown forward-
        // compat fields and fires the cost-posting hook (no-op today,
        // ADR-001 FIFO/WAC when Phase 1c ships).
        // rc3: populates P0-04 cost-audit columns on the movement.
        const created = await postMovement(tx, {
          organizationId: orgId,
          itemId: line.itemId,
          warehouseId: existing.warehouseId,
          type: "RECEIPT",
          quantity: delta,
          direction: 1,
          reference: existing.poNumber,
          note: input.notes,
          createdByUserId: session.user.id,
          // Phase 5A — source-document backref. Lets the ledger join
          // back to the originating PO line without parsing
          // `reference`. Historical rows (pre-Phase-5A) remain null.
          purchaseOrderLineId: lineId,
          // Phase 6C — replay protection. Derived from the
          // client-minted per-form-mount nonce and the line id so
          // the compound unique index
          // `@@unique([organizationId, idempotencyKey])` rejects
          // duplicate rows from a retry of the same form mount.
          // Legacy callers without a nonce get `null`, which the
          // partial-unique semantics intentionally allow. P0-03 in
          // the roadmap will make this NOT NULL and move key
          // derivation into a middleware at the action boundary.
          idempotencyKey: submissionNonce
            ? deriveReceiveIdempotencyKey(submissionNonce, lineId)
            : null,
          // P0-04 rc3 — cost audit columns.
          purchaseUnitCost,
          landedUnitCost,
        });

        // P0-04 rc3 — per-category audit rows. Scaled by
        // (delta / orderedQty) so a partial receive carries its
        // proportional share; across all receives of a given line
        // the sum lands on the header's freight/duty/etc for that
        // line. Zero-amount rows are filtered out; non-landed-cost
        // POs skip this block entirely.
        if (allocation && hasLanded && poLine && poLine.orderedQty > 0) {
          const proration = delta / poLine.orderedQty;
          const scaled = {
            FREIGHT: allocation.freight * proration,
            DUTY: allocation.duty * proration,
            INSURANCE: allocation.insurance * proration,
            OTHER: allocation.other * proration,
          } as const;
          const rows = (Object.keys(scaled) as Array<keyof typeof scaled>)
            .filter((k) => scaled[k] > 0)
            .map((k) => ({
              organizationId: orgId,
              purchaseOrderId: existing.id,
              sourceMovementId: created.id,
              allocationType: k,
              allocationBasis: allocation.basisUsed,
              // Round to 6 decimals to match the Decimal(18, 6)
              // column precision. Prisma would round anyway; we do
              // it explicitly so tests observing the number match
              // persisted value bit-for-bit.
              allocatedAmount: Number(scaled[k].toFixed(6)),
              appliedByUserId: session.user.id,
            }));
          if (rows.length > 0) {
            await tx.landedCostAllocation.createMany({ data: rows });
          }
        }

        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: line.itemId,
          warehouseId: existing.warehouseId,
          quantityDelta: delta,
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

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "purchase_order.received",
      entityType: "purchase_order",
      entityId: existing.id,
      metadata: {
        poNumber: existing.poNumber,
        receivedLineCount,
        fullyReceived,
        totalQty: Array.from(deltaByLine.values()).reduce((a, b) => a + b, 0),
      },
    });

    revalidatePath("/purchase-orders");
    revalidatePath(`/purchase-orders/${existing.id}`);
    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath("/dashboard");

    // P10.2 — fire-and-forget low-stock alert evaluation for received items
    const receivedItemIds = [
      ...new Set(
        Array.from(deltaByLine.keys())
          .map((lineId) => lineMap.get(lineId)?.itemId)
          .filter((id): id is string => !!id),
      ),
    ];
    if (receivedItemIds.length > 0) {
      void evaluateAlerts(orgId, receivedItemIds);
    }

    return { ok: true, id: existing.id, receivedLineCount, fullyReceived };
      },
    );
  } catch (error) {
    // P0-02 — surface idempotency-error kinds distinctly.
    if (error instanceof IdempotencyConflictError) {
      return {
        ok: false,
        error: t.purchaseOrders.errors.receiveFailed,
      };
    }
    if (error instanceof IdempotencyInProgressError) {
      return {
        ok: false,
        error: t.purchaseOrders.errors.receiveFailed,
      };
    }
    // Phase 6C — P2002 on the compound idempotency index means a
    // concurrent in-flight request with the SAME nonce won the race
    // and already persisted its batch (atomic: either all N rows
    // stamped or none). Treat it as a replay: re-run the sentinel
    // lookup and, if present, return the replay success shape —
    // WITHOUT re-auditing, WITHOUT re-revalidating. Any other
    // failure falls through to the generic error.
    if (
      submissionNonce &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const firstLineId = Array.from(deltaByLine.keys())[0];
      if (firstLineId) {
        const sentinelKey = deriveReceiveIdempotencyKey(submissionNonce, firstLineId);
        const alreadyApplied = await db.stockMovement.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: orgId,
              idempotencyKey: sentinelKey,
            },
          },
          select: { id: true },
        });
        if (alreadyApplied) {
          // Re-read status once so the replay shape matches what
          // the winner actually wrote (the winner may have flipped
          // the PO to RECEIVED). We deliberately do NOT mutate,
          // audit, or revalidate on this branch.
          const winnerStatus = await db.purchaseOrder.findUnique({
            where: { id: existing.id },
            select: { status: true },
          });
          return {
            ok: true,
            id: existing.id,
            receivedLineCount: deltaByLine.size,
            fullyReceived: winnerStatus?.status === "RECEIVED",
          };
        }
      }
    }
    logger.error("po.receive: transaction failed", {
      tag: "po.receive.tx-failed",
      err: error,
      purchaseOrderId: existing.id,
    });
    return { ok: false, error: t.purchaseOrders.errors.receiveFailed };
  }
}
