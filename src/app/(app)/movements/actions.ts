"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import {
  movementDirection,
  movementInputSchema,
  signedSourceDelta,
} from "@/lib/validation/movement";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

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
 * Transactional ledger write.
 *
 * The server action is the sole writer to both `stockMovement` and
 * `stockLevel`. Every insert is paired with an upsert on the affected
 * StockLevel row(s) inside a single $transaction so the append-only
 * ledger and the per-warehouse snapshot can never drift.
 *
 * Negative stock IS permitted (we don't block ISSUE below zero). The
 * dashboard surfaces negative balances as a data-quality warning.
 * Preventing negative stock is a Post-MVP policy knob.
 */
export async function createMovementAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = movementInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    // Discriminated union fieldErrors contain `string[] | undefined` values
    // because any key might be missing from a narrowed variant. Strip
    // undefined entries so the ActionResult shape stays clean for clients.
    const rawFieldErrors = parsed.error.flatten().fieldErrors;
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(rawFieldErrors)) {
      if (value && value.length > 0) fieldErrors[key] = value;
    }
    return {
      ok: false,
      error: t.movements.errors.createFailed,
      fieldErrors,
    };
  }
  const input = parsed.data;
  const orgId = membership.organizationId;

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

  if (!item) {
    return {
      ok: false,
      error: t.movements.errors.itemNotFound,
      fieldErrors: { itemId: [t.movements.errors.itemNotFound] },
    };
  }
  if (!fromWarehouse) {
    return {
      ok: false,
      error: t.movements.errors.warehouseNotFound,
      fieldErrors: { warehouseId: [t.movements.errors.warehouseNotFound] },
    };
  }

  let toWarehouseId: string | null = null;
  if (input.type === "TRANSFER") {
    const toWarehouse = await db.warehouse.findFirst({
      where: { id: input.toWarehouseId, organizationId: orgId },
      select: { id: true },
    });
    if (!toWarehouse) {
      return {
        ok: false,
        error: t.movements.errors.destinationNotFound,
        fieldErrors: {
          toWarehouseId: [t.movements.errors.destinationNotFound],
        },
      };
    }
    toWarehouseId = toWarehouse.id;
  }

  const sourceDelta = signedSourceDelta(input);
  const direction = movementDirection(input);

  try {
    const movement = await db.$transaction(async (tx) => {
      const created = await tx.stockMovement.create({
        data: {
          organizationId: orgId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          toWarehouseId,
          type: input.type,
          quantity: input.quantity,
          direction,
          reference: input.reference,
          note: input.note,
          createdByUserId: session.user.id,
        },
        select: { id: true },
      });

      // Upsert source warehouse stock level
      await tx.stockLevel.upsert({
        where: {
          itemId_warehouseId: {
            itemId: input.itemId,
            warehouseId: input.warehouseId,
          },
        },
        create: {
          organizationId: orgId,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          quantity: sourceDelta,
        },
        update: {
          quantity: { increment: sourceDelta },
        },
      });

      // TRANSFER additionally applies +quantity to the destination
      if (input.type === "TRANSFER" && toWarehouseId) {
        await tx.stockLevel.upsert({
          where: {
            itemId_warehouseId: {
              itemId: input.itemId,
              warehouseId: toWarehouseId,
            },
          },
          create: {
            organizationId: orgId,
            itemId: input.itemId,
            warehouseId: toWarehouseId,
            quantity: input.quantity,
          },
          update: {
            quantity: { increment: input.quantity },
          },
        });
      }

      return created;
    });

    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath(`/items/${input.itemId}`);
    revalidatePath("/dashboard");

    return { ok: true, id: movement.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { ok: false, error: t.movements.errors.notFound };
      }
    }
    return { ok: false, error: t.movements.errors.createFailed };
  }
}
