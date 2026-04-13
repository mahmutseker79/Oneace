"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  type MovementInput,
  type MovementOpPayload,
  movementDirection,
  movementInputSchema,
  movementOpPayloadSchema,
  signedSourceDelta,
} from "@/lib/validation/movement";

export type { ActionResult };

/**
 * Sprint 26 — PWA Sprint 4 Part B. Result shape for the JSON /
 * offline-queue path. Carries an explicit `retryable` flag so the
 * queue runner's dispatcher can decide whether to reset the row to
 * `pending` (network glitch, 5xx, DB transient) or park it as a
 * non-retryable failure (validation error, membership denied, unique
 * collision on a stale key). The `ok` branch always carries the
 * movement id even when the write was a no-op replay hit, so the
 * optimistic-UI code path in the form can point at the same row.
 */
export type MovementOpResult =
  | { ok: true; id: string; replayed: boolean }
  | {
      ok: false;
      retryable: boolean;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

function formToInput(formData: FormData) {
  const raw: Record<string, unknown> = Object.fromEntries(formData);
  // Radix SelectItem "__none__" sentinel: strip before validation so
  // downstream schemas can stay strict.
  for (const key of Object.keys(raw)) {
    if (raw[key] === "__none__") raw[key] = "";
  }
  return raw;
}

/**
 * Transactional ledger write — shared helper used by BOTH the FormData
 * online-fast-path action and the JSON + idempotent offline-queue
 * action. The server action is the sole writer to both `stockMovement`
 * and `stockLevel`. Every insert is paired with an upsert on the
 * affected StockLevel row(s) inside a single $transaction so the
 * append-only ledger and the per-warehouse snapshot can never drift.
 *
 * Negative stock IS permitted (we don't block ISSUE below zero). The
 * dashboard surfaces negative balances as a data-quality warning.
 * Preventing negative stock is a Post-MVP policy knob.
 *
 * Returns a discriminated result so the two callers can translate it
 * to their own result shape. Membership resolution and i18n are the
 * caller's responsibility.
 *
 * Sprint 26 — the `idempotencyKey` parameter is optional. When
 * provided, it's stored on the created row via the compound unique
 * index `(organizationId, idempotencyKey)` — a replay from the queue
 * runner will hit the index, land on the `alreadyExists` branch, and
 * return the original row's id. When omitted (the legacy online
 * fast-path), the unique constraint is not exercised because the
 * column is nullable.
 */
type WriteMovementArgs = {
  orgId: string;
  userId: string;
  input: MovementInput;
  idempotencyKey?: string;
};

type WriteMovementOutcome =
  | { kind: "ok"; id: string }
  | { kind: "alreadyExists"; id: string }
  | { kind: "itemNotFound" }
  | { kind: "warehouseNotFound" }
  | { kind: "destinationNotFound" }
  | { kind: "constraintError" }
  | { kind: "transientError"; reason: string };

async function writeMovement(args: WriteMovementArgs): Promise<WriteMovementOutcome> {
  const { orgId, userId, input, idempotencyKey } = args;

  // Membership scope guards — confirm every referenced entity belongs to
  // the caller's organization BEFORE we start writing.
  const [item, fromWarehouse] = await Promise.all([
    db.item.findFirst({
      where: { id: input.itemId, organizationId: orgId },
      select: { id: true },
    }),
    db.warehouse.findFirst({
      where: { id: input.warehouseId, organizationId: orgId },
      select: { id: true },
    }),
  ]);

  if (!item) return { kind: "itemNotFound" };
  if (!fromWarehouse) return { kind: "warehouseNotFound" };

  let toWarehouseId: string | null = null;
  if (input.type === "TRANSFER") {
    const toWarehouse = await db.warehouse.findFirst({
      where: { id: input.toWarehouseId, organizationId: orgId },
      select: { id: true },
    });
    if (!toWarehouse) return { kind: "destinationNotFound" };
    toWarehouseId = toWarehouse.id;
  }

  // BIN_TRANSFER: validate that both bins exist within the warehouse
  let binId: string | null = null;
  let toBinId: string | null = null;
  if (input.type === "BIN_TRANSFER") {
    const [fromBin, toBin] = await Promise.all([
      db.bin.findFirst({
        where: { id: input.binId, warehouseId: input.warehouseId },
        select: { id: true },
      }),
      db.bin.findFirst({
        where: { id: input.toBinId, warehouseId: input.warehouseId },
        select: { id: true },
      }),
    ]);
    if (!fromBin || !toBin) return { kind: "constraintError" };
    binId = fromBin.id;
    toBinId = toBin.id;
  }

  const sourceDelta = signedSourceDelta(input);
  const direction = movementDirection(input);

  // Sprint 26 — pre-check the idempotency index before opening a
  // transaction. This is not load-bearing (the unique constraint
  // provides the real guarantee) but it makes the common "replayed
  // successful op" path a single indexed SELECT instead of a failed
  // INSERT + rollback. P2002 handling below is still required because
  // two tabs could race between the pre-check and the insert.
  if (idempotencyKey) {
    const existing = await db.stockMovement.findUnique({
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
    const movement = await db.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          toWarehouseId,
          binId,
          toBinId,
          type: input.type,
          quantity: input.quantity,
          direction,
          reference: input.reference,
          note: input.note,
          createdByUserId: userId,
          idempotencyKey: idempotencyKey ?? null,
        },
        select: { id: true },
      });

      // BIN_TRANSFER: move stock between bins in the same warehouse
      if (input.type === "BIN_TRANSFER" && binId && toBinId) {
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          binId,
          quantityDelta: -input.quantity,
        });
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          binId: toBinId,
          quantityDelta: input.quantity,
        });
      } else {
        // Upsert source warehouse stock level
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          quantityDelta: sourceDelta,
        });

        // TRANSFER additionally applies +quantity to the destination
        if (input.type === "TRANSFER" && toWarehouseId) {
          await upsertStockLevel(tx, {
            organizationId: orgId,
            itemId: input.itemId,
            warehouseId: toWarehouseId,
            quantityDelta: input.quantity,
          });
        }
      }

      return created;
    });

    return { kind: "ok", id: movement.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = unique-constraint violation. With an idempotency key
      // present, this means another tab or a retry beat us to the
      // insert after our pre-check. Look up and return the winner's
      // id — the caller treats this as a successful replay.
      if (error.code === "P2002" && idempotencyKey) {
        const existing = await db.stockMovement.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: orgId,
              idempotencyKey,
            },
          },
          select: { id: true },
        });
        if (existing) return { kind: "alreadyExists", id: existing.id };
        // Very unlikely: constraint fired but the row isn't readable.
        // Treat as transient so the queue retries.
        return { kind: "transientError", reason: "unique constraint race" };
      }
      if (error.code === "P2025") {
        return { kind: "constraintError" };
      }
    }
    return {
      kind: "transientError",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function revalidateMovementSurfaces(
  itemId: string,
  warehouseId: string,
  toWarehouseId: string | null,
) {
  revalidatePath("/movements");
  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/dashboard");
  // S1 introduced warehouse detail pages (`/warehouses/[id]`) and a
  // warehouse list backed by stock-level aggregates. A movement
  // mutates at least one warehouse's stock levels, so both the list
  // and the touched detail page(s) need to be busted — otherwise the
  // warehouse surfaces show stale on-hand totals until the next
  // navigation triggers a fresh render.
  revalidatePath("/warehouses");
  revalidatePath(`/warehouses/${warehouseId}`);
  if (toWarehouseId) {
    revalidatePath(`/warehouses/${toWarehouseId}`);
  }
}

/**
 * Legacy FormData path — used by the `<form>` online fast path where
 * there is no offline queue and no idempotency key. Kept as a thin
 * wrapper over `writeMovement` so the behavior matches the JSON path
 * exactly. See `submitMovementOpAction` for the queue-aware variant.
 */
export async function createMovementAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = movementInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.movements.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const outcome = await writeMovement({
    orgId: membership.organizationId,
    userId: session.user.id,
    input: parsed.data,
  });

  switch (outcome.kind) {
    case "ok":
      revalidateMovementSurfaces(
        parsed.data.itemId,
        parsed.data.warehouseId,
        parsed.data.type === "TRANSFER" ? parsed.data.toWarehouseId : null,
      );
      await recordAudit({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: "stock_movement.created",
        entityType: "stock_movement",
        entityId: outcome.id,
        metadata: {
          type: parsed.data.type,
          itemId: parsed.data.itemId,
          warehouseId: parsed.data.warehouseId,
          toWarehouseId: parsed.data.type === "TRANSFER" ? parsed.data.toWarehouseId : null,
          quantity: parsed.data.quantity,
          reference: parsed.data.reference ?? null,
        },
      });
      return { ok: true, id: outcome.id };
    case "alreadyExists":
      // Should never happen on the legacy path — no idempotency key is
      // passed. Included for exhaustiveness. No audit: replays never
      // emit `stock_movement.created` (see audit vocabulary comment).
      revalidateMovementSurfaces(
        parsed.data.itemId,
        parsed.data.warehouseId,
        parsed.data.type === "TRANSFER" ? parsed.data.toWarehouseId : null,
      );
      return { ok: true, id: outcome.id };
    case "itemNotFound":
      return {
        ok: false,
        error: t.movements.errors.itemNotFound,
        fieldErrors: { itemId: [t.movements.errors.itemNotFound] },
      };
    case "warehouseNotFound":
      return {
        ok: false,
        error: t.movements.errors.warehouseNotFound,
        fieldErrors: { warehouseId: [t.movements.errors.warehouseNotFound] },
      };
    case "destinationNotFound":
      return {
        ok: false,
        error: t.movements.errors.destinationNotFound,
        fieldErrors: {
          toWarehouseId: [t.movements.errors.destinationNotFound],
        },
      };
    case "constraintError":
      return { ok: false, error: t.movements.errors.notFound };
    default:
      return { ok: false, error: t.movements.errors.createFailed };
  }
}

