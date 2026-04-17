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
import { requireActiveMembership } from "@/lib/session";
import { revalidatePath } from "next/cache";
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

// ==================== FIELD MAPPING CRUD ====================

const fieldMappingSchema = z.object({
  integrationId: z.string().cuid(),
  entityType: z.enum([
    "ITEM",
    "STOCK_LEVEL",
    "SUPPLIER",
    "PURCHASE_ORDER",
    "CATEGORY",
    "WAREHOUSE",
    "CUSTOMER",
  ]),
  localField: z.string().min(1),
  remoteField: z.string().min(1),
  direction: z.enum(["INBOUND", "OUTBOUND", "BIDIRECTIONAL"]).default("BIDIRECTIONAL"),
  transformRule: z.string().optional(),
  defaultValue: z.string().optional(),
  isRequired: z.boolean().default(false),
});

const updateFieldMappingSchema = fieldMappingSchema.partial().extend({
  mappingId: z.string().cuid(),
});

export async function listFieldMappingsAction(
  integrationId: string,
): Promise<ActionResult<unknown[]>> {
  const { membership } = await requireActiveMembership();

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const mappings = await db.integrationFieldMapping.findMany({
      where: { integrationId },
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
    });

    return { ok: true, data: mappings };
  } catch (error) {
    logger.error("Failed to list field mappings", { error });
    return { ok: false, error: "Failed to list field mappings" };
  }
}

export async function createFieldMappingAction(input: unknown): Promise<ActionResult<unknown>> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  const parsed = fieldMappingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId, entityType, localField, remoteField, direction, transformRule, defaultValue, isRequired } = parsed.data;

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const mapping = await db.integrationFieldMapping.create({
      data: {
        integrationId,
        entityType,
        localField,
        remoteField,
        direction,
        transformRule,
        defaultValue,
        isRequired,
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integrationId,
      metadata: { entityType, localField, remoteField },
    });

    revalidatePath("/integrations");
    return { ok: true, data: mapping };
  } catch (error) {
    logger.error("Failed to create field mapping", { error });
    return { ok: false, error: "Failed to create field mapping" };
  }
}

export async function updateFieldMappingAction(
  mappingId: string,
  input: unknown,
): Promise<ActionResult<unknown>> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  const parsed = updateFieldMappingSchema.safeParse({ mappingId, ...(input as Record<string, unknown>) });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId, ...updateData } = parsed.data;

  try {
    const mapping = await db.integrationFieldMapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping) {
      return { ok: false, error: "Field mapping not found" };
    }

    const integration = await db.integration.findUnique({
      where: { id: mapping.integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Unauthorized" };
    }

    const updated = await db.integrationFieldMapping.update({
      where: { id: mappingId },
      data: updateData,
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integration.id,
      metadata: { mappingId },
    });

    revalidatePath("/integrations");
    return { ok: true, data: updated };
  } catch (error) {
    logger.error("Failed to update field mapping", { error });
    return { ok: false, error: "Failed to update field mapping" };
  }
}

export async function deleteFieldMappingAction(mappingId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  try {
    const mapping = await db.integrationFieldMapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping) {
      return { ok: false, error: "Field mapping not found" };
    }

    const integration = await db.integration.findUnique({
      where: { id: mapping.integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Unauthorized" };
    }

    await db.integrationFieldMapping.delete({
      where: { id: mappingId },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integration.id,
      metadata: { mappingId },
    });

    revalidatePath("/integrations");
    return { ok: true, data: {} };
  } catch (error) {
    logger.error("Failed to delete field mapping", { error });
    return { ok: false, error: "Failed to delete field mapping" };
  }
}

export async function resetFieldMappingsAction(
  integrationId: string,
  entityType: string,
): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    await db.integrationFieldMapping.deleteMany({
      where: { integrationId, entityType: entityType as any },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integrationId,
      metadata: { entityType },
    });

    revalidatePath("/integrations");
    return { ok: true, data: {} };
  } catch (error) {
    logger.error("Failed to reset field mappings", { error });
    return { ok: false, error: "Failed to reset field mappings" };
  }
}

// ==================== SYNC RULES CRUD ====================

