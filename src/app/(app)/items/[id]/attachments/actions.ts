"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import type { ActionResult } from "@/lib/validation/action-result";
import { reorderAttachmentsSchema, uploadAttachmentSchema } from "@/lib/validation/attachment";

export async function uploadAttachmentAction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "items.attachments.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = uploadAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.attachmentFailed || "Invalid attachment data",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Verify item exists and belongs to the organization
  const item = await db.item.findFirst({
    where: { id: data.itemId, organizationId: membership.organizationId },
    select: { id: true },
  });

  if (!item) {
    return { ok: false, error: t.items.errors.notFound };
  }

  try {
    // Get max sortOrder for this item
    const maxSort = await db.itemAttachment.findFirst({
      where: { itemId: data.itemId },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
    });

    const attachment = await db.itemAttachment.create({
      data: {
        organizationId: membership.organizationId,
        itemId: data.itemId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType as "IMAGE" | "DOCUMENT" | "DATASHEET" | "CERTIFICATE" | "OTHER",
        fileSize: data.fileSize,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
        uploadedByUserId: session.user.id,
      },
      select: { id: true },
    });

    revalidatePath(`/items/${data.itemId}/attachments`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "attachment.created",
      entityType: "attachment",
      entityId: attachment.id,
      metadata: { itemId: data.itemId, fileName: data.fileName, fileSize: data.fileSize },
    });

    return { ok: true, id: attachment.id };
  } catch (_error) {
    return { ok: false, error: t.items.errors.attachmentFailed || "Failed to upload attachment" };
  }
}

export async function deleteAttachmentAction(
  itemId: string,
  attachmentId: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "items.attachments.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Verify item exists and belongs to the organization
  const item = await db.item.findFirst({
    where: { id: itemId, organizationId: membership.organizationId },
    select: { id: true },
  });

  if (!item) {
    return { ok: false, error: t.items.errors.notFound };
  }

  try {
    const attachment = await db.itemAttachment.findFirst({
      where: { id: attachmentId, itemId },
      select: { id: true, fileName: true },
    });

    if (!attachment) {
      return { ok: false, error: t.items.errors.attachmentNotFound || "Attachment not found" };
    }

    await db.itemAttachment.delete({
      where: { id: attachmentId },
    });

    revalidatePath(`/items/${itemId}/attachments`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "attachment.deleted",
      entityType: "attachment",
      entityId: null,
      metadata: { attachmentId, itemId, fileName: attachment.fileName },
    });

    return { ok: true, id: attachmentId };
  } catch (_error) {
    return { ok: false, error: t.items.errors.attachmentFailed || "Failed to delete attachment" };
  }
}

export async function reorderAttachmentsAction(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "items.attachments.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = reorderAttachmentsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.attachmentFailed || "Invalid input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  // Verify item exists and belongs to the organization
  const item = await db.item.findFirst({
    where: { id: data.itemId, organizationId: membership.organizationId },
    select: { id: true },
  });

  if (!item) {
    return { ok: false, error: t.items.errors.notFound };
  }

  try {
    // Update sortOrder for each attachment
    const updates = data.attachmentIds.map((id, index) =>
      db.itemAttachment.update({
        where: { id, itemId: data.itemId },
        data: { sortOrder: index },
      }),
    );

    await db.$transaction(updates);

    revalidatePath(`/items/${data.itemId}/attachments`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "attachment.reordered",
      entityType: "attachment",
      entityId: null,
      metadata: { itemId: data.itemId, count: data.attachmentIds.length },
    });

    return { ok: true, id: data.itemId };
  } catch (_error) {
    return { ok: false, error: t.items.errors.attachmentFailed || "Failed to reorder attachments" };
  }
}