/**
 * Sprint 26 — PWA Sprint 4 Part B. JSON + idempotent movement write.
 *
 * This is the action the offline-queue dispatcher calls on replay, and
 * the action the `movement-form` calls on its online fast path. Two
 * callers, one server action, one write path, one validation pass —
 * the FormData wrapper above is kept for backwards compat only.
 *
 * Contract:
 *
 *   - Payload is `{ idempotencyKey, input }`. The key is a client-
 *     generated v4 UUID; the server writes it into
 *     `StockMovement.idempotencyKey` under the
 *     `(organizationId, idempotencyKey)` unique constraint. A replay
 *     from the queue runner (identical payload including the same
 *     key) is a no-op that returns the original row's id with
 *     `replayed: true`.
 *
 *   - Returns `MovementOpResult`:
 *       * `{ ok: true, id, replayed }` — success (fresh or replay).
 *       * `{ ok: false, retryable: false, ... }` — validation error,
 *         missing item/warehouse, etc. The dispatcher marks the op
 *         as `failed` (non-retryable) so a typo or stale reference
 *         doesn't loop forever.
 *       * `{ ok: false, retryable: true, ... }` — transient DB error
 *         or constraint race. The dispatcher marks the op as
 *         `failed` with `retryable: true`, which resets status to
 *         `pending` for the next drain attempt.
 *
 * The action does NOT throw — every error path returns a structured
 * result. This is load-bearing for the dispatcher: an unhandled throw
 * would be caught by the runner's try/catch and marked non-retryable,
 * which would be wrong for transient DB issues.
 */
