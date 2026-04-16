"use server";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import type { ActionResult } from "@/lib/validation/action-result";
import {
  type UpdateOrgSettingsInput,
  updateOrgSettingsSchema,
} from "@/lib/validation/org-settings";
import { revalidatePath } from "next/cache";

/**
 * Phase L9 — Update organization settings.
 *
 * Upserts OrgSettings for the active organization with the provided config.
 * Any field present in the input is updated; absent fields are left alone.
 * Records a full audit entry on success.
 *
 * Returns ActionResult<OrgSettings> following the pattern from src/app/(app)/settings/actions.ts.
 */
export async function updateOrgSettingsAction(
  input: UpdateOrgSettingsInput,
): Promise<ActionResult<{ data: any }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "org.editDefaults")) {
    return { ok: false, error: t.permissions?.forbidden ?? "Forbidden" };
  }

  const parsed = updateOrgSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    // Snapshot before values for audit
    const before = await db.orgSettings.findUnique({
      where: { organizationId: membership.organizationId },
      select: {
        transferNumberPrefix: true,
        salesOrderPrefix: true,
        assetTagPrefix: true,
        batchNumberPrefix: true,
        requireCountApproval: true,
        varianceThreshold: true,
        recountOnThreshold: true,
        defaultCountMethodology: true,
        allowNegativeStock: true,
        defaultStockStatus: true,
        dateFormat: true,
        currencySymbol: true,
      },
    });

    const updated = await db.orgSettings.upsert({
      where: { organizationId: membership.organizationId },
      create: {
        organizationId: membership.organizationId,
        ...parsed.data,
      },
      update: parsed.data,
      select: {
        id: true,
        organizationId: true,
        transferNumberPrefix: true,
        transferNumberSequence: true,
        salesOrderPrefix: true,
        salesOrderSequence: true,
        assetTagPrefix: true,
        assetTagSequence: true,
        batchNumberPrefix: true,
        batchNumberSequence: true,
        requireCountApproval: true,
        varianceThreshold: true,
        recountOnThreshold: true,
        defaultCountMethodology: true,
        allowNegativeStock: true,
        defaultStockStatus: true,
        dateFormat: true,
        currencySymbol: true,
      },
    });

    // Record audit with before/after diff
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "organization.updated",
      entityType: "org_settings",
      entityId: updated.id,
      metadata: {
        before: before ?? {},
        after: parsed.data,
      },
    });

    revalidatePath("/settings");

    return { ok: true, data: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return { ok: false, error: message };
  }
}

/**
 * Phase L9 — Fetch or create org settings with defaults.
 *
 * Used by the settings page to populate the form.
 * If OrgSettings doesn't exist yet, this returns the seeded defaults.
 */
export async function getOrCreateOrgSettingsAction(): Promise<ActionResult<{ data: any }>> {
  const { membership } = await requireActiveMembership();

  try {
    const settings = await db.orgSettings.upsert({
      where: { organizationId: membership.organizationId },
      create: {
        organizationId: membership.organizationId,
        transferNumberPrefix: "TRF",
        transferNumberSequence: 1,
        salesOrderPrefix: "SO",
        salesOrderSequence: 1,
        assetTagPrefix: "FA",
        assetTagSequence: 1,
        batchNumberPrefix: "LOT",
        batchNumberSequence: 1,
        requireCountApproval: false,
        varianceThreshold: "5.00",
        recountOnThreshold: true,
        defaultCountMethodology: "FULL",
        allowNegativeStock: false,
        defaultStockStatus: "AVAILABLE",
        dateFormat: "MM/DD/YYYY",
        currencySymbol: "$",
      },
      update: {},
      select: {
        id: true,
        organizationId: true,
        transferNumberPrefix: true,
        transferNumberSequence: true,
        salesOrderPrefix: true,
        salesOrderSequence: true,
        assetTagPrefix: true,
        assetTagSequence: true,
        batchNumberPrefix: true,
        batchNumberSequence: true,
        requireCountApproval: true,
        varianceThreshold: true,
        recountOnThreshold: true,
        defaultCountMethodology: true,
        allowNegativeStock: true,
        defaultStockStatus: true,
        dateFormat: true,
        currencySymbol: true,
      },
    });

    return { ok: true, data: settings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    return { ok: false, error: message };
  }
}
