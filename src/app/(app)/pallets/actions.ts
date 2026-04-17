"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import {
  createPalletLabelSchema,
  updatePalletLabelSchema,
  type CreatePalletLabelInput,
  type UpdatePalletLabelInput,
} from "@/lib/validation/pallet-label";
import { nanoid } from "nanoid";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Generate a unique barcode value for a pallet (format: PALLET-{timestamp}-{randomId})
 */
function generatePalletBarcode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(6).toUpperCase();
  return `PALLET-${timestamp}-${random}`;
}

/**
 * Create a new pallet barcode label with associated items.
 */
export async function createPalletAction(
  input: CreatePalletLabelInput,
): Promise<ActionResult<{ id: string; barcodeValue: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  // Check permission
  if (!hasCapability(membership.role, "assets.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Validate input
  const parsed = createPalletLabelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.common.validationFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  try {
    // Verify warehouse exists
    const warehouse = await db.warehouse.findFirst({
      where: {
        id: data.warehouseId,
        organizationId: membership.organizationId,
      },
      select: { id: true },
    });

    if (!warehouse) {
      return { ok: false, error: "Warehouse not found" };
    }

    // Verify all items exist and belong to org
    const items = await db.item.findMany({
      where: {
        id: { in: data.itemIds },
        organizationId: membership.organizationId,
      },
      select: { id: true },
    });

    if (items.length !== data.itemIds.length) {
      return { ok: false, error: "One or more items not found" };
    }

    // If binId provided, verify it exists
    if (data.binId) {
      const bin = await db.bin.findFirst({
        where: {
          id: data.binId,
          warehouseId: data.warehouseId,
        },
        select: { id: true },
      });

      if (!bin) {
        return { ok: false, error: "Bin not found in selected warehouse" };
      }
    }

    // Generate barcode if not provided
    const barcodeValue = data.barcodeValue || generatePalletBarcode();

    // Check barcode uniqueness
    const existingBarcode = await db.itemBarcode.findFirst({
      where: {
        organizationId: membership.organizationId,
        value: barcodeValue,
      },
    });

    if (existingBarcode) {
      return { ok: false, error: "Barcode value already exists" };
    }

    // Create the pallet label as an ItemBarcode with type PALLET
    // Use the first item as the primary item for the barcode
    const pallet = await db.itemBarcode.create({
      data: {
        organizationId: membership.organizationId,
        itemId: data.itemIds[0]!,
        value: barcodeValue,
        format: "CODE128",
        type: "PALLET",
        label: `Pallet: ${data.quantity} items`,
        multiplier: data.quantity,
        isActive: true,
      },
      select: { id: true, value: true },
    });

    revalidatePath("/pallets");

    // Record audit event
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "label_template.created",
      entityType: "label_template",
      entityId: pallet.id,
      metadata: {
        type: "PALLET",
        itemCount: data.itemIds.length,
        quantity: data.quantity,
        warehouseId: data.warehouseId,
        binId: data.binId || null,
      },
    });

    return {
      ok: true,
      data: {
        id: pallet.id,
        barcodeValue: pallet.value,
      },
    };
  } catch (error) {
    logger.error("createPalletAction failed", { error });
    return { ok: false, error: t.common.operationFailed };
  }
}

/**
 * List all pallet barcodes for the active organization.
 */
export async function listPalletsAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      barcodeValue: string;
      itemId: string;
      itemName: string;
      quantity: number;
      warehouseId: string;
      warehouseName: string;
      binId: string | null;
      binCode: string | null;
      createdAt: string;
    }>
  >
> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  try {
    const pallets = await db.itemBarcode.findMany({
      where: {
        organizationId: membership.organizationId,
        type: "PALLET",
        isActive: true,
      },
      select: {
        id: true,
        value: true,
        item: { select: { id: true, name: true } },
        multiplier: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with warehouse and bin info by joining through the item
    const enriched = await Promise.all(
      pallets.map(async (pallet) => {
        // Get warehouse info for this item's first stock level
        const stockLevel = await db.stockLevel.findFirst({
          where: { itemId: pallet.item.id },
          select: {
            warehouseId: true,
            binId: true,
            warehouse: { select: { id: true, name: true } },
            bin: { select: { id: true, code: true } },
          },
        });

        return {
          id: pallet.id,
          barcodeValue: pallet.value,
          itemId: pallet.item.id,
          itemName: pallet.item.name,
          quantity: pallet.multiplier,
          warehouseId: stockLevel?.warehouseId || "",
          warehouseName: stockLevel?.warehouse?.name || "Unknown",
          binId: stockLevel?.binId || null,
          binCode: stockLevel?.bin?.code || null,
          createdAt: pallet.createdAt.toISOString(),
        };
      }),
    );

    return { ok: true, data: enriched };
  } catch (error) {
    logger.error("listPalletsAction failed", { error });
    return { ok: false, error: t.common.operationFailed };
  }
}

/**
 * Get details for a specific pallet by ID.
 */
export async function getPalletAction(
  palletId: string,
): Promise<
  ActionResult<{
    id: string;
    barcodeValue: string;
    itemId: string;
    itemName: string;
    quantity: number;
    createdAt: string;
  }>
> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  try {
    const pallet = await db.itemBarcode.findFirst({
      where: {
        id: palletId,
        organizationId: membership.organizationId,
        type: "PALLET",
      },
      select: {
        id: true,
        value: true,
        item: { select: { id: true, name: true } },
        multiplier: true,
        createdAt: true,
      },
    });

    if (!pallet) {
      return { ok: false, error: t.common.notFound };
    }

    return {
      ok: true,
      data: {
        id: pallet.id,
        barcodeValue: pallet.value,
        itemId: pallet.item.id,
        itemName: pallet.item.name,
        quantity: pallet.multiplier,
        createdAt: pallet.createdAt.toISOString(),
      },
    };
  } catch (error) {
    logger.error("getPalletAction failed", { error });
    return { ok: false, error: t.common.operationFailed };
  }
}

/**
 * Delete a pallet barcode by marking it as inactive.
 */
export async function deletePalletAction(palletId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "assets.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  try {
    const pallet = await db.itemBarcode.findFirst({
      where: {
        id: palletId,
        organizationId: membership.organizationId,
        type: "PALLET",
      },
      select: { id: true, value: true },
    });

    if (!pallet) {
      return { ok: false, error: t.common.notFound };
    }

    await db.itemBarcode.update({
      where: { id: palletId },
      data: { isActive: false },
    });

    revalidatePath("/pallets");

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "label_template.deleted",
      entityType: "label_template",
      entityId: palletId,
      metadata: {
        type: "PALLET",
        barcodeValue: pallet.value,
      },
    });

    return { ok: true };
  } catch (error) {
    logger.error("deletePalletAction failed", { error });
    return { ok: false, error: t.common.operationFailed };
  }
}

/**
 * Get label data for printing a pallet barcode.
 */
export async function printPalletLabelAction(
  palletId: string,
): Promise<
  ActionResult<{
    id: string;
    barcodeValue: string;
    itemName: string;
    quantity: number;
    warehouseName: string;
    binCode: string | null;
  }>
> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  try {
    const pallet = await db.itemBarcode.findFirst({
      where: {
        id: palletId,
        organizationId: membership.organizationId,
        type: "PALLET",
      },
      select: {
        id: true,
        value: true,
        item: { select: { name: true } },
        multiplier: true,
      },
    });

    if (!pallet) {
      return { ok: false, error: t.common.notFound };
    }

    // Get warehouse/bin info
    const stockLevel = await db.stockLevel.findFirst({
      where: { itemId: pallet.item.name },
      select: {
        warehouse: { select: { name: true } },
        bin: { select: { code: true } },
      },
    });

    return {
      ok: true,
      data: {
        id: pallet.id,
        barcodeValue: pallet.value,
        itemName: pallet.item.name,
        quantity: pallet.multiplier,
        warehouseName: stockLevel?.warehouse?.name || "Unknown",
        binCode: stockLevel?.bin?.code || null,
      },
    };
  } catch (error) {
    logger.error("printPalletLabelAction failed", { error });
    return { ok: false, error: t.common.operationFailed };
  }
}

/**
 * Update a pallet label (quantity and notes).
 */
export async function updatePalletAction(
  palletId: string,
  input: UpdatePalletLabelInput,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "assets.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updatePalletLabelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.common.validationFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const pallet = await db.itemBarcode.findFirst({
      where: {
        id: palletId,
        organizationId: membership.organizationId,
        type: "PALLET",
      },
      select: { id: true, multiplier: true },
    });

    if (!pallet) {
      return { ok: false, error: t.common.notFound };
    }

    const data = parsed.data;
    await db.itemBarcode.update({
      where: { id: palletId },
      data: {
        multiplier: data.quantity,
        label: `Pallet: ${data.quantity} items`,
      },
    });

    revalidatePath("/pallets");

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "label_template.updated",
      entityType: "label_template",
      entityId: palletId,
      metadata: {
        type: "PALLET",
        previousQuantity: pallet.multiplier,
        newQuantity: data.quantity,
      },
    });

    return { ok: true };
  } catch (error) {
    logger.error("updatePalletAction failed", { error });
    return { ok: false, error: t.common.operationFailed };
  }
}
