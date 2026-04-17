"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import { createReasonCodeSchema, updateReasonCodeSchema } from "@/lib/validation/reason-code";

export type { ActionResult };

function revalidateReasonCodes() {
  revalidatePath("/settings/reason-codes");
}

/**
 * Create a new reason code for the organization.
 * Requires code uniqueness within the organization.
 */
export async function createReasonCodeAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "settings.manage")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createReasonCodeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid reason code data",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

  try {
    const code = await db.reasonCode.create({
      data: {
        organizationId: orgId,
        code: data.code,
        name: data.name,
        category: data.category,
        description: data.description,
        isActive: true,
        sortOrder: 0,
      },
      select: { id: true },
    });

    revalidateReasonCodes();
    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "reason_code.created",
      entityType: "reason_code",
      entityId: code.id,
      metadata: {
        code: data.code,
        name: data.name,
        category: data.category,
      },
    });

    return { ok: true, id: code.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: "A reason code with this code already exists",
        fieldErrors: { code: ["Already exists"] },
      };
    }
    return { ok: false, error: "Failed to create reason code" };
  }
}

/**
 * Update an existing reason code.
 */
export async function updateReasonCodeAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "settings.manage")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updateReasonCodeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid reason code data",
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;
  const orgId = membership.organizationId;

  // Verify the reason code belongs to this org
  const existing = await db.reasonCode.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, code: true, name: true, category: true },
  });

  if (!existing) {
    return { ok: false, error: "Reason code not found" };
  }

  try {
    const updated = await db.reasonCode.update({
      where: { id },
      data: {
        ...(data.code && { code: data.code }),
        ...(data.name && { name: data.name }),
        ...(data.category && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
      },
      select: { id: true },
    });

    revalidateReasonCodes();
    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "reason_code.updated",
      entityType: "reason_code",
      entityId: updated.id,
      metadata: {
        code: data.code ?? existing.code,
        name: data.name ?? existing.name,
        category: data.category ?? existing.category,
      },
    });

    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: "A reason code with this code already exists",
        fieldErrors: { code: ["Already exists"] },
      };
    }
    return { ok: false, error: "Failed to update reason code" };
  }
}

/**
 * Toggle the active status of a reason code.
 */
export async function toggleReasonCodeActiveAction(
  id: string,
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "settings.manage")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const orgId = membership.organizationId;

  // Verify the reason code belongs to this org
  const existing = await db.reasonCode.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, isActive: true, code: true },
  });

  if (!existing) {
    return { ok: false, error: "Reason code not found" };
  }

  try {
    const updated = await db.reasonCode.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: { id: true, isActive: true },
    });

    revalidateReasonCodes();
    await recordAudit({
      organizationId: orgId,
      actorId: session.user.id,
      action: "reason_code.toggled",
      entityType: "reason_code",
      entityId: updated.id,
      metadata: {
        code: existing.code,
        newIsActive: updated.isActive,
      },
    });

    return { ok: true, id: updated.id, isActive: updated.isActive };
  } catch {
    return { ok: false, error: "Failed to toggle reason code" };
  }
}

/**
 * Seed default reason codes for an organization.
 * Creates 10 predefined reason codes covering common scenarios.
 * Idempotent: if codes already exist, skips silently.
 */
export async function seedDefaultReasonCodesAction(
  orgId: string,
): Promise<ActionResult<{ seeded: number }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "settings.manage")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Only allow seeding for your own org
  if (membership.organizationId !== orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const defaults = [
    {
      code: "DMG",
      name: "Damage",
      category: "VARIANCE" as const,
      description: "Stock found damaged during count",
    },
    {
      code: "THEFT",
      name: "Theft/Shrinkage",
      category: "VARIANCE" as const,
      description: "Stock loss due to theft or unaccounted shrinkage",
    },
    {
      code: "MISPICK",
      name: "Mispick",
      category: "VARIANCE" as const,
      description: "Incorrect item picked or counted",
    },
    {
      code: "RCV_ERR",
      name: "Receiving Error",
      category: "VARIANCE" as const,
      description: "Error during goods receipt process",
    },
    {
      code: "EXPIRED",
      name: "Expired Stock",
      category: "DISPOSAL" as const,
      description: "Stock past expiration date",
    },
    {
      code: "COUNT_ERR",
      name: "Count Error",
      category: "COUNT" as const,
      description: "Counting mistake or recount required",
    },
    {
      code: "WRONG_LOC",
      name: "Wrong Location",
      category: "ADJUSTMENT" as const,
      description: "Stock found in wrong bin or location",
    },
    {
      code: "RETURN",
      name: "Customer Return",
      category: "RETURN" as const,
      description: "Stock returned by customer",
    },
    {
      code: "SCRAP",
      name: "Scrapped/Damaged",
      category: "DISPOSAL" as const,
      description: "Stock scrapped or damaged beyond use",
    },
    {
      code: "OTHER",
      name: "Other",
      category: "OTHER" as const,
      description: "Other reason not listed above",
    },
  ];

  try {
    let seeded = 0;
    for (const def of defaults) {
      const existing = await db.reasonCode.findFirst({
        where: { organizationId: orgId, code: def.code },
        select: { id: true },
      });

      if (!existing) {
        await db.reasonCode.create({
          data: {
            organizationId: orgId,
            code: def.code,
            name: def.name,
            category: def.category,
            description: def.description,
            isActive: true,
            isDefault: true,
            sortOrder: seeded,
          },
        });
        seeded++;
      }
    }

    if (seeded > 0) {
      revalidateReasonCodes();
      await recordAudit({
        organizationId: orgId,
        actorId: session.user.id,
        action: "reason_code.seeded",
        entityType: "organization",
        entityId: orgId,
        metadata: { count: seeded },
      });
    }

    return { ok: true, seeded };
  } catch {
    return { ok: false, error: "Failed to seed reason codes" };
  }
}