export async function submitMovementOpAction(
  payload: MovementOpPayload,
): Promise<MovementOpResult> {
  let session: Awaited<ReturnType<typeof requireActiveMembership>>["session"];
  let membership: Awaited<ReturnType<typeof requireActiveMembership>>["membership"];
  try {
    const auth = await requireActiveMembership();
    session = auth.session;
    membership = auth.membership;
  } catch (error) {
    // requireActiveMembership throws/redirects on missing session or
    // org. For the queue path that's a non-retryable condition — the
    // user needs to sign back in. Reporting it as retryable would
    // spin the op until the queue is drained manually.
    return {
      ok: false,
      retryable: false,
      error: error instanceof Error ? error.message : "not authenticated",
    };
  }

  const t = await getMessages();

  const parsed = movementOpPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      retryable: false,
      error: t.movements.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const { idempotencyKey, input } = parsed.data;

  const outcome = await writeMovement({
    orgId: membership.organizationId,
    userId: session.user.id,
    input,
    idempotencyKey,
  });

  switch (outcome.kind) {
    case "ok":
      revalidateMovementSurfaces(
        input.itemId,
        input.warehouseId,
        input.type === "TRANSFER" ? input.toWarehouseId : null,
      );
      await recordAudit({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: "stock_movement.created",
        entityType: "stock_movement",
        entityId: outcome.id,
        metadata: {
          type: input.type,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          toWarehouseId: input.type === "TRANSFER" ? input.toWarehouseId : null,
          quantity: input.quantity,
          reference: input.reference ?? null,
          idempotent: true,
        },
      });
      return { ok: true, id: outcome.id, replayed: false };
    case "alreadyExists":
      // Do NOT revalidate on a replay — the row already existed, the
      // caches are already aware of it, and emitting revalidatePath on
      // every queue drain is wasteful. Do NOT emit audit either: the
      // original write already emitted `stock_movement.created` and
      // re-auditing would double-count.
      return { ok: true, id: outcome.id, replayed: true };
    case "itemNotFound":
      return {
        ok: false,
        retryable: false,
        error: t.movements.errors.itemNotFound,
        fieldErrors: { itemId: [t.movements.errors.itemNotFound] },
      };
    case "warehouseNotFound":
      return {
        ok: false,
        retryable: false,
        error: t.movements.errors.warehouseNotFound,
        fieldErrors: { warehouseId: [t.movements.errors.warehouseNotFound] },
      };
    case "destinationNotFound":
      return {
        ok: false,
        retryable: false,
        error: t.movements.errors.destinationNotFound,
        fieldErrors: {
          toWarehouseId: [t.movements.errors.destinationNotFound],
        },
      };
    case "constraintError":
      return {
        ok: false,
        retryable: false,
        error: t.movements.errors.notFound,
      };
    default:
      // Transient DB error — retry on next drain.
      return {
        ok: false,
        retryable: true,
        error: t.movements.errors.createFailed,
      };
  }
}
