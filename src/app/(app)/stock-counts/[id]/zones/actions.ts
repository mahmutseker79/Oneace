"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type ActionResult, cleanFieldErrors } from "@/lib/validation/action-result";
import {
  type CreateCountZoneInput,
  type UpdateCountZoneInput,
  createCountZoneInputSchema,
  updateCountZoneInputSchema,
} from "@/lib/validation/count-zone";

export type { ActionResult };

/**
 * Generate a unique 8-character alphanumeric barcode value
 */
function generateBarcodeValue(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function revalidateZones(countId: string) {
  revalidatePath(`/stock-counts/${countId}/zones`);
  revalidatePath(`/stock-counts/${countId}`);
}

/**
 * Create a new count zone
 */
export async function createZoneAction(countId: string, input: unknown): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "stockCounts.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createCountZoneInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.countZones.errors.createFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;

  // Verify the stock count exists and belongs to this organization
  const count = await db.stockCount.findFirst({
    where: { id: countId, organizationId: membership.organizationId },
    select: { id: true },
  });

  if (!count) {
    return { ok: false, error: t.countZones.errors.notFound };
  }

  // Verify parent zone exists and belongs to the same count (if provided)
  if (data.parentZoneId) {
    const parentZone = await db.countZone.findFirst({
      where: { id: data.parentZoneId, countId, organizationId: membership.organizationId },
      select: { id: true },
    });
    if (!parentZone) {
      return {
        ok: false,
        error: t.countZones.errors.notFound,
        fieldErrors: { parentZoneId: [t.countZones.errors.notFound] },
      };
    }
  }

  try {
    const zone = await db.countZone.create({
      data: {
        organizationId: membership.organizationId,
        countId,
        name: data.name,
        description: data.description,
        color: data.color,
        barcodeValue: data.barcodeValue || generateBarcodeValue(),
        barcodeFormat: data.barcodeFormat,
        parentZoneId: data.parentZoneId,
        promoteToBin: data.promoteToBin,
        createdByUserId: session.user.id,
      },
      select: { id: true },
    });

    revalidateZones(countId);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "count_zone.created",
      entityType: "count_zone",
      entityId: zone.id,
      metadata: {
        countId,
        name: data.name,
        barcodeValue: data.barcodeValue || "(auto-generated)",
      },
    });

    return { ok: true, id: zone.id };
  } catch (error) {
    return { ok: false, error: t.countZones.errors.createFailed };
  }
}

/**
 * Update a count zone
 */
export async function updateZoneAction(zoneId: string, input: unknown): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "stockCounts.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updateCountZoneInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: t.countZones.errors.updateFailed,
      fieldErrors: cleanFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const data = parsed.data;

  // Verify the zone exists and belongs to this organization
  const zone = await db.countZone.findFirst({
    where: { id: zoneId, organizationId: membership.organizationId },
    select: { id: true, countId: true },
  });

  if (!zone) {
    return { ok: false, error: t.countZones.errors.notFound };
  }

  // Verify parent zone exists and belongs to the same count (if provided)
  if (data.parentZoneId) {
    const parentZone = await db.countZone.findFirst({
      where: {
        id: data.parentZoneId,
        countId: zone.countId,
        organizationId: membership.organizationId,
      },
      select: { id: true },
    });
    if (!parentZone) {
      return {
        ok: false,
        error: t.countZones.errors.notFound,
        fieldErrors: { parentZoneId: [t.countZones.errors.notFound] },
      };
    }
  }

  try {
    const updated = await db.countZone.update({
      where: { id: zoneId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.barcodeValue && { barcodeValue: data.barcodeValue }),
        ...(data.barcodeFormat && { barcodeFormat: data.barcodeFormat }),
        ...(data.parentZoneId !== undefined && { parentZoneId: data.parentZoneId }),
        ...(data.promoteToBin !== undefined && { promoteToBin: data.promoteToBin }),
      },
      select: { id: true, countId: true },
    });

    revalidateZones(updated.countId);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "count_zone.updated",
      entityType: "count_zone",
      entityId: zoneId,
      metadata: {
        countId: updated.countId,
        changes: Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined),
      },
    });

    return { ok: true, id: zoneId };
  } catch (error) {
    return { ok: false, error: t.countZones.errors.updateFailed };
  }
}

/**
 * Delete a count zone
 */
export async function deleteZoneAction(
  zoneId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "stockCounts.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Verify the zone exists and belongs to this organization
  const zone = await db.countZone.findFirst({
    where: { id: zoneId, organizationId: membership.organizationId },
    select: { id: true, countId: true, _count: { select: { entries: true } } },
  });

  if (!zone) {
    return { ok: false, error: t.countZones.errors.notFound };
  }

  // Prevent deletion if the zone has count entries
  if (zone._count.entries > 0) {
    return { ok: false, error: t.countZones.errors.deleteHasEntries };
  }

  try {
    await db.countZone.delete({
      where: { id: zoneId },
    });

    revalidateZones(zone.countId);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "count_zone.deleted",
      entityType: "count_zone",
      entityId: zoneId,
      metadata: {
        countId: zone.countId,
      },
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: t.countZones.errors.deleteFailed };
  }
}

export type CountZoneData = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  barcodeValue: string | null;
  barcodeFormat: string;
  parentZoneId: string | null;
  promoteToBin: boolean;
  _count: { entries: number };
};

export type ListZonesResult = { ok: true; zones: CountZoneData[] } | { ok: false; error: string };

/**
 * List all zones for a stock count
 */
export async function listZonesAction(countId: string): Promise<ListZonesResult> {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Verify the stock count exists and belongs to this organization
  const count = await db.stockCount.findFirst({
    where: { id: countId, organizationId: membership.organizationId },
    select: { id: true },
  });

  if (!count) {
    return { ok: false, error: t.countZones.errors.notFound };
  }

  try {
    const zones = await db.countZone.findMany({
      where: { countId, organizationId: membership.organizationId, isArchived: false },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        barcodeValue: true,
        barcodeFormat: true,
        parentZoneId: true,
        promoteToBin: true,
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return { ok: true, zones };
  } catch (error) {
    return { ok: false, error: t.countZones.errors.createFailed };
  }
}

/**
 * Generate barcodes for all zones in a stock count that don't have one
 */
export async function generateZoneBarcodesAction(
  countId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "stockCounts.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Verify the stock count exists and belongs to this organization
  const count = await db.stockCount.findFirst({
    where: { id: countId, organizationId: membership.organizationId },
    select: { id: true },
  });

  if (!count) {
    return { ok: false, error: t.countZones.errors.notFound };
  }

  try {
    // Find all zones without a barcode
    const zonesWithoutBarcode = await db.countZone.findMany({
      where: {
        countId,
        organizationId: membership.organizationId,
        barcodeValue: null,
        isArchived: false,
      },
      select: { id: true },
    });

    if (zonesWithoutBarcode.length === 0) {
      return { ok: true };
    }

    // Generate barcodes for each zone
    const updates = zonesWithoutBarcode.map((zone) =>
      db.countZone.update({
        where: { id: zone.id },
        data: { barcodeValue: generateBarcodeValue() },
      }),
    );

    await Promise.all(updates);

    revalidateZones(countId);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "count_zone.barcodes_generated",
      entityType: "count_zone",
      entityId: countId,
      metadata: {
        countId,
        zonesUpdated: zonesWithoutBarcode.length,
      },
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: t.countZones.errors.generateBarcodesFailed };
  }
}
