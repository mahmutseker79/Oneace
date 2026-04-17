"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import {
  createVehicleSchema,
  loadShipmentSchema,
  updateVehicleSchema,
  type CreateVehicleInput,
  type LoadShipmentInput,
  type UpdateVehicleInput,
} from "@/lib/validation/vehicle";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Create a new vehicle (FixedAsset with category VEHICLE).
 */
export async function createVehicleAction(
  input: CreateVehicleInput,
): Promise<ActionResult<{ id: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "assets.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  try {
    const asset = await db.fixedAsset.create({
      data: {
        organizationId: membership.organizationId,
        name: parsed.data.name,
        assetTag: `VEH-${Date.now().toString(36).toUpperCase()}`,
        category: "VEHICLE",
        status: "ACTIVE",
        description: parsed.data.description,
        notes: parsed.data.notes,
        // Store license plate in serialNumber field
        serialNumber: parsed.data.licensePlate,
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "vehicle.created",
      entityType: "fixed_asset",
      entityId: asset.id,
      metadata: { name: parsed.data.name, licensePlate: parsed.data.licensePlate },
    });

    revalidatePath("/vehicles");
    return { ok: true, data: { id: asset.id } };
  } catch {
    return { ok: false, error: t.vehicles.errors.createFailed };
  }
}

/**
 * Update a vehicle.
 */
export async function updateVehicleAction(
  vehicleId: string,
  input: UpdateVehicleInput,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "assets.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = updateVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  try {
    const existing = await db.fixedAsset.findFirst({
      where: { id: vehicleId, organizationId: membership.organizationId, category: "VEHICLE" },
    });

    if (!existing) return { ok: false, error: t.vehicles.errors.notFound };

    await db.fixedAsset.update({
      where: { id: vehicleId },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.licensePlate && { serialNumber: parsed.data.licensePlate }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "vehicle.updated",
      entityType: "fixed_asset",
      entityId: vehicleId,
      metadata: { changes: Object.keys(parsed.data) },
    });

    revalidatePath("/vehicles");
    revalidatePath(`/vehicles/${vehicleId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: t.vehicles.errors.updateFailed };
  }
}

/**
 * Delete a vehicle (must not have active loads).
 */
export async function deleteVehicleAction(vehicleId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "assets.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  try {
    const existing = await db.fixedAsset.findFirst({
      where: { id: vehicleId, organizationId: membership.organizationId, category: "VEHICLE" },
      include: { history: { where: { action: "ASSIGNED" }, take: 1 } },
    });

    if (!existing) return { ok: false, error: t.vehicles.errors.notFound };

    await db.fixedAsset.delete({ where: { id: vehicleId } });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "vehicle.deleted",
      entityType: "fixed_asset",
      entityId: vehicleId,
      metadata: { name: existing.name },
    });

    revalidatePath("/vehicles");
    return { ok: true };
  } catch {
    return { ok: false, error: t.vehicles.errors.deleteFailed };
  }
}

/**
 * List all vehicles for the organization.
 */
export async function listVehiclesAction(): Promise<
  ActionResult<
    Array<{
      id: string;
      name: string;
      licensePlate: string | null;
      status: string;
      description: string | null;
      createdAt: Date;
      _count: { history: number };
    }>
  >
> {
  const { membership } = await requireActiveMembership();

  try {
    const vehicles = await db.fixedAsset.findMany({
      where: {
        organizationId: membership.organizationId,
        category: "VEHICLE",
      },
      select: {
        id: true,
        name: true,
        serialNumber: true,
        status: true,
        description: true,
        createdAt: true,
        _count: { select: { history: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      ok: true,
      data: vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        licensePlate: v.serialNumber,
        status: v.status,
        description: v.description,
        createdAt: v.createdAt,
        _count: v._count,
      })),
    };
  } catch {
    return { ok: false, error: "Failed to fetch vehicles" };
  }
}

/**
 * Get a single vehicle with history.
 */
export async function getVehicleAction(vehicleId: string): Promise<
  ActionResult<{
    id: string;
    name: string;
    licensePlate: string | null;
    status: string;
    description: string | null;
    notes: string | null;
    createdAt: Date;
    history: Array<{
      id: string;
      action: string;
      note: string | null;
      performedAt: Date;
    }>;
  }>
> {
  const { membership } = await requireActiveMembership();

  try {
    const vehicle = await db.fixedAsset.findFirst({
      where: {
        id: vehicleId,
        organizationId: membership.organizationId,
        category: "VEHICLE",
      },
      select: {
        id: true,
        name: true,
        serialNumber: true,
        status: true,
        description: true,
        notes: true,
        createdAt: true,
        history: {
          select: { id: true, action: true, note: true, performedAt: true },
          orderBy: { performedAt: "desc" },
          take: 50,
        },
      },
    });

    if (!vehicle) return { ok: false, error: "Vehicle not found" };

    return {
      ok: true,
      data: {
        ...vehicle,
        licensePlate: vehicle.serialNumber,
      },
    };
  } catch {
    return { ok: false, error: "Failed to fetch vehicle" };
  }
}

/**
 * Load a shipment onto a vehicle.
 */
export async function loadShipmentAction(input: LoadShipmentInput): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "assets.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = loadShipmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  try {
    const vehicle = await db.fixedAsset.findFirst({
      where: {
        id: parsed.data.vehicleId,
        organizationId: membership.organizationId,
        category: "VEHICLE",
      },
    });

    if (!vehicle) return { ok: false, error: t.vehicles.errors.notFound };

    await db.assetHistory.create({
      data: {
        organizationId: membership.organizationId,
        assetId: parsed.data.vehicleId,
        action: "ASSIGNED",
        note: parsed.data.notes || `Shipment loaded${parsed.data.salesOrderId ? ` (SO: ${parsed.data.salesOrderId})` : ""}`,
        performedByUserId: session.user.id,
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "vehicle.loaded",
      entityType: "fixed_asset",
      entityId: parsed.data.vehicleId,
      metadata: { salesOrderId: parsed.data.salesOrderId },
    });

    revalidatePath(`/vehicles/${parsed.data.vehicleId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: t.vehicles.errors.loadFailed };
  }
}

/**
 * Unload a shipment from a vehicle.
 */
export async function unloadShipmentAction(
  vehicleId: string,
  historyId: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "assets.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  try {
    const vehicle = await db.fixedAsset.findFirst({
      where: { id: vehicleId, organizationId: membership.organizationId, category: "VEHICLE" },
    });

    if (!vehicle) return { ok: false, error: t.vehicles.errors.notFound };

    await db.assetHistory.create({
      data: {
        organizationId: membership.organizationId,
        assetId: vehicleId,
        action: "RETURNED",
        note: `Shipment unloaded (ref: ${historyId})`,
        performedByUserId: session.user.id,
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "vehicle.unloaded",
      entityType: "fixed_asset",
      entityId: vehicleId,
    });

    revalidatePath(`/vehicles/${vehicleId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: t.vehicles.errors.unloadFailed };
  }
}
