"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { canAddEntry, canCancel, canReconcile } from "@/lib/stockcount/machine";
import { calculateVariances } from "@/lib/stockcount/variance";
import {
  type AddEntryInput,
  type CountEntryOpPayload,
  addEntryInputSchema,
  cancelCountInputSchema,
  completeCountInputSchema,
  countEntryOpPayloadSchema,
  createCountInputSchema,
} from "@/lib/validation/stockcount";

export type ActionResult<T extends object = { id: string }> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Sprint 27 — PWA Sprint 4 follow-on. Result shape for the JSON /
 * offline-queue path. Mirrors `MovementOpResult` in
 * src/app/(app)/movements/actions.ts — the dispatcher translates
 * `retryable` into runner state (retry = back to pending, !retryable =
 * parked for manual review).
 */
export type CountEntryOpResult =
  | { ok: true; entryId: string; replayed: boolean }
  | {
      ok: false;
      retryable: boolean;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

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
 * Transactional count-entry write — shared helper used by BOTH the
 * legacy `addCountEntryAction` (online fast path) and the Sprint 27
 * `submitCountEntryOpAction` (JSON + idempotent offline-queue path).
 * One writer, one validation pass, one source of truth for the
 * OPEN → IN_PROGRESS auto-transition rule.
 *
 * Sprint 27 — `idempotencyKey` is optional. When present, it's stored
 * on the new CountEntry row via the compound unique index
 * `(organizationId, idempotencyKey)`. A replay from the queue runner
 * (same payload, same key) is caught on either the pre-check SELECT
 * or the P2002 race fallback and returns the original row's id
 * instead of inserting a duplicate.
 *
 * Returns a discriminated outcome so both callers can translate the
 * result to their own shape. Auth/i18n is the caller's job.
 */
type WriteCountEntryArgs = {
  orgId: string;
  userId: string;
  input: AddEntryInput;
  idempotencyKey?: string;
};

type WriteCountEntryOutcome =
  | { kind: "ok"; id: string }
  | { kind: "alreadyExists"; id: string }
  | { kind: "countNotFound" }
  | { kind: "notEditable" }
  | { kind: "outOfScope" }
  | { kind: "transientError"; reason: string };

async function writeCountEntry(args: WriteCountEntryArgs): Promise<WriteCountEntryOutcome> {
  const { orgId, userId, input, idempotencyKey } = args;

  const count = await db.stockCount.findFirst({
    where: { id: input.countId, organizationId: orgId },
    select: { id: true, state: true },
  });
  if (!count) return { kind: "countNotFound" };
  if (!canAddEntry(count.state)) return { kind: "notEditable" };

  // Confirm (item, warehouse) is actually part of this count's scope.
  const snapshot = await db.countSnapshot.findFirst({
    where: {
      countId: input.countId,
      itemId: input.itemId,
      warehouseId: input.warehouseId,
    },
    select: { id: true },
  });
  if (!snapshot) return { kind: "outOfScope" };

  // Pre-check the idempotency index so the common "replayed successful
  // op" path is a single indexed SELECT instead of a failed INSERT +
  // rollback. P2002 handling below is still required because two tabs
  // could race between the pre-check and the insert.
  if (idempotencyKey) {
    const existing = await db.countEntry.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: orgId,
          idempotencyKey,
        },
      },
      select: { id: true },
    });
    if (existing) return { kind: "alreadyExists", id: existing.id };
  }

  try {
    const entry = await db.$transaction(async (tx) => {
      const created = await tx.countEntry.create({
        data: {
          organizationId: orgId,
          countId: input.countId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          countedQuantity: input.countedQuantity,
          counterTag: input.counterTag,
          note: input.note,
          countedByUserId: userId,
          idempotencyKey: idempotencyKey ?? null,
        },
        select: { id: true },
      });

      if (count.state === "OPEN") {
        await tx.stockCount.update({
          where: { id: input.countId },
          data: { state: "IN_PROGRESS", startedAt: new Date() },
        });
      }

      return created;
    });

    return { kind: "ok", id: entry.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      idempotencyKey
    ) {
      const existing = await db.countEntry.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: orgId,
            idempotencyKey,
          },
        },
        select: { id: true },
      });
      if (existing) return { kind: "alreadyExists", id: existing.id };
      return { kind: "transientError", reason: "unique constraint race" };
    }
    return {
      kind: "transientError",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Legacy path — `addCountEntryAction` is the FormData-ish fast path
 * used before Sprint 27. The entry-form client now calls
 * `submitCountEntryOpAction` with an idempotency key, but this action
 * stays as a thin wrapper over `writeCountEntry` so any remaining
 * callers (e.g. server-only scripts, future API routes) keep working
 * without another codepath duplication.
 *
 * First entry auto-transitions OPEN → IN_PROGRESS, and `startedAt` is
 * stamped at the same moment. The (item, warehouse) pair must exist in
 * the count's snapshot — we refuse entries for rows that weren't part
 * of the original scope to keep the audit trail honest.
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

  const outcome = await writeCountEntry({
    orgId: membership.organizationId,
    userId: session.user.id,
    input: parsed.data,
  });

  switch (outcome.kind) {
    case "ok":
      revalidateCount(parsed.data.countId);
      return { ok: true, entryId: outcome.id };
    case "alreadyExists":
      // Legacy path doesn't pass an idempotency key, so this branch is
      // unreachable in practice — included for exhaustiveness.
      revalidateCount(parsed.data.countId);
      return { ok: true, entryId: outcome.id };
    case "countNotFound":
      return { ok: false, error: t.stockCounts.errors.notFound };
    case "notEditable":
      return { ok: false, error: t.stockCounts.errors.notEditable };
    case "outOfScope":
      return {
        ok: false,
        error: t.stockCounts.errors.outOfScope,
        fieldErrors: { itemId: [t.stockCounts.errors.outOfScope] },
      };
    default:
      return { ok: false, error: t.stockCounts.errors.entryFailed };
  }
}

