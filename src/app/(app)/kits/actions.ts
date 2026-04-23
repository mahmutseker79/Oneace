"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
// GOD MODE roadmap P0-01 (rc3): StockMovement inserts must flow through
// the postMovement seam. 4 callsites: assemble (issue components + receipt
// parent) and disassemble (issue parent + receipt components).
import { postMovement } from "@/lib/movements";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability, planCapabilityError } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { upsertStockLevel } from "@/lib/stock-level-upsert";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  addKitComponentSchema,
  assembleKitSchema,
  createKitSchema,
  disassembleKitSchema,
} from "@/lib/validation/kit";

export type { ActionResult };

export async function createKitAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "kits.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  if (!hasPlanCapability(membership.organization.plan as "FREE" | "PRO" | "BUSINESS", "kits")) {
    return { ok: false, error: planCapabilityError("kits") };
  }

  const raw: Record<string, unknown> = Object.fromEntries(formData);
  for (const key of Object.keys(raw)) {
    if (raw[key] === "__none__") raw[key] = "";
  }

  const parsed = createKitSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.kits?.errors?.createFailed ?? "Failed to create kit",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  try {
    // Verify parent item exists and is in org scope
    const parentItem = await db.item.findFirst({
      where: { id: input.parentItemId, organizationId: orgId },
      select: { id: true },
    });

    if (!parentItem) {
      return { ok: false, error: t.kits?.errors?.itemNotFound ?? "Parent item not found" };
    }

    const created = await db.kit.create({
      data: {
        organizationId: orgId,
        parentItemId: input.parentItemId,
        name: input.name,
        description: input.description,
        type: input.type,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "kit.created",
      entityType: "kit",
      entityId: created.id,
      metadata: {
        parentItemId: input.parentItemId,
        name: input.name,
        type: input.type,
      },
    });

    revalidatePath("/kits");
    return { ok: true, id: created.id };
  } catch (_error) {
    return { ok: false, error: t.kits?.errors?.createFailed ?? "Failed to create kit" };
  }
}

export async function addKitComponentAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "kits.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const raw: Record<string, unknown> = Object.fromEntries(formData);
  for (const key of Object.keys(raw)) {
    if (raw[key] === "__none__") raw[key] = "";
  }

  const parsed = addKitComponentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.kits?.errors?.addComponentFailed ?? "Failed to add component",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  try {
    const [kit, componentItem] = await Promise.all([
      db.kit.findFirst({
        where: { id: input.kitId, organizationId: orgId },
        select: { id: true },
      }),
      db.item.findFirst({
        where: { id: input.componentItemId, organizationId: orgId },
        select: { id: true },
      }),
    ]);

    if (!kit || !componentItem) {
      return { ok: false, error: t.kits?.errors?.itemNotFound ?? "Kit or item not found" };
    }

    await db.kitComponent.create({
      data: {
        kitId: input.kitId,
        componentItemId: input.componentItemId,
        variantId: input.variantId,
        quantity: new Prisma.Decimal(input.quantity),
      },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "kit.component_added",
      entityType: "kit",
      entityId: input.kitId,
      metadata: {
        componentItemId: input.componentItemId,
        quantityPerKit: input.quantity,
      },
    });

    revalidatePath("/kits");
    revalidatePath(`/kits/${input.kitId}`);
    return { ok: true, id: input.kitId };
  } catch (_error) {
    return { ok: false, error: t.kits?.errors?.addComponentFailed ?? "Failed to add component" };
  }
}

export async function removeKitComponentAction(componentId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "kits.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  try {
    const component = await db.kitComponent.findFirst({
      where: { id: componentId },
      select: { kitId: true, kit: { select: { organizationId: true } } },
    });

    if (!component || component.kit.organizationId !== orgId) {
      return { ok: false, error: t.kits?.errors?.notFound ?? "Component not found" };
    }

    await db.kitComponent.delete({ where: { id: componentId } });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "kit.component_removed",
      entityType: "kit",
      entityId: component.kitId,
      metadata: { componentId },
    });

    revalidatePath("/kits");
    revalidatePath(`/kits/${component.kitId}`);
    return { ok: true, id: component.kitId };
  } catch (_error) {
    return {
      ok: false,
      error: t.kits?.errors?.removeComponentFailed ?? "Failed to remove component",
    };
  }
}

