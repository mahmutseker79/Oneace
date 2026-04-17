/**
 * Custom Webhook Sync Engine
 *
 * Handles webhook-based event triggering and propagation:
 * - Watches for OneAce entity changes (items, orders, stock)
 * - Sends webhook notifications to configured URL
 * - Processes incoming webhooks with configurable mapping
 * - Retry with exponential backoff (3 retries max)
 * - Configurable payload templates (JSON path mapping)
 * - Event types: item.created, item.updated, item.deleted, order.created, order.updated, stock.changed, etc.
 *
 * Note: This is NOT a bidirectional sync in the traditional sense.
 * It's an event propagation system that sends notifications on changes.
 */

import SyncEngine, {
  type SyncContext,
  type SyncEntity,
  type SyncResult,
} from "@/lib/integrations/sync-engine";
import { logger } from "@/lib/logger";
import type WebhookClient from "./webhook-client";
import type { WebhookEvent } from "./webhook-client";

interface WebhookSyncContext extends SyncContext {
  webhookClient: WebhookClient;
  organizationId: string;
}

class WebhookSyncEngine extends SyncEngine {
  /**
   * Main sync orchestrator for webhooks.
   * In this case, "sync" means triggering webhooks on entity changes.
   */
  async sync(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const webhookContext = context as WebhookSyncContext;

    const result: SyncResult = {
      success: true,
      provider: "CUSTOM_WEBHOOK",
      direction: context.direction,
      entityType: context.entityType,
      itemsSynced: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [],
    };

    try {
      // Webhooks don't do traditional "sync"
      // They send events based on entity changes
      // This would be called in response to entity mutations

      logger.info("Webhook sync context established", {
        entityType: context.entityType,
        direction: context.direction,
      });

      result.itemsSynced = 0;
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      logger.error("Webhook sync failed", {
        entityType: context.entityType,
        error,
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Send webhook event for item creation.
   */
  async sendItemCreatedEvent(
    webhookContext: WebhookSyncContext,
    itemId: string,
    itemData: Record<string, unknown>,
  ): Promise<boolean> {
    const webhookClient = webhookContext.webhookClient;

    const event: WebhookEvent = {
      id: `item-created-${itemId}-${Date.now()}`,
      eventType: "item.created",
      timestamp: new Date().toISOString(),
      entityType: "item",
      entityId: itemId,
      action: "created",
      data: itemData,
      organizationId: webhookContext.organizationId,
    };

    return webhookClient.send(event);
  }

  /**
   * Send webhook event for item update.
   */
  async sendItemUpdatedEvent(
    webhookContext: WebhookSyncContext,
    itemId: string,
    itemData: Record<string, unknown>,
  ): Promise<boolean> {
    const webhookClient = webhookContext.webhookClient;

    const event: WebhookEvent = {
      id: `item-updated-${itemId}-${Date.now()}`,
      eventType: "item.updated",
      timestamp: new Date().toISOString(),
      entityType: "item",
      entityId: itemId,
      action: "updated",
      data: itemData,
      organizationId: webhookContext.organizationId,
    };

    return webhookClient.send(event);
  }

  /**
   * Send webhook event for item deletion.
   */
  async sendItemDeletedEvent(webhookContext: WebhookSyncContext, itemId: string): Promise<boolean> {
    const webhookClient = webhookContext.webhookClient;

    const event: WebhookEvent = {
      id: `item-deleted-${itemId}-${Date.now()}`,
      eventType: "item.deleted",
      timestamp: new Date().toISOString(),
      entityType: "item",
      entityId: itemId,
      action: "deleted",
      data: { id: itemId },
      organizationId: webhookContext.organizationId,
    };

    return webhookClient.send(event);
  }

  /**
   * Send webhook event for order creation.
   */
  async sendOrderCreatedEvent(
    webhookContext: WebhookSyncContext,
    orderId: string,
    orderData: Record<string, unknown>,
  ): Promise<boolean> {
    const webhookClient = webhookContext.webhookClient;

    const event: WebhookEvent = {
      id: `order-created-${orderId}-${Date.now()}`,
      eventType: "order.created",
      timestamp: new Date().toISOString(),
      entityType: "order",
      entityId: orderId,
      action: "created",
      data: orderData,
      organizationId: webhookContext.organizationId,
    };

    return webhookClient.send(event);
  }

  /**
   * Send webhook event for order update.
   */
  async sendOrderUpdatedEvent(
    webhookContext: WebhookSyncContext,
    orderId: string,
    orderData: Record<string, unknown>,
  ): Promise<boolean> {
    const webhookClient = webhookContext.webhookClient;

    const event: WebhookEvent = {
      id: `order-updated-${orderId}-${Date.now()}`,
      eventType: "order.updated",
      timestamp: new Date().toISOString(),
      entityType: "order",
      entityId: orderId,
      action: "updated",
      data: orderData,
      organizationId: webhookContext.organizationId,
    };

    return webhookClient.send(event);
  }

  /**
   * Send webhook event for stock change.
   */
  async sendStockChangedEvent(
    webhookContext: WebhookSyncContext,
    itemId: string,
    warehouseId: string,
    previousQty: number,
    newQty: number,
  ): Promise<boolean> {
    const webhookClient = webhookContext.webhookClient;

    const event: WebhookEvent = {
      id: `stock-changed-${itemId}-${warehouseId}-${Date.now()}`,
      eventType: "stock.changed",
      timestamp: new Date().toISOString(),
      entityType: "stock",
      entityId: `${itemId}-${warehouseId}`,
      action: "updated",
      data: {
        itemId,
        warehouseId,
        previousQuantity: previousQty,
        newQuantity: newQty,
        delta: newQty - previousQty,
      },
      organizationId: webhookContext.organizationId,
    };

    return webhookClient.send(event);
  }

  /**
   * Transform external entity to OneAce format.
   * Not typically used for webhooks, but required by SyncEngine.
   */
  protected transformToLocal(external: SyncEntity): SyncEntity {
    return {
      ...external,
      data: {
        ...external.data,
        _synced_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Transform OneAce entity to external format.
   * Not typically used for webhooks.
   */
  protected transformToExternal(local: SyncEntity): SyncEntity {
    return {
      ...local,
      data: {
        ...local.data,
        _synced_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Fetch entities from external system.
   * Not used for webhooks (webhooks are push-only).
   */
  protected async fetchExternalEntities(
    _context: SyncContext,
    _checkpoint?: string,
  ): Promise<SyncEntity[]> {
    // Webhooks don't fetch, they push
    return [];
  }

  /**
   * Push to external system.
   * For webhooks, this sends the webhook event.
   */
  protected async pushToExternal(
    entities: SyncEntity[],
    context: SyncContext,
  ): Promise<SyncEntity[]> {
    const webhookContext = context as WebhookSyncContext;
    const webhookClient = webhookContext.webhookClient;

    const sent: SyncEntity[] = [];

    for (const entity of entities) {
      const event: WebhookEvent = {
        id: entity.id,
        eventType: `${context.entityType}.updated`,
        timestamp: new Date().toISOString(),
        entityType: context.entityType,
        entityId: entity.id,
        action: "updated",
        data: entity.data,
        organizationId: webhookContext.organizationId,
      };

      const success = await webhookClient.send(event);
      if (success) {
        sent.push(entity);
      }
    }

    return sent;
  }

  /**
   * Pull from external system.
   * Not used for webhooks (webhooks are push-only).
   */
  protected async pullFromExternal(
    _entities: SyncEntity[],
    _context: SyncContext,
  ): Promise<SyncEntity[]> {
    // Webhooks don't pull
    return [];
  }
}

export default WebhookSyncEngine;
