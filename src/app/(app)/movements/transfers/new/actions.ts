"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { evaluateAlerts } from "@/lib/alerts";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability, planCapabilityError } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";
import { cleanFieldErrors } from "@/lib/validation/action-result";
import { type CreateTransferInput, createTransferInputSchema } from "@/lib/validation/transfer";

// Schema + type re-exports removed: Next.js 15's `"use server"`
// compiler only permits async-function exports. Consumers that need
// the schema or type should import from `@/lib/validation/transfer`
// directly (this file only exposes the action itself).

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type TransferLineResult =
  | { ok: true; movementId: string; itemId: string }
  | { ok: false; itemId: string; error: string };

export type CreateTransferResult =
  | {
      ok: true;
      /** IDs of the StockMovement rows created, one per line. */
      movementIds: string[];
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

/**
 * Phase 11.1 — Inter-warehouse transfer wizard action.
 *
 * Accepts a validated multi-line transfer and writes one TRANSFER
 * StockMovement per line. Each line has its own idempotency key so
 * partial failures (transient DB error on line 3 of 5) can be retried
 * individually without double-applying completed lines.
 *
 * Architecture note: we call `writeMovement` (the private helper in
 * movements/actions.ts) by replicating its logic here rather than
 * exporting it, because the existing helper is tightly coupled to the
 * single-item FormData path and we don't want to modify that stable
 * surface. The logic is short enough that duplication is the safest
 * option — this is additive, not a rewrite.
 *
 * Stock integrity:
 *   - Each line is written in its own $transaction (atomically updates
 *     both warehouse StockLevel rows).
 *   - We do NOT wrap all lines in a single outer transaction. Reason:
 *     transfers are expected to succeed per-item; a transient failure on
 *     one item should not roll back already-completed lines. Operators
 *     can resubmit the remainder.
 *   - Negative stock is allowed (consistent with existing policy).
 *   - Idempotency keys prevent double-apply on resubmit.
 */
export async function createTransferAction(
  input: CreateTransferInput,
  idempotencyKeys: string[],
): Promise<CreateTransferResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "movements.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Phase 13.2 — inter-warehouse transfers require PRO or BUSINESS
  const transferPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(transferPlan, "transfers")) {
    return { ok: false, error: planCapabilityError("transfers") };
  }

  // Re-validate the full input on the server.
  const parsed = createTransferInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.movements.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  if (idempotencyKeys.length !== parsed.data.lines.length) {
    return { ok: false, error: t.movements.errors.createFailed };
  }

  const { fromWarehouseId, toWarehouseId, lines, reference, note } = parsed.data;
  const orgId = membership.organizationId;
  const userId = session.user.id;

  // Scope check: verify both warehouses belong to this org.
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

  // Validate all items belong to org before writing anything.
  const itemIds = lines.map((l) => l.itemId);
  const items = await db.item.findMany({
    where: { id: { in: itemIds }, organizationId: orgId },
    select: { id: true, name: true },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const missingItem = itemIds.find((id) => !itemMap.has(id));
  if (missingItem) {
    return {
      ok: false,
      error: t.movements.errors.itemNotFound,
      fieldErrors: { "lines[0].itemId": [t.movements.errors.itemNotFound] },
    };
  }

  // Write each line independently.
  const movementIds: string[] = [];
  const affectedItemIds: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const idempotencyKey = idempotencyKeys[i];

    // Both arrays are validated to have the same length above; these
    // guards satisfy strict-mode array-index typing.
    if (!line || !idempotencyKey) continue;

    // Pre-check idempotency (same pattern as writeMovement in actions.ts)
    const existing = await db.stockMovement.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: orgId,
          idempotencyKey,
        },
      },
      select: { id: true },
    });

    if (existing) {
      movementIds.push(existing.id);
      continue;
    }

    try {
      const movement = await db.$transaction(async (tx) => {
        const created = await tx.stockMovement.create({
          data: {
            organizationId: orgId,
            itemId: line.itemId,
            warehouseId: fromWarehouseId,
            toWarehouseId,
            type: "TRANSFER",
            quantity: line.quantity,
            direction: 1,
            reference: reference ?? null,
            note: note ?? null,
            createdByUserId: userId,
            idempotencyKey,
          },
          select: { id: true },
        });

        // Debit source
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: line.itemId,
          warehouseId: fromWarehouseId,
          quantityDelta: -line.quantity,
        });
        // Credit destination
        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: line.itemId,
          warehouseId: toWarehouseId,
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
          type: "TRANSFER",
          itemId: line.itemId,
          itemName: itemMap.get(line.itemId)?.name ?? null,
          warehouseId: fromWarehouseId,
          warehouseName: fromWh.name,
          toWarehouseId,
          toWarehouseName: toWh.name,
          quantity: line.quantity,
          reference: reference ?? null,
          transferWizard: true,
          lineIndex: i,
          totalLines: lines.length,
        },
      });
    } catch (error) {
      // Handle idempotency key collision from a concurrent write
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // idempotencyKey is guaranteed non-undefined here — we guard
        // with `if (!idempotencyKey) continue` before the try block.
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
      // Any other error on a single line — return a clear failure.
      // Lines before this one are already committed. The caller can
      // display partial success and let the operator resubmit the rest.
      return {
        ok: false,
        error: error instanceof Error ? error.message : t.movements.errors.createFailed,
      };
    }
  }

  // Fire-and-forget alert evaluation for all affected items
  if (affectedItemIds.length > 0) {
    void evaluateAlerts(orgId, affectedItemIds);
  }

  // Revalidate all affected surfaces
  revalidatePath("/movements");
  revalidatePath("/items");
  revalidatePath("/dashboard");
  revalidatePath("/warehouses");
  revalidatePath(`/warehouses/${fromWarehouseId}`);
  revalidatePath(`/warehouses/${toWarehouseId}`);

  return { ok: true, movementIds };
}