const syncRuleSchema = z.object({
  integrationId: z.string().cuid(),
  name: z.string().min(1),
  entityType: z.enum([
    "ITEM",
    "STOCK_LEVEL",
    "SUPPLIER",
    "PURCHASE_ORDER",
    "CATEGORY",
    "WAREHOUSE",
    "CUSTOMER",
  ]),
  condition: z.record(z.unknown()),
  action: z.enum(["SYNC", "SKIP", "TRANSFORM", "FLAG_REVIEW", "CREATE_ONLY", "UPDATE_ONLY"]).default("SYNC"),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateSyncRuleSchema = syncRuleSchema.partial().extend({
  ruleId: z.string().cuid(),
});

export async function listSyncRulesAction(
  integrationId: string,
): Promise<ActionResult<unknown[]>> {
  const { membership } = await requireActiveMembership();

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const rules = await db.integrationSyncRule.findMany({
      where: { integrationId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    return { ok: true, data: rules };
  } catch (error) {
    logger.error("Failed to list sync rules", { error });
    return { ok: false, error: "Failed to list sync rules" };
  }
}

export async function createSyncRuleAction(input: unknown): Promise<ActionResult<unknown>> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  const parsed = syncRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId, name, entityType, condition, action, priority, isActive } = parsed.data;

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const rule = await db.integrationSyncRule.create({
      data: {
        integrationId,
        name,
        entityType,
        condition: JSON.parse(JSON.stringify(condition)),
        action,
        priority,
        isActive,
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integrationId,
      metadata: { name, entityType },
    });

    revalidatePath("/integrations");
    return { ok: true, data: rule };
  } catch (error) {
    logger.error("Failed to create sync rule", { error });
    return { ok: false, error: "Failed to create sync rule" };
  }
}

export async function updateSyncRuleAction(
  ruleId: string,
  input: unknown,
): Promise<ActionResult<unknown>> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  const parsed = updateSyncRuleSchema.safeParse({ ruleId, ...(input as Record<string, unknown>) });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId, ...updateData } = parsed.data;

  try {
    const rule = await db.integrationSyncRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      return { ok: false, error: "Sync rule not found" };
    }

    const integration = await db.integration.findUnique({
      where: { id: rule.integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Unauthorized" };
    }

    const updated = await db.integrationSyncRule.update({
      where: { id: ruleId },
      data: {
        ...updateData,
        ...(updateData.condition && { condition: JSON.parse(JSON.stringify(updateData.condition)) }),
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integration.id,
      metadata: { ruleId },
    });

    revalidatePath("/integrations");
    return { ok: true, data: updated };
  } catch (error) {
    logger.error("Failed to update sync rule", { error });
    return { ok: false, error: "Failed to update sync rule" };
  }
}

export async function deleteSyncRuleAction(ruleId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  try {
    const rule = await db.integrationSyncRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      return { ok: false, error: "Sync rule not found" };
    }

    const integration = await db.integration.findUnique({
      where: { id: rule.integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Unauthorized" };
    }

    await db.integrationSyncRule.delete({
      where: { id: ruleId },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integration.id,
      metadata: { ruleId },
    });

    revalidatePath("/integrations");
    return { ok: true, data: {} };
  } catch (error) {
    logger.error("Failed to delete sync rule", { error });
    return { ok: false, error: "Failed to delete sync rule" };
  }
}

// ==================== WEBHOOK EVENT MANAGEMENT ====================

const webhookEventSchema = z.object({
  integrationId: z.string().cuid(),
  eventType: z.string().min(1),
  endpointUrl: z.string().url(),
  secret: z.string().optional(),
});

const updateWebhookEventSchema = webhookEventSchema.partial().extend({
  eventId: z.string().cuid(),
});

export async function listWebhookEventsAction(
  integrationId: string,
): Promise<ActionResult<unknown[]>> {
  const { membership } = await requireActiveMembership();

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const events = await db.integrationWebhookEvent.findMany({
      where: { integrationId },
      orderBy: { createdAt: "desc" },
    });

    return { ok: true, data: events };
  } catch (error) {
    logger.error("Failed to list webhook events", { error });
    return { ok: false, error: "Failed to list webhook events" };
  }
}

export async function createWebhookEventAction(input: unknown): Promise<ActionResult<unknown>> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  const parsed = webhookEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId, eventType, endpointUrl, secret } = parsed.data;

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const event = await db.integrationWebhookEvent.create({
      data: {
        integrationId,
        eventType,
        endpointUrl,
        secret,
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integrationId,
      metadata: { eventType, endpointUrl },
    });

    revalidatePath("/integrations");
    return { ok: true, data: event };
  } catch (error) {
    logger.error("Failed to create webhook event", { error });
    return { ok: false, error: "Failed to create webhook event" };
  }
}

export async function toggleWebhookEventAction(eventId: string): Promise<ActionResult<unknown>> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  try {
    const event = await db.integrationWebhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return { ok: false, error: "Webhook event not found" };
    }

    const integration = await db.integration.findUnique({
      where: { id: event.integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Unauthorized" };
    }

    const updated = await db.integrationWebhookEvent.update({
      where: { id: eventId },
      data: { isActive: !event.isActive },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integration.id,
      metadata: { eventId, isActive: updated.isActive },
    });

    revalidatePath("/integrations");
    return { ok: true, data: updated };
  } catch (error) {
    logger.error("Failed to toggle webhook event", { error });
    return { ok: false, error: "Failed to toggle webhook event" };
  }
}

