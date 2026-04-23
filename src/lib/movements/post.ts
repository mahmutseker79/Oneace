// src/lib/movements/post.ts
//
// Phase 0 seam for StockMovement inserts.
//
// Context
// -------
// v1.3 audit → GOD MODE roadmap (2026-04-23) flagged P0-01: the
// cost-posting hook (ADR-001 FIFO/WAC) exists only in schema. Every
// inline `tx.stockMovement.create(...)` across the action layer bypasses
// any future cost-attribution or audit hook, and there is no single seam
// to enforce idempotency / cost-posting / tenant-scope invariants.
//
// This file is that seam. It does not implement cost attribution yet
// (schema lacks the `unitCostUsed` / `cogsAmount` / `costMethodApplied`
// columns on StockMovement at the time of writing — see `prisma/schema.prisma`
// at model StockMovement, line ~600). Instead it provides:
//
//   1. `postMovement(tx, input)` — THE sole entry point for StockMovement
//      inserts. All action-layer code MUST call through this function.
//      A static-analysis pinned test enforces this (see
//      `no-direct-create.static.test.ts` in this folder).
//
//   2. A forward-compatible `StockMovementInput` shape. When ADR-001
//      lands (Phase 1c → Day 8-30 in the roadmap) the cost fields are
//      added here and automatically apply everywhere.
//
//   3. A `CostPostingHook` extension point. Default is a no-op. When
//      ADR-001 ships, the real hook attaches here and every callsite
//      benefits without further edits.
//
// Why a seam first, posting hook later
// ------------------------------------
// The schema change to add `unitCostUsed`, `cogsAmount`, `costMethodApplied`
// and the `CostLayer` model is a separate migration (ADR-001 Phase 1c).
// That migration is a Day 8-30 item in the roadmap. Shipping the seam
// now — with zero behaviour change — lets us (a) refactor all 17
// call sites behind this interface in small commits, (b) get test
// coverage on the act of "writing a StockMovement", and (c) land the
// cost-posting body in a single, reviewable commit later rather than
// spreading the change across 17 files at once.
//
// Contract
// --------
//   - `tx` MUST be a Prisma transaction client (`Prisma.TransactionClient`).
//     Direct `prisma.stockMovement.create` is intentionally unsupported so
//     that cost posting (when it lands) can participate in the same tx.
//   - `input.organizationId` MUST be present and non-empty. The static test
//     also enforces no cross-tenant drift at call sites.
//   - `input.idempotencyKey` is currently optional to match the existing
//     schema (`idempotencyKey String?` on StockMovement). P0-03 in the
//     roadmap will make this NOT NULL; when that migration lands, callers
//     must supply a key (internal UI generates UUIDs; webhook handlers
//     derive keys from delivery IDs). See roadmap task #4, #6.
//
// What this file is NOT
// ---------------------
//   - Not a cost calculator. ADR-001 FIFO/WAC lives in `src/lib/costing/*`
//     when it ships.
//   - Not an idempotency middleware. That lives in
//     `src/lib/idempotency/middleware.ts` (roadmap task #8).
//   - Not a queue. Integration adapters use `src/lib/integrations/task-queue.ts`.

import type { Prisma, StockMovement } from "@prisma/client";

import {
  generateMovementIdempotencyKey,
  isReservedLegacyKey,
} from "./idempotency-key";

/**
 * Minimal typed transaction client. We depend only on the fragment of
 * Prisma.TransactionClient that we actually use (stockMovement.create).
 * This keeps tests cheap to stub without pulling the full Prisma client
 * type graph.
 */
export type TxClient = Pick<Prisma.TransactionClient, "stockMovement">;

/**
 * The payload every StockMovement insert in the action layer uses.
 *
 * This is a structural subset of `Prisma.StockMovementUncheckedCreateInput`
 * — structural because we want to accept the shape the action handlers
 * already build (plain FK strings + scalars) without coupling to the
 * generated Prisma input type (which changes across prisma versions).
 *
 * When ADR-001 lands, add the cost fields here. Existing callers that
 * don't know about costs will continue to compile; the hook supplies
 * defaults.
 */
