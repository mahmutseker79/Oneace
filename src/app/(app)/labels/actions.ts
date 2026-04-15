"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability, planCapabilityError } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { labelTemplateInputSchema } from "@/lib/validation/label-template";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function formToInput(formData: FormData) {
  return Object.fromEntries(formData);
}

export async function createLabelTemplateAction(
  formData: FormData,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "labels.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Phase C — labels require PRO or BUSINESS plan
  const labelPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(labelPlan, "labels")) {
    return { ok: false, error: planCapabilityError("labels") };
  }

  const parsed = labelTemplateInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Failed to create label template",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const template = await db.labelTemplate.create({
      data: {
        organizationId: membership.organizationId,
        name: input.name,
        type: input.type,
        width: input.width,
        height: input.height,
        barcodeFormat: input.barcodeFormat,
        layout: input.layout ? (input.layout as never) : (undefined as never),
        isDefault: input.isDefault ?? false,
      },
      select: { id: true },
    });

    revalidatePath("/labels");
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "label_template.created",
      entityType: "label_template",
      entityId: template.id,
      metadata: { name: input.name, type: input.type },
    });
    return { ok: true, id: template.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const errorMsg = "A label template with this name already exists";
        return {
          ok: false,
          error: errorMsg,
          fieldErrors: { name: [errorMsg] },
        };
      }
    }
    return { ok: false, error: "Failed to create label template" };
  }
}

export async function updateLabelTemplateAction(
  templateId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "labels.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = labelTemplateInputSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Failed to update label template",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  try {
    const updated = await db.labelTemplate.update({
      where: { id: templateId, organizationId: membership.organizationId },
      data: {
        name: input.name,
        type: input.type,
        width: input.width,
        height: input.height,
        barcodeFormat: input.barcodeFormat,
        layout: input.layout ? (input.layout as never) : (undefined as never),
        isDefault: input.isDefault ?? false,
      },
      select: { id: true },
    });

    revalidatePath("/labels");
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "label_template.updated",
      entityType: "label_template",
      entityId: updated.id,
      metadata: { name: input.name, type: input.type },
    });
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: "A label template with this name already exists",
          fieldErrors: { name: ["A label template with this name already exists"] },
        };
      }
      if (error.code === "P2025") {
        return { ok: false, error: "Label template not found" };
      }
    }
    return { ok: false, error: "Failed to update label template" };
  }
}

export async function deleteLabelTemplateAction(templateId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "labels.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  try {
    const target = await db.labelTemplate.findUnique({
      where: { id: templateId, organizationId: membership.organizationId },
      select: { name: true, type: true },
    });
    if (!target) {
      return { ok: false, error: "Label template not found" };
    }

    await db.labelTemplate.delete({ where: { id: templateId } });

    revalidatePath("/labels");
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "label_template.deleted",
      entityType: "label_template",
      entityId: null,
      metadata: { templateId, name: target.name, type: target.type },
    });
    return { ok: true, id: templateId };
  } catch {
    return { ok: false, error: "Failed to delete label template" };
  }
}