/**
 * Sprint 27 — PWA Sprint 4 follow-on. JSON + idempotent count-entry
 * write. This is the action the offline-queue dispatcher calls on
 * replay, and the action the `entry-form` calls on its online fast
 * path. Two callers, one server action, one write path.
 *
 * Contract — mirrors `submitMovementOpAction` in
 * src/app/(app)/movements/actions.ts:
 *
 *   - Payload is `{ idempotencyKey, input }`. The key is a client-
 *     generated UUID v4 stored on `CountEntry.idempotencyKey` under
 *     the `(organizationId, idempotencyKey)` unique constraint. A
 *     replay from the queue runner is a no-op that returns the
 *     original entry's id with `replayed: true`.
 *
 *   - Returns `CountEntryOpResult`:
 *       * `{ ok: true, entryId, replayed }` — success (fresh or replay).
 *       * `{ ok: false, retryable: false, ... }` — validation error,
 *         count not found, not-editable state, out-of-scope row. The
 *         dispatcher parks non-retryable errors so a typo or stale
 *         reference doesn't loop forever.
 *       * `{ ok: false, retryable: true, ... }` — transient DB error
 *         or constraint race. The dispatcher resets status to pending
 *         for the next drain attempt.
 *
 * NEVER throws. Every error path returns a structured result so the
 * dispatcher's try/catch only catches RPC/transport errors (which it
 * treats as retryable).
 */
export async function submitCountEntryOpAction(
  payload: CountEntryOpPayload,
): Promise<CountEntryOpResult> {
  let session: Awaited<ReturnType<typeof requireActiveMembership>>["session"];
  let membership: Awaited<ReturnType<typeof requireActiveMembership>>["membership"];
  try {
    const auth = await requireActiveMembership();
    session = auth.session;
    membership = auth.membership;
  } catch (error) {
    // requireActiveMembership throws/redirects when the session is
    // missing. For the queue path that's a non-retryable condition.
    return {
      ok: false,
      retryable: false,
      error: error instanceof Error ? error.message : "not authenticated",
    };
  }

  const t = await getMessages();

  const parsed = countEntryOpPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      retryable: false,
      error: t.stockCounts.errors.entryFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { idempotencyKey, input } = parsed.data;

  const outcome = await writeCountEntry({
    orgId: membership.organizationId,
    userId: session.user.id,
    input,
    idempotencyKey,
  });

  switch (outcome.kind) {
    case "ok":
      revalidateCount(input.countId);
      return { ok: true, entryId: outcome.id, replayed: false };
    case "alreadyExists":
      // Do NOT revalidate on a replay — the row already existed and
      // caches are already aware. Revalidating on every drain is waste.
      return { ok: true, entryId: outcome.id, replayed: true };
    case "countNotFound":
      return {
        ok: false,
        retryable: false,
        error: t.stockCounts.errors.notFound,
      };
    case "notEditable":
      return {
        ok: false,
        retryable: false,
        error: t.stockCounts.errors.notEditable,
      };
    case "outOfScope":
      return {
        ok: false,
        retryable: false,
        error: t.stockCounts.errors.outOfScope,
        fieldErrors: { itemId: [t.stockCounts.errors.outOfScope] },
      };
    default:
      // Transient DB error — retry on next drain.
      return {
        ok: false,
        retryable: true,
        error: t.stockCounts.errors.entryFailed,
      };
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
