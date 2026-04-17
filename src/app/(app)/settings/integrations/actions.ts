/**
 * Phase E: Integration management server actions.
 *
 * CRUD operations for integrations:
 * - Connect integration (OAuth flow)
 * - Disconnect integration
 * - Trigger manual sync
 * - Configure integration settings
 */

"use server";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { z } from "zod";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

const connectIntegrationSchema = z.object({
  provider: z.enum(["QUICKBOOKS_ONLINE", "SHOPIFY"]),
  credentials: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

const disconnectIntegrationSchema = z.object({
  integrationId: z.string().cuid(),
});

const triggerSyncSchema = z.object({
  integrationId: z.string().cuid(),
});

/**
 * Connect an integration (store credentials).
 */
export async function connectIntegrationAction(
  input: unknown,
): Promise<ActionResult<{ integrationId: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = connectIntegrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { provider, credentials, metadata } = parsed.data;

  try {
    // Check plan capability
    const plan = membership.organization.plan;
    const maxIntegrations = plan === "BUSINESS" ? 999 : plan === "PRO" ? 5 : 0;

    if (maxIntegrations === 0) {
      return {
        ok: false,
        error: "Integrations require PRO plan or higher",
      };
    }

    const existingCount = await db.integration.count({
      where: {
        organizationId: membership.organizationId,
        status: "CONNECTED",
      },
    });

    if (existingCount >= maxIntegrations) {
      return {
        ok: false,
        error: `Maximum integrations reached (${maxIntegrations})`,
      };
    }

    // Create integration record
    const integration = await db.integration.create({
      data: {
        organizationId: membership.organizationId,
        provider,
        status: "CONNECTED",
        credentials: JSON.parse(JSON.stringify(credentials)),
        settings: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        lastSyncAt: null,
      },
    });

    // Record audit event
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.connected",
      entityType: "integration",
      entityId: integration.id,
      metadata: {
        provider,
      },
    });

    revalidatePath("/settings/integrations");
    revalidatePath("/integrations");

    return { ok: true, data: { integrationId: integration.id } };
  } catch (error) {
    logger.error("Failed to connect integration", { error: error });
    return { ok: false, error: "Failed to connect integration" };
  }
}

/**
 * Disconnect an integration.
 */
export async function disconnectIntegrationAction(input: unknown): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "integrations.disconnect")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = disconnectIntegrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId } = parsed.data;

  try {
    // Verify ownership
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    // Update integration status
    await db.integration.update({
      where: { id: integrationId },
      data: {
        status: "DISCONNECTED",
        credentials: undefined,
      },
    });

    // Record audit event
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.disconnected",
      entityType: "integration",
      entityId: integrationId,
      metadata: {
        provider: integration.provider,
      },
    });

    revalidatePath("/settings/integrations");
    revalidatePath("/integrations");

    return { ok: true, data: {} };
  } catch (error) {
    logger.error("Failed to disconnect integration", { error: error });
    return { ok: false, error: "Failed to disconnect integration" };
  }
}

/**
 * Trigger a manual sync.
 */
export async function triggerSyncAction(
  input: unknown,
): Promise<ActionResult<{ syncJobId: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "integrations.sync")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = triggerSyncSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId } = parsed.data;

  try {
    // Verify ownership
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    if (integration.status !== "CONNECTED") {
      return { ok: false, error: "Integration is not connected" };
    }

    // Create sync log entry
    const syncLog = await db.syncLog.create({
      data: {
        integrationId,
        direction: "INBOUND",
        entityType: "ITEM",
        status: "PENDING",
        startedAt: new Date(),
      },
    });

    // Record audit event
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integrationId,
      metadata: {
        provider: integration.provider,
        syncLogId: syncLog.id,
      },
    });

    // TODO: Queue async sync job (background job queue)

    revalidatePath("/settings/integrations");
    revalidatePath("/integrations");

    return { ok: true, data: { syncJobId: syncLog.id } };
  } catch (error) {
    logger.error("Failed to trigger sync", { error: error });
    return { ok: false, error: "Failed to trigger sync" };
  }
}

/**
 * Get integration connection status.
 */
export async function getIntegrationStatusAction(
  integrationId: string,
): Promise<ActionResult<{ status: string; lastSyncAt: Date | null }>> {
  const { membership } = await requireActiveMembership();

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    return {
      ok: true,
      data: {
        status: integration.status,
        lastSyncAt: integration.lastSyncAt,
      },
    };
  } catch (_error) {
    return { ok: false, error: "Failed to get integration status" };
  }
}
