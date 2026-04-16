/**
 * Phase E: Shopify sync engine.
 *
 * Syncs Products and Orders between OneAce and Shopify.
 * Implements entity-specific transformation and pagination.
 */

import { db } from "@/lib/db";
import type { ShopifyClient } from "@/lib/integrations/shopify/shopify-client";
import {
  type SyncContext,
  SyncEngine,
  type SyncEntity,
  type SyncResult,
} from "@/lib/integrations/sync-engine";
import { logger } from "@/lib/logger";

export class ShopifySyncEngine extends SyncEngine {
  private client: ShopifyClient;

  constructor(client: ShopifyClient) {
    super();
    this.client = client;
  }

  /**
   * Execute a Shopify sync operation.
   */
  async sync(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: "SHOPIFY",
      direction: context.direction,
      entityType: context.entityType,
      itemsSynced: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [],
    };

    try {
      if (context.entityType === "PRODUCT") {
        await this.syncProducts(context, result);
      } else if (context.entityType === "ORDER") {
        await this.syncOrders(context, result);
      } else {
        throw new Error(`Unsupported entity type: ${context.entityType}`);
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      logger.error("Shopify sync failed", {
        organizationId: context.organizationId,
        entityType: context.entityType,
        error,
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Sync products from Shopify.
   */
  private async syncProducts(context: SyncContext, result: SyncResult): Promise<void> {
    let hasNextPage = true;
    let after: string | undefined;

    while (hasNextPage) {
      const { products, pageInfo } = await this.client.getProducts(context.batchSize || 50, after);

      const items = products.map((product) => ({
        id: product.id,
        externalId: product.id,
        data: {
          title: product.title,
          handle: product.handle,
          sku: product.sku,
          price: product.price,
          inventory: product.inventory,
          vendor: product.vendor,
        },
      }));

      if (context.direction === "INBOUND") {
        const { processed, failed, errors } = await this.processBatch(
          items,
          context,
          async (item) => {
            // Find or create category for Shopify vendor
            let categoryId: string | null = null;

            if (item.data.vendor) {
              const category = await db.category.findFirst({
                where: {
                  organizationId: context.organizationId,
                  name: String(item.data.vendor),
                },
              });

              if (!category) {
                const slug = String(item.data.vendor)
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "");
                const newCategory = await db.category.create({
                  data: {
                    organizationId: context.organizationId,
                    name: String(item.data.vendor),
                    slug,
                    description: `Shopify vendor: ${item.data.vendor}`,
                  },
                });
                categoryId = newCategory.id;
              } else {
                categoryId = category.id;
              }
            }

            await db.item.upsert({
              where: {
                organizationId_sku: {
                  organizationId: context.organizationId,
                  sku: String(item.data.sku || item.id),
                },
              },
              create: {
                organizationId: context.organizationId,
                name: String(item.data.title),
                sku: String(item.data.sku || item.id),
                categoryId,
              },
              update: {
                name: String(item.data.title),
              },
            });
          },
        );

        result.itemsSynced += processed;
        result.itemsFailed += failed;
        result.errors.push(...errors);
      }

      hasNextPage = pageInfo.hasNextPage;
      after = pageInfo.endCursor;
    }
  }

  /**
   * Sync orders from Shopify.
   */
  private async syncOrders(context: SyncContext, result: SyncResult): Promise<void> {
    let hasNextPage = true;
    let after: string | undefined;

    while (hasNextPage) {
      const { orders, pageInfo } = await this.client.getOrders(context.batchSize || 50, after);

      const items = orders.map((order) => ({
        id: order.id,
        externalId: order.id,
        data: {
          orderNumber: order.orderNumber,
          email: order.email,
          totalPrice: order.totalPrice,
          createdAt: order.createdAt,
          lineItems: order.lineItems,
        },
      }));

      if (context.direction === "INBOUND") {
        const { processed, failed, errors } = await this.processBatch(
          items,
          context,
          async (item) => {
            // For now, just log orders - full PO sync would map them to purchase orders
            logger.info("Synced Shopify order", {
              orderNumber: item.data.orderNumber,
              organizationId: context.organizationId,
            });
          },
        );

        result.itemsSynced += processed;
        result.itemsFailed += failed;
        result.errors.push(...errors);
      }

      hasNextPage = pageInfo.hasNextPage;
      after = pageInfo.endCursor;
    }
  }

  protected async fetchExternalEntities(context: SyncContext): Promise<SyncEntity[]> {
    if (context.entityType === "PRODUCT") {
      const { products } = await this.client.getProducts();

      return products.map((product) => ({
        id: product.id,
        externalId: product.id,
        data: {
          title: product.title,
          handle: product.handle,
          sku: product.sku,
          price: product.price,
          inventory: product.inventory,
          vendor: product.vendor,
        },
      }));
    }

    return [];
  }

  protected transformToLocal(external: SyncEntity): SyncEntity {
    return external;
  }

  protected transformToExternal(local: SyncEntity): SyncEntity {
    return local;
  }

  protected async pushToExternal(entities: SyncEntity[]): Promise<SyncEntity[]> {
    // Shopify product creation would require different API - placeholder for now
    logger.warn("Shopify push not yet implemented");
    return entities;
  }

  protected async pullFromExternal(entities: SyncEntity[]): Promise<SyncEntity[]> {
    // Handled by specific sync methods above
    return entities;
  }
}

export default ShopifySyncEngine;