export interface StockMovementInput {
  // Tenant scope — asserted non-empty below.
  organizationId: string;

  // Core ledger fields.
  itemId: string;
  warehouseId: string;
  binId?: string | null;
  toWarehouseId?: string | null;
  toBinId?: string | null;
  type: StockMovement["type"];
  quantity: number;
  direction?: number; // defaults to +1 in schema; callers may omit

  // Free-text ledger metadata.
  reference?: string | null;
  note?: string | null;

  // Idempotency. Currently nullable to match schema; will become
  // required in v1.6-later (roadmap P0-03).
  idempotencyKey?: string | null;

  // Source-document backrefs (Phase 5A).
  purchaseOrderLineId?: string | null;
  stockCountId?: string | null;

  // Reason / serial / batch tracking (Phase V4).
  reasonCodeId?: string | null;
  serialNumberId?: string | null;
  batchId?: string | null;

  // Audit.
  createdByUserId?: string | null;

  // GOD MODE roadmap P0-04 / ADR-002 §5 — landed cost audit columns.
  //
  //   purchaseUnitCost — raw supplier price per unit at receive time.
  //   landedUnitCost   — purchaseUnitCost + pro-rata freight/duty/
  //                      insurance/other share / qty.
  //
  // Both optional; callers that don't compute landed cost (internal
  // transfers, adjustments, bulk import) leave them undefined and the
  // seam omits them from the persisted row. The PO-receive action
  // (rc3) is the first — and today only — caller that sets them.
  //
  // Accepted types:
  //   `number`   — the ergonomic path for pure-function callers like
  //                the allocator.
  //   `string`   — for future callers that already have a
  //                Prisma.Decimal stringified (e.g. reading from a
  //                QB export).
  // The seam forwards the value unchanged; Prisma accepts either
  // shape on a Decimal column.
  purchaseUnitCost?: number | string | null;
  landedUnitCost?: number | string | null;

  // --- Forward-compat placeholders ---
  // Add these when ADR-001 FIFO/WAC cost posting lands. The seam
  // simply drops unknown fields when persisting (see
  // `persistableFields` below), so the hook author can extend
  // StockMovementInput without touching the callers.
  // unitCostUsed?: number | null;
  // cogsAmount?: number | null;
  // costMethodApplied?: "WAC" | "FIFO" | null;
}

/**
 * Forward-compat extension point. The default hook is a pass-through.
 *
 * When ADR-001 ships:
 *   1. Add cost fields to `StockMovementInput` and schema.
 *   2. Supply a real hook from `src/lib/costing/post-hook.ts` that:
 *       - Resolves org cost method (WAC/FIFO).
 *       - For IN movements, appends a CostLayer row.
 *       - For OUT movements, consumes CostLayers, writes unitCostUsed +
 *         cogsAmount back onto the movement row.
 *   3. Register it via `registerCostPostingHook(hook)` at app boot.
 *
 * For now we keep the hook shape here rather than in a separate file
 * because there is exactly one hook and exporting the interface from
 * this file keeps the seam in one place.
 */
export interface CostPostingHook {
  /**
   * Called AFTER the StockMovement row is inserted, inside the same tx.
   * Hooks may update the movement with unit cost / COGS once the cost
   * method has been resolved.
   *
   * Return the (possibly updated) row. Default hook returns it unchanged.
   */
  onAfterInsert: (
    tx: TxClient,
    movement: StockMovement,
    input: StockMovementInput,
  ) => Promise<StockMovement>;
}

const noopHook: CostPostingHook = {
  onAfterInsert: async (_tx, movement) => movement,
};

let activeHook: CostPostingHook = noopHook;

/**
 * Register a cost-posting hook. Call this once at app boot (e.g. from
 * `instrumentation.ts`) when ADR-001 ships. Tests may override per-case
 * via `withHook`.
 */
export function registerCostPostingHook(hook: CostPostingHook): void {
  activeHook = hook;
}

/**
 * Test helper — run `fn` with a scoped hook, restore after.
 */
export async function withHook<T>(
  hook: CostPostingHook,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = activeHook;
  activeHook = hook;
  try {
    return await fn();
  } finally {
    activeHook = prev;
  }
}