export async function deleteWebhookEventAction(eventId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  try {
    const event = await db.integrationWebhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return { ok: false, error: "Webhook event not found" };
    }

    const integration = await db.integration.findUnique({
      where: { id: event.integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Unauthorized" };
    }

    await db.integrationWebhookEvent.delete({
      where: { id: eventId },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integration.id,
      metadata: { eventId },
    });

    revalidatePath("/integrations");
    return { ok: true, data: {} };
  } catch (error) {
    logger.error("Failed to delete webhook event", { error });
    return { ok: false, error: "Failed to delete webhook event" };
  }
}

export async function testWebhookAction(eventId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.sync")) {
    return { ok: false, error: "Permission denied" };
  }

  try {
    const event = await db.integrationWebhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return { ok: false, error: "Webhook event not found" };
    }

    const integration = await db.integration.findUnique({
      where: { id: event.integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Unauthorized" };
    }

    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      organizationId: membership.organizationId,
    };

    try {
      const response = await fetch(event.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(event.secret && { "X-Webhook-Secret": event.secret }),
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        await db.integrationWebhookEvent.update({
          where: { id: eventId },
          data: { lastTriggeredAt: new Date(), failCount: 0 },
        });
        return { ok: true, data: {} };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (testError) {
      const failCount = event.failCount + 1;
      await db.integrationWebhookEvent.update({
        where: { id: eventId },
        data: { failCount },
      });
      logger.error("Webhook test failed", { eventId, error: testError });
      return { ok: false, error: "Webhook test failed" };
    }
  } catch (error) {
    logger.error("Failed to test webhook", { error });
    return { ok: false, error: "Failed to test webhook" };
  }
}

// ==================== INTEGRATION SETTINGS UPDATE ====================

const integrationSettingsSchema = z.object({
  integrationId: z.string().cuid(),
  syncFrequency: z.enum([
    "MANUAL",
    "REALTIME",
    "EVERY_5_MIN",
    "EVERY_15_MIN",
    "EVERY_30_MIN",
    "HOURLY",
    "EVERY_6_HOURS",
    "DAILY",
    "WEEKLY",
  ]).optional(),
  syncDirection: z.enum(["INBOUND", "OUTBOUND", "BIDIRECTIONAL"]).optional(),
  conflictPolicy: z.enum(["REMOTE_WINS", "LOCAL_WINS", "NEWEST_WINS", "MANUAL_REVIEW", "SKIP"]).optional(),
  retryPolicy: z.enum(["NONE", "LINEAR", "EXPONENTIAL"]).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  rateLimitPerMin: z.number().int().min(1).optional(),
  syncItems: z.boolean().optional(),
  syncOrders: z.boolean().optional(),
  syncSuppliers: z.boolean().optional(),
  syncCategories: z.boolean().optional(),
  syncStockLevels: z.boolean().optional(),
  syncPrices: z.boolean().optional(),
  syncImages: z.boolean().optional(),
  syncCustomers: z.boolean().optional(),
  syncFilterJson: z.record(z.unknown()).optional(),
});

export async function updateIntegrationSettingsAction(
  integrationId: string,
  input: unknown,
): Promise<ActionResult<unknown>> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  const parsed = integrationSettingsSchema.safeParse({ integrationId, ...(input as Record<string, unknown>) });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId: _id, ...updateData } = parsed.data;

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const updated = await db.integration.update({
      where: { id: integrationId },
      data: {
        ...updateData,
        ...(updateData.syncFilterJson && { syncFilterJson: JSON.parse(JSON.stringify(updateData.syncFilterJson)) }),
      },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integrationId,
      metadata: { changes: Object.keys(updateData) },
    });

    revalidatePath("/integrations");
    return { ok: true, data: updated };
  } catch (error) {
    logger.error("Failed to update integration settings", { error });
    return { ok: false, error: "Failed to update integration settings" };
  }
}

// ==================== SYNC OPERATIONS ====================

export async function retryFailedSyncsAction(integrationId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.sync")) {
    return { ok: false, error: "Permission denied" };
  }

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const failedLogs = await db.syncLog.findMany({
      where: {
        integrationId,
        status: "FAILED",
      },
    });

    const updatedLogs = await Promise.all(
      failedLogs.map((log) =>
        db.syncLog.update({
          where: { id: log.id },
          data: { status: "PENDING" },
        }),
      ),
    );

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integrationId,
      metadata: { count: updatedLogs.length },
    });

    revalidatePath("/integrations");
    return { ok: true, data: {} };
  } catch (error) {
    logger.error("Failed to retry failed syncs", { error });
    return { ok: false, error: "Failed to retry failed syncs" };
  }
}

