"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability, planCapabilityError } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  assignPickTaskSchema,
  completePickTaskSchema,
  createPickTaskSchema,
} from "@/lib/validation/pick-task";

export type { ActionResult };

export async function createPickTaskAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "picks.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  if (!hasPlanCapability(membership.organization.plan as "FREE" | "PRO" | "BUSINESS", "picks")) {
    return { ok: false, error: planCapabilityError("picks") };
  }

  const raw: Record<string, unknown> = Object.fromEntries(formData);
  for (const key of Object.keys(raw)) {
    if (raw[key] === "__none__") raw[key] = "";
  }

  const parsed = createPickTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.picks?.errors?.createFailed ?? "Failed to create pick task",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

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
      return { ok: false, error: t.picks?.errors?.itemNotFound ?? "Item or warehouse not found" };
    }

    const created = await db.pickTask.create({
      data: {
        organizationId: orgId,
        itemId: input.itemId,
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        fromBinId: input.fromBinId,
        quantity: input.quantity,
        status: "PENDING",
        salesOrderLineId: input.salesOrderLineId,
        note: input.note,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "pick_task.created",
      entityType: "pick_task",
      entityId: created.id,
      metadata: {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        manual: true,
      },
    });

    revalidatePath("/picks");
    return { ok: true, id: created.id };
  } catch (_error) {
    return { ok: false, error: t.picks?.errors?.createFailed ?? "Failed to create pick task" };
  }
}

export async function generatePicksFromSalesOrderAction(
  salesOrderId: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "picks.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  try {
    const salesOrder = await db.salesOrder.findFirst({
      where: { id: salesOrderId, organizationId: orgId },
      select: {
        id: true,
        status: true,
        lines: {
          select: {
            id: true,
            itemId: true,
            variantId: true,
            warehouseId: true,
            allocatedQty: true,
            shippedQty: true,
            orderedQty: true,
          },
        },
      },
    });

    if (!salesOrder) {
      return { ok: false, error: t.picks?.errors?.notFound ?? "Sales order not found" };
    }

    if (salesOrder.status !== "ALLOCATED" && salesOrder.status !== "PARTIALLY_SHIPPED") {
      return {
        ok: false,
        error: t.picks?.errors?.generateFailed ?? "Sales order must be allocated",
      };
    }

    let createdCount = 0;
    await db.$transaction(async (tx) => {
      for (const line of salesOrder.lines) {
        const toPickQty = line.allocatedQty - line.shippedQty;
        if (toPickQty > 0) {
          await tx.pickTask.create({
            data: {
              organizationId: orgId,
              itemId: line.itemId,
              variantId: line.variantId,
              warehouseId: line.warehouseId,
              quantity: toPickQty,
              status: "PENDING",
              salesOrderLineId: line.id,
            },
          });
          createdCount++;
        }
      }
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "pick_task.generated_from_so",
      entityType: "pick_task",
      entityId: null,
      metadata: {
        salesOrderId,
        createdCount,
      },
    });

    revalidatePath("/picks");
    return { ok: true, id: salesOrderId };
  } catch (_error) {
    return { ok: false, error: t.picks?.errors?.generateFailed ?? "Failed to generate pick tasks" };
  }
}

export async function assignPickTaskAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "picks.assign")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = assignPickTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.picks?.errors?.assignFailed ?? "Failed to assign task",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  try {
    const task = await db.pickTask.findFirst({
      where: { id: input.taskId, organizationId: orgId },
      select: { id: true, status: true },
    });

    if (!task) {
      return { ok: false, error: t.picks?.errors?.notFound ?? "Pick task not found" };
    }

    if (task.status !== "PENDING") {
      return { ok: false, error: t.picks?.errors?.assignFailed ?? "Cannot assign this task" };
    }

    await db.pickTask.update({
      where: { id: input.taskId },
      data: {
        status: "ASSIGNED",
        assignedToUserId: input.assignedToUserId,
      },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "pick_task.assigned",
      entityType: "pick_task",
      entityId: input.taskId,
      metadata: {
        assignedToUserId: input.assignedToUserId,
      },
    });

    revalidatePath("/picks");
    revalidatePath(`/picks/${input.taskId}`);
    return { ok: true, id: input.taskId };
  } catch (_error) {
    return { ok: false, error: t.picks?.errors?.assignFailed ?? "Failed to assign task" };
  }
}

export async function startPickTaskAction(taskId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "picks.start")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  try {
    const task = await db.pickTask.findFirst({
      where: { id: taskId, organizationId: orgId },
      select: { id: true, status: true },
    });

    if (!task) {
      return { ok: false, error: t.picks?.errors?.notFound ?? "Pick task not found" };
    }

    if (task.status !== "ASSIGNED") {
      return { ok: false, error: t.picks?.errors?.startFailed ?? "Cannot start this task" };
    }

    await db.pickTask.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS" },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "pick_task.started",
      entityType: "pick_task",
      entityId: taskId,
      metadata: {},
    });

    revalidatePath("/picks");
    revalidatePath(`/picks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (_error) {
    return { ok: false, error: t.picks?.errors?.startFailed ?? "Failed to start task" };
  }
}

export async function completePickTaskAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "picks.complete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = completePickTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.picks?.errors?.completeFailed ?? "Failed to complete task",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const input = parsed.data;
  const orgId = membership.organizationId;

  try {
    const task = await db.pickTask.findFirst({
      where: { id: input.taskId, organizationId: orgId },
      select: { id: true, status: true },
    });

    if (!task) {
      return { ok: false, error: t.picks?.errors?.notFound ?? "Pick task not found" };
    }

    if (task.status !== "IN_PROGRESS") {
      return { ok: false, error: t.picks?.errors?.completeFailed ?? "Cannot complete this task" };
    }

    await db.pickTask.update({
      where: { id: input.taskId },
      data: { status: "PICKED", pickedAt: new Date() },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "pick_task.completed",
      entityType: "pick_task",
      entityId: input.taskId,
      metadata: {},
    });

    revalidatePath("/picks");
    revalidatePath(`/picks/${input.taskId}`);
    return { ok: true, id: input.taskId };
  } catch (_error) {
    return { ok: false, error: t.picks?.errors?.completeFailed ?? "Failed to complete task" };
  }
}

export async function verifyPickTaskAction(taskId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "picks.verify")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  try {
    const task = await db.pickTask.findFirst({
      where: { id: taskId, organizationId: orgId },
      select: { id: true, status: true },
    });

    if (!task) {
      return { ok: false, error: t.picks?.errors?.notFound ?? "Pick task not found" };
    }

    if (task.status !== "PICKED") {
      return { ok: false, error: t.picks?.errors?.verifyFailed ?? "Cannot verify this task" };
    }

    await db.pickTask.update({
      where: { id: taskId },
      data: { status: "VERIFIED", verifiedAt: new Date() },
    });

    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "pick_task.verified",
      entityType: "pick_task",
      entityId: taskId,
      metadata: {},
    });

    revalidatePath("/picks");
    revalidatePath(`/picks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (_error) {
    return { ok: false, error: t.picks?.errors?.verifyFailed ?? "Failed to verify task" };
  }
}