/**
 * Fields we actually persist today. Unknown / forward-compat fields
 * are dropped here, not forwarded to Prisma, so adding a new field to
 * `StockMovementInput` doesn't break persistence until the schema + this
 * allowlist catch up.
 */
const persistableFields = [
  "organizationId",
  "itemId",
  "warehouseId",
  "binId",
  "toWarehouseId",
  "toBinId",
  "type",
  "quantity",
  "direction",
  "reference",
  "note",
  "idempotencyKey",
  "purchaseOrderLineId",
  "stockCountId",
  "reasonCodeId",
  "serialNumberId",
  "batchId",
  "createdByUserId",
  // P0-04 landed-cost audit columns.
  "purchaseUnitCost",
  "landedUnitCost",
] as const;

function projectPersistable(
  input: StockMovementInput,
): Prisma.StockMovementUncheckedCreateInput {
  const out: Record<string, unknown> = {};
  for (const k of persistableFields) {
    const v = (input as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = v;
  }
  return out as Prisma.StockMovementUncheckedCreateInput;
}

/**
 * Runtime invariant checks. These are cheap and catch programmer errors
 * early. Kept alongside the write so the failure mode is a loud throw
 * rather than a silent bad row.
 */
function assertInvariants(input: StockMovementInput): void {
  if (
    !input.organizationId ||
    typeof input.organizationId !== "string" ||
    input.organizationId.trim() === ""
  ) {
    throw new Error(
      "postMovement: organizationId is required and must be a non-empty string",
    );
  }
  if (!Number.isFinite(input.quantity)) {
    throw new Error("postMovement: quantity must be a finite number");
  }
  if (input.quantity < 0) {
    throw new Error(
      "postMovement: quantity must be >= 0 (direction carries sign)",
    );
  }
  // P0-03: the `LEGACY:` prefix is reserved for the backfill sentinel.
  // New writes that collide would corrupt the column's meaning (you
  // could no longer tell "untouched pre-migration row" from "wrote
  // this yesterday"). Fail loud.
  if (isReservedLegacyKey(input.idempotencyKey ?? null)) {
    throw new Error(
      "postMovement: idempotencyKey cannot start with the reserved LEGACY: prefix",
    );
  }
}

/**
 * P0-03: resolve the idempotency key. Callers may supply one
 * explicitly (UI mints per form mount, webhooks derive from
 * deliveryId), or omit it — in which case the seam generates a
 * runtime UUID. Either way the resulting row has a non-null key,
 * preparing the column for the upcoming NOT NULL migration.
 *
 * Kept as an internal helper rather than inlined so the fallback
 * call is visible in a single grep-able location.
 */
function resolveIdempotencyKey(input: StockMovementInput): string {
  const supplied = input.idempotencyKey;
  if (typeof supplied === "string" && supplied.trim() !== "") {
    return supplied;
  }
  return generateMovementIdempotencyKey();
}

/**
 * THE seam. Every StockMovement insert in the action layer goes through
 * here. Enforces tenant + quantity invariants, inserts the row, and
 * fires the cost-posting hook (no-op today, real FIFO/WAC when ADR-001
 * ships).
 *
 * Usage:
 *
 *   await db.$transaction(async (tx) => {
 *     await postMovement(tx, {
 *       organizationId: membership.organizationId,
 *       itemId: line.itemId,
 *       warehouseId: po.warehouseId,
 *       type: "RECEIPT",
 *       quantity: received,
 *       reference: `PO:${po.number}`,
 *       purchaseOrderLineId: line.id,
 *       createdByUserId: session.user.id,
 *     });
 *   });
 */
export async function postMovement(
  tx: TxClient,
  input: StockMovementInput,
): Promise<StockMovement> {
  assertInvariants(input);

  // P0-03: defaulting happens here so that every callsite — whether
  // it supplied a key or not — produces a row with a non-null key.
  // The upcoming NOT NULL migration is then a trivial column flip.
  const resolvedKey = resolveIdempotencyKey(input);
  const data = projectPersistable({ ...input, idempotencyKey: resolvedKey });
  const movement = await tx.stockMovement.create({ data });

  return activeHook.onAfterInsert(tx, movement, input);
}