export async function assembleKitAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "kits.assemble")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = assembleKitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.kits?.errors?.assembleFailed ?? "Failed to assemble kit",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  try {
    const kit = await db.kit.findFirst({
      where: { id: input.kitId, organizationId: orgId },
      select: {
        id: true,
        parentItemId: true,
        components: {
          select: { componentItemId: true, quantity: true },
        },
      },
    });

    if (!kit) {
      return { ok: false, error: t.kits?.errors?.notFound ?? "Kit not found" };
    }

    await db.$transaction(async (tx) => {
      // Check stock for all components
      for (const comp of kit.components) {
        const stock = await tx.stockLevel.findFirst({
          where: {
            itemId: comp.componentItemId,
            warehouseId: input.warehouseId,
          },
          select: { quantity: true },
        });

        const needed = Number(comp.quantity) * input.quantity;
        const available = stock?.quantity ?? 0;

        if (available < needed) {
          throw new Error(`Insufficient stock for component ${comp.componentItemId}`);
        }
      }

      // Issue components
      for (const comp of kit.components) {
        const delta = Number(comp.quantity) * input.quantity;

        // rc3 seam — assemble: issue component.
        await postMovement(tx, {
          organizationId: orgId,
          itemId: comp.componentItemId,
          warehouseId: input.warehouseId,
          type: "ISSUE",
          quantity: delta,
          direction: -1,
          reference: `KIT-${kit.id}`,
          note: input.note,
          createdByUserId: session.user.id,
        });

        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: comp.componentItemId,
          warehouseId: input.warehouseId,
          quantityDelta: -delta,
        });
      }

      // Receipt parent item. rc3 seam — assemble: receive parent.
      await postMovement(tx, {
        organizationId: orgId,
        itemId: kit.parentItemId,
        warehouseId: input.warehouseId,
        type: "RECEIPT",
        quantity: input.quantity,
        direction: 1,
        reference: `KIT-${kit.id}`,
        note: input.note,
        createdByUserId: session.user.id,
      });

      await upsertStockLevel(tx, {
        organizationId: orgId,
        itemId: kit.parentItemId,
        warehouseId: input.warehouseId,
        quantityDelta: input.quantity,
      });
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "kit.assembled",
      entityType: "kit",
      entityId: kit.id,
      metadata: {
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        componentCount: kit.components.length,
      },
    });

    revalidatePath("/kits");
    revalidatePath(`/kits/${kit.id}`);
    return { ok: true, id: kit.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Insufficient stock")) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: t.kits?.errors?.assembleFailed ?? "Failed to assemble kit" };
  }
}

export async function disassembleKitAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "kits.disassemble")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = disassembleKitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.kits?.errors?.disassembleFailed ?? "Failed to disassemble kit",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  try {
    const kit = await db.kit.findFirst({
      where: { id: input.kitId, organizationId: orgId },
      select: {
        id: true,
        parentItemId: true,
        components: {
          select: { componentItemId: true, quantity: true },
        },
      },
    });

    if (!kit) {
      return { ok: false, error: t.kits?.errors?.notFound ?? "Kit not found" };
    }

    await db.$transaction(async (tx) => {
      // Check parent item stock
      const parentStock = await tx.stockLevel.findFirst({
        where: {
          itemId: kit.parentItemId,
          warehouseId: input.warehouseId,
        },
        select: { quantity: true },
      });

      if ((parentStock?.quantity ?? 0) < input.quantity) {
        throw new Error("Insufficient kit stock to disassemble");
      }

      // Issue parent item. rc3 seam — disassemble: issue parent.
      await postMovement(tx, {
        organizationId: orgId,
        itemId: kit.parentItemId,
        warehouseId: input.warehouseId,
        type: "ISSUE",
        quantity: input.quantity,
        direction: -1,
        reference: `KIT-${kit.id}`,
        note: input.note,
        createdByUserId: session.user.id,
      });

      await upsertStockLevel(tx, {
        organizationId: orgId,
        itemId: kit.parentItemId,
        warehouseId: input.warehouseId,
        quantityDelta: -input.quantity,
      });

      // Receipt components
      for (const comp of kit.components) {
        const delta = Number(comp.quantity) * input.quantity;

        // rc3 seam — disassemble: receipt component.
        await postMovement(tx, {
          organizationId: orgId,
          itemId: comp.componentItemId,
          warehouseId: input.warehouseId,
          type: "RECEIPT",
          quantity: delta,
          direction: 1,
          reference: `KIT-${kit.id}`,
          note: input.note,
          createdByUserId: session.user.id,
        });

        await upsertStockLevel(tx, {
          organizationId: orgId,
          itemId: comp.componentItemId,
          warehouseId: input.warehouseId,
          quantityDelta: delta,
        });
      }
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "kit.disassembled",
      entityType: "kit",
      entityId: kit.id,
      metadata: {
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        componentCount: kit.components.length,
      },
    });

    revalidatePath("/kits");
    revalidatePath(`/kits/${kit.id}`);
    return { ok: true, id: kit.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Insufficient")) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: t.kits?.errors?.disassembleFailed ?? "Failed to disassemble kit" };
  }
}
