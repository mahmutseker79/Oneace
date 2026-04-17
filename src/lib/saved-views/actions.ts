"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import type { ActionResult } from "@/lib/validation/action-result";
import {
  createSavedViewSchema,
  setDefaultViewSchema,
  updateSavedViewSchema,
} from "@/lib/validation/saved-view";

interface SavedViewItem {
  id: string;
  name: string;
  filters: unknown;
  sortBy: string | null;
  sortOrder: string | null;
  columns: unknown;
  isDefault: boolean;
  isShared: boolean;
}

export async function createSavedViewAction(input: Record<string, unknown>): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = createSavedViewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.common.validationFailed || "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  try {
    const view = await db.savedView.create({
      data: {
        organizationId: membership.organizationId,
        userId: session.user.id,
        page: data.page,
        name: data.name,
        filters: data.filters,
        sortBy: data.sortBy ?? null,
        sortOrder: data.sortOrder ?? null,
        columns: data.columns ?? [],
        isShared: data.isShared ?? false,
      },
      select: { id: true },
    });

    revalidatePath(`/${data.page}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "saved_view.created",
      entityType: "saved_view",
      entityId: view.id,
      metadata: { page: data.page, name: data.name, isShared: data.isShared },
    });

    return { ok: true, id: view.id };
  } catch (_error) {
    return { ok: false, error: t.common.operationFailed || "Failed to create saved view" };
  }
}

export async function updateSavedViewAction(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = updateSavedViewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.common.validationFailed || "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  try {
    // Verify the view belongs to the user or they have permission to edit shared views
    const view = await db.savedView.findFirst({
      where: {
        id,
        organization: { id: membership.organizationId },
      },
      select: { id: true, page: true, userId: true },
    });

    if (!view) {
      return { ok: false, error: t.common.notFound || "View not found" };
    }

    if (view.userId !== session.user.id) {
      return { ok: false, error: t.permissions.forbidden };
    }

    const updated = await db.savedView.update({
      where: { id },
      data: {
        ...(data.page && { page: data.page }),
        ...(data.name && { name: data.name }),
        ...(data.filters && { filters: data.filters }),
        ...(data.sortBy !== undefined && { sortBy: data.sortBy }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.columns && { columns: data.columns }),
        ...(data.isShared !== undefined && { isShared: data.isShared }),
      },
      select: { id: true, page: true },
    });

    revalidatePath(`/${updated.page}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "saved_view.updated",
      entityType: "saved_view",
      entityId: id,
      metadata: { page: updated.page },
    });

    return { ok: true, id: updated.id };
  } catch (_error) {
    return { ok: false, error: t.common.operationFailed || "Failed to update saved view" };
  }
}

export async function deleteSavedViewAction(id: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  try {
    // Verify the view belongs to the user
    const view = await db.savedView.findFirst({
      where: {
        id,
        organization: { id: membership.organizationId },
      },
      select: { id: true, page: true, userId: true },
    });

    if (!view) {
      return { ok: false, error: t.common.notFound || "View not found" };
    }

    if (view.userId !== session.user.id) {
      return { ok: false, error: t.permissions.forbidden };
    }

    await db.savedView.delete({
      where: { id },
    });

    revalidatePath(`/${view.page}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "saved_view.deleted",
      entityType: "saved_view",
      entityId: null,
      metadata: { viewId: id, page: view.page },
    });

    return { ok: true, id };
  } catch (_error) {
    return { ok: false, error: t.common.operationFailed || "Failed to delete saved view" };
  }
}

export async function getSavedViewsAction(
  page: string,
): Promise<ActionResult<{ views: SavedViewItem[] }>> {
  const { membership } = await requireActiveMembership();

  try {
    const views = await db.savedView.findMany({
      where: {
        organizationId: membership.organizationId,
        page,
        OR: [{ userId: null }, { isShared: true }],
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        filters: true,
        sortBy: true,
        sortOrder: true,
        columns: true,
        isDefault: true,
        isShared: true,
      },
    });

    return { ok: true, views };
  } catch (_error) {
    return { ok: false, error: "Failed to fetch saved views" };
  }
}

export async function setDefaultViewAction(input: Record<string, unknown>): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = setDefaultViewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.common.validationFailed || "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;

  try {
    // Verify the view belongs to the user
    const view = await db.savedView.findFirst({
      where: {
        id: data.id,
        organizationId: membership.organizationId,
      },
      select: { id: true, page: true, userId: true },
    });

    if (!view) {
      return { ok: false, error: t.common.notFound || "View not found" };
    }

    if (view.userId !== session.user.id) {
      return { ok: false, error: t.permissions.forbidden };
    }

    // Clear other defaults for this user + page, then set this one
    await db.$transaction(async (tx) => {
      await tx.savedView.updateMany({
        where: {
          userId: session.user.id,
          page: data.page,
        },
        data: { isDefault: false },
      });

      await tx.savedView.update({
        where: { id: data.id },
        data: { isDefault: true },
      });
    });

    revalidatePath(`/${data.page}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "saved_view.set_default",
      entityType: "saved_view",
      entityId: data.id,
      metadata: { page: data.page },
    });

    return { ok: true, id: data.id };
  } catch (_error) {
    return { ok: false, error: t.common.operationFailed || "Failed to set default view" };
  }
}