export async function testConnectionAction(integrationId: string): Promise<ActionResult> {
  const { membership } = await requireActiveMembership();

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    if (!integration.credentials) {
      return { ok: false, error: "No credentials found" };
    }

    // TODO: Implement provider-specific credential validation
    // For now, return success if credentials exist
    return { ok: true, data: {} };
  } catch (error) {
    logger.error("Failed to test connection", { error });
    return { ok: false, error: "Failed to test connection" };
  }
}

export async function getSyncStatsAction(
  integrationId: string,
): Promise<ActionResult<{ totalSyncs: number; successfulSyncs: number; failedSyncs: number; totalRecords: number; totalErrors: number }>> {
  const { membership } = await requireActiveMembership();

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const logs = await db.syncLog.findMany({
      where: { integrationId },
    });

    const stats = {
      totalSyncs: logs.length,
      successfulSyncs: logs.filter((l) => l.status === "COMPLETED").length,
      failedSyncs: logs.filter((l) => l.status === "FAILED").length,
      totalRecords: logs.reduce((sum, l) => sum + (l.recordsProcessed || 0), 0),
      totalErrors: logs.reduce((sum, l) => sum + (l.recordsFailed || 0), 0),
    };

    return { ok: true, data: stats };
  } catch (error) {
    logger.error("Failed to get sync stats", { error });
    return { ok: false, error: "Failed to get sync stats" };
  }
}

// ==================== SYNC SCHEDULE MANAGEMENT ====================

const syncScheduleSchema = z.object({
  integrationId: z.string().cuid(),
  entityType: z.enum([
    "ITEM",
    "STOCK_LEVEL",
    "SUPPLIER",
    "PURCHASE_ORDER",
    "CATEGORY",
    "WAREHOUSE",
    "CUSTOMER",
  ]),
  direction: z.enum(["INBOUND", "OUTBOUND", "BIDIRECTIONAL"]),
  cronExpression: z.string().min(1),
  isActive: z.boolean().default(true),
});

const updateSyncScheduleSchema = syncScheduleSchema.partial().extend({
  scheduleId: z.string().cuid(),
});

export async function listSyncSchedulesAction(
  integrationId: string,
): Promise<ActionResult<unknown[]>> {
  const { membership } = await requireActiveMembership();

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const schedules = await db.integrationSyncSchedule.findMany({
      where: { integrationId },
      orderBy: [{ entityType: "asc" }],
    });

    return { ok: true, data: schedules };
  } catch (error) {
    logger.error("Failed to list sync schedules", { error });
    return { ok: false, error: "Failed to list sync schedules" };
  }
}

export async function upsertSyncScheduleAction(input: unknown): Promise<ActionResult<unknown>> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  const parsed = syncScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { integrationId, entityType, direction, cronExpression, isActive } = parsed.data;

  try {
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Integration not found" };
    }

    const existing = await db.integrationSyncSchedule.findFirst({
      where: { integrationId, entityType, direction },
    });

    const schedule = existing
      ? await db.integrationSyncSchedule.update({
          where: { id: existing.id },
          data: { cronExpression, isActive },
        })
      : await db.integrationSyncSchedule.create({
          data: {
            integrationId,
            entityType,
            direction,
            cronExpression,
            isActive,
          },
        });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integrationId,
      metadata: { entityType, direction, cronExpression },
    });

    revalidatePath("/integrations");
    return { ok: true, data: schedule };
  } catch (error) {
    logger.error("Failed to upsert sync schedule", { error });
    return { ok: false, error: "Failed to upsert sync schedule" };
  }
}

export async function deleteSyncScheduleAction(scheduleId: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "integrations.connect")) {
    return { ok: false, error: "Permission denied" };
  }

  try {
    const schedule = await db.integrationSyncSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      return { ok: false, error: "Sync schedule not found" };
    }

    const integration = await db.integration.findUnique({
      where: { id: schedule.integrationId },
    });

    if (!integration || integration.organizationId !== membership.organizationId) {
      return { ok: false, error: "Unauthorized" };
    }

    await db.integrationSyncSchedule.delete({
      where: { id: scheduleId },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "integration.synced",
      entityType: "integration",
      entityId: integration.id,
      metadata: { scheduleId },
    });

    revalidatePath("/integrations");
    return { ok: true, data: {} };
  } catch (error) {
    logger.error("Failed to delete sync schedule", { error });
    return { ok: false, error: "Failed to delete sync schedule" };
  }
}
