/**
 * Phase E: Magento sync orchestrator.
 *
 * Bidirectional sync between OneAce and Adobe Commerce (Magento):
 * - Products ↔ Items (pull/push configurable and simple products)
 * - Orders → SalesOrders (pull orders inbound only)
 * - Customers → external mapping (for reference, no local storage)
 * - Inventory → StockLevel (pull inventory from MSI sources)
 *
 * Uses ID mapping in integration settings JSON:
 * { skuMap: { "oneace_item_456": "mag_sku_abc" }, orderIdMap: {...} }
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import SyncEngine, { type SyncContext, type SyncResult, type SyncEntity } from "@/lib/integrations/sync-engine";
import MagentoClient, { type MagentoProduct, type MagentoOrder } from "./magento-client";

interface MagentoSyncSettings {
  skuMap?: Record<string, string>; // itemId -> sku
  orderIdMap?: Record<string, string>; // orderId -> increment_id
  lastSyncTimestamp?: Record<string, number>;
}

export class MagentoSyncEngine extends SyncEngine {
  private client: MagentoClient;

  constructor(client: MagentoClient) {
    super();
    this.client = client;
  }

  /**
   * Main sync entry point.
   */
  async sync(context: SyncContext): Promise<SyncResult> {
    logger.info("Starting Magento sync", {
      entityType: context.entityType,
      direction: context.direction,
    });

    try {
      switch (context.entityType) {
        case "Item":
          return await this.syncItems(context);
        case "SalesOrder":
          return await this.syncOrders(context);
        case "StockLevel":
          return await this.syncInventory(context);
        default:
          throw new Error(`Unsupported entity type: ${context.entityType}`);
      }
    } catch (error) {
      logger.error("Magento sync failed", { error, context });
      return {
        success: false,
        provider: "MAGENTO",
        direction: context.direction,
        entityType: context.entityType,
        itemsSynced: 0,
        itemsFailed: 0,
        itemsSkipped: 0,
        duration: 0,
        errors: [
          {
            itemId: "sync",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      };
    }
  }

  /**
   * Sync products: pull from Magento and update/create Items.
   */
  private async syncItems(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: "MAGENTO",
      direction: "INBOUND",
      entityType: "Item",
      itemsSynced: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [],
    };

    try {
      const integration = await db.integration.findFirst({
        where: {
          organizationId: context.organizationId,
          provider: "MAGENTO",
        },
      });

      if (!integration) {
        throw new Error("Magento integration not found");
      }

      const settings = (integration.settings as MagentoSyncSettings) || {};
      const skuMap = settings.skuMap || {};

      // Fetch all products from Magento with pagination
      let pageSize = 100;
      let currentPage = 1;
      let totalProducts = 0;

      while (true) {
        const response = await this.client.listProducts(pageSize, currentPage);
        totalProducts = response.total_count;

        logger.info(`Fetching Magento products page ${currentPage}`, {
          pageSize,
          totalCount: totalProducts,
        });

        for (const product of response.items) {
          try {
            const productId = String(product.id);
            const sku = product.sku;
            const existingItem = Object.values(skuMap).includes(sku)
              ? await db.item.findFirst({
                  where: {
                    organizationId: context.organizationId,
                    sku,
                  },
                })
              : null;

            if (context.direction === "OUTBOUND") {
              // Push inventory to Magento
              if (existingItem) {
                const totalStock = await db.stockLevel.aggregate({
                  where: { itemId: existingItem.id },
                  _sum: { quantity: true },
                });

                const quantity = totalStock._sum.quantity || 0;
                await this.client.updateInventory(sku, quantity);
                result.itemsSynced++;
              }
            } else {
              // Pull products from Magento
              let item = existingItem;

              if (!item) {
                item = await db.item.create({
                  data: {
                    organizationId: context.organizationId,
                    sku,
                    name: product.name,
                    description: product.description,
                  },
                });

                skuMap[item.id] = sku;
              } else {
                item = await db.item.update({
                  where: { id: item.id },
                  data: {
                    name: product.name,
                    description: product.description,
                  },
                });
              }

              // Handle configurable products with associated simple products
              if (
                product.type_id === "configurable" &&
                product.extension_attributes?.configurable_product_links
              ) {
                const linkedProductIds = product.extension_attributes.configurable_product_links;

                for (const linkedId of linkedProductIds) {
                  try {
                    const linkedProduct = await this.client.getProduct(String(linkedId));

                    // Create variant mapping if needed
                    const existingVariant = await db.itemVariant.findFirst({
                      where: {
                        itemId: item.id,
                        sku: linkedProduct.sku,
                      },
                    });

                    if (!existingVariant) {
                      await db.itemVariant.create({
                        data: {
                          organizationId: context.organizationId,
                          itemId: item.id,
                          sku: linkedProduct.sku,
                          name: linkedProduct.name,
                        },
                      });
                    }
                  } catch (variantError) {
                    logger.warn("Failed to sync linked product", {
                      productId: linkedId,
                      error: variantError,
                    });
                  }
                }
              }

              result.itemsSynced++;
            }
          } catch (error) {
            result.itemsFailed++;
            result.errors.push({
              itemId: product.sku,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            logger.warn("Failed to sync product", { sku: product.sku, error });
          }
        }

        // Check if we have more pages
        if (currentPage * pageSize >= totalProducts) {
          break;
        }

        currentPage++;
      }

      // Save updated ID mapping
      if (Object.keys(skuMap).length > 0) {
        await db.integration.update({
          where: { id: integration.id },
          data: {
            settings: {
              ...settings,
              skuMap,
              lastSyncTimestamp: {
                ...settings.lastSyncTimestamp,
                Item: Date.now(),
              },
            },
          },
        });
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Sync orders: pull from Magento and create/update SalesOrders.
   */
  private async syncOrders(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: "MAGENTO",
      direction: "INBOUND",
      entityType: "SalesOrder",
      itemsSynced: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [],
    };

    try {
      const integration = await db.integration.findFirst({
        where: {
          organizationId: context.organizationId,
          provider: "MAGENTO",
        },
      });

      if (!integration) {
        throw new Error("Magento integration not found");
      }

      const settings = (integration.settings as MagentoSyncSettings) || {};
      const orderIdMap = settings.orderIdMap || {};
      const skuMap = settings.skuMap || {};

      // Fetch all orders from Magento with pagination
      let pageSize = 100;
      let currentPage = 1;
      let totalOrders = 0;

      while (true) {
        const response = await this.client.listOrders(pageSize, currentPage);
        totalOrders = response.total_count;

        logger.info(`Fetching Magento orders page ${currentPage}`, {
          pageSize,
          totalCount: totalOrders,
        });

        for (const order of response.items) {
          try {
            const incrementId = order.increment_id;
            const existingSalesOrderId = orderIdMap[String(order.entity_id)];

            let salesOrder = existingSalesOrderId
              ? await db.salesOrder.findUnique({
                  where: { id: existingSalesOrderId },
                })
              : null;

            if (!salesOrder) {
              // Create new sales order
              salesOrder = await db.salesOrder.create({
                data: {
                  organizationId: context.organizationId,
                  orderNumber: incrementId,
                  customerName: `${order.customer_firstname} ${order.customer_lastname}`,
                  customerRef: String(order.customer_id),
                  status: this.mapOrderStatus(order.status),
                  note: `Magento Order #${incrementId} - State: ${order.state}`,
                },
              });

              orderIdMap[String(order.entity_id)] = salesOrder.id;
            } else {
              // Update existing order
              salesOrder = await db.salesOrder.update({
                where: { id: salesOrder.id },
                data: {
                  note: `Magento Order #${incrementId} - State: ${order.state}`,
                },
              });
            }

            // Create/update sales order lines
            if (order.items && order.items.length > 0) {
              for (const item of order.items) {
                // Find item by sku from skuMap
                const itemId = Object.entries(skuMap).find(
                  ([_, sku]) => sku === item.product_sku,
                )?.[0];

                if (itemId) {
                  const existingLine = await db.salesOrderLine.findFirst({
                    where: {
                      salesOrderId: salesOrder.id,
                      itemId,
                    },
                  });

                  if (existingLine) {
                    await db.salesOrderLine.update({
                      where: { id: existingLine.id },
                      data: { orderedQty: item.qty_ordered },
                    });
                  } else {
                    // Find default warehouse
                    const defaultWarehouse = await db.warehouse.findFirst({
                      where: {
                        organizationId: context.organizationId,
                        isDefault: true,
                      },
                    });

                    if (defaultWarehouse) {
                      await db.salesOrderLine.create({
                        data: {
                          organizationId: context.organizationId,
                          salesOrderId: salesOrder.id,
                          itemId,
                          warehouseId: defaultWarehouse.id,
                          orderedQty: item.qty_ordered,
                        },
                      });
                    }
                  }
                }
              }
            }

            result.itemsSynced++;
          } catch (error) {
            result.itemsFailed++;
            result.errors.push({
              itemId: order.increment_id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            logger.warn("Failed to sync order", { orderId: order.entity_id, error });
          }
        }

        // Check if we have more pages
        if (currentPage * pageSize >= totalOrders) {
          break;
        }

        currentPage++;
      }

      // Save updated ID mappings
      if (Object.keys(orderIdMap).length > 0) {
        await db.integration.update({
          where: { id: integration.id },
          data: {
            settings: {
              ...settings,
              orderIdMap,
              lastSyncTimestamp: {
                ...settings.lastSyncTimestamp,
                SalesOrder: Date.now(),
              },
            },
          },
        });
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Sync inventory: pull from Magento MSI and update StockLevels.
   */
  private async syncInventory(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: "MAGENTO",
      direction: "INBOUND",
      entityType: "StockLevel",
      itemsSynced: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [],
    };

    try {
      const integration = await db.integration.findFirst({
        where: {
          organizationId: context.organizationId,
          provider: "MAGENTO",
        },
      });

      if (!integration) {
        throw new Error("Magento integration not found");
      }

      const settings = (integration.settings as MagentoSyncSettings) || {};
      const skuMap = settings.skuMap || {};

      // Fetch inventory sources
      const sourcesResponse = await this.client.listInventorySources();
      const sources = sourcesResponse.items || [];

      logger.info(`Found ${sources.length} inventory sources in Magento`);

      // Fetch default warehouse
      const defaultWarehouse = await db.warehouse.findFirst({
        where: {
          organizationId: context.organizationId,
          isDefault: true,
        },
      });

      if (!defaultWarehouse) {
        throw new Error("No default warehouse found");
      }

      // Fetch all products and their inventory
      let pageSize = 100;
      let currentPage = 1;
      let totalProducts = 0;

      while (true) {
        const response = await this.client.listProducts(pageSize, currentPage);
        totalProducts = response.total_count;

        for (const product of response.items) {
          try {
            const itemId = Object.entries(skuMap).find(
              ([_, sku]) => sku === product.sku,
            )?.[0];

            if (!itemId) {
              result.itemsSkipped++;
              continue;
            }

            // Get stock quantity from extension attributes
            if (product.extension_attributes?.stock_item) {
              const stockItem = product.extension_attributes.stock_item;
              const quantity = stockItem.qty || 0;

              const existingStock = await db.stockLevel.findFirst({
                where: {
                  itemId,
                  warehouseId: defaultWarehouse.id,
                },
              });

              if (existingStock) {
                await db.stockLevel.update({
                  where: { id: existingStock.id },
                  data: { quantity },
                });
              } else {
                await db.stockLevel.create({
                  data: {
                    organizationId: context.organizationId,
                    itemId,
                    warehouseId: defaultWarehouse.id,
                    binId: "default",
                    quantity,
                  },
                });
              }

              result.itemsSynced++;
            }
          } catch (error) {
            result.itemsFailed++;
            result.errors.push({
              itemId: product.sku,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            logger.warn("Failed to sync inventory", { sku: product.sku, error });
          }
        }

        // Check if we have more pages
        if (currentPage * pageSize >= totalProducts) {
          break;
        }

        currentPage++;
      }

      // Update sync timestamp
      await db.integration.update({
        where: { id: integration.id },
        data: {
          settings: {
            ...settings,
            lastSyncTimestamp: {
              ...settings.lastSyncTimestamp,
              StockLevel: Date.now(),
            },
          },
        },
      });

      result.success = true;
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Map Magento order status to OneAce SalesOrderStatus.
   */
  private mapOrderStatus(magentoStatus: string): "DRAFT" | "CONFIRMED" | "ALLOCATED" | "PARTIALLY_SHIPPED" | "SHIPPED" | "CANCELLED" {
    const statusMap: Record<string, "DRAFT" | "CONFIRMED" | "SHIPPED" | "CANCELLED"> = {
      pending: "DRAFT",
      processing: "CONFIRMED",
      complete: "SHIPPED",
      closed: "SHIPPED",
      canceled: "CANCELLED",
      holded: "DRAFT",
      payment_review: "DRAFT",
    };

    return statusMap[magentoStatus.toLowerCase()] || "CONFIRMED";
  }

  /**
   * Fetch external entities (for base class compatibility).
   */
  protected async fetchExternalEntities(): Promise<SyncEntity[]> {
    // Implemented in specific sync methods
    return [];
  }

  /**
   * Transform to local (for base class compatibility).
   */
  protected transformToLocal(external: SyncEntity): SyncEntity {
    return external;
  }

  /**
   * Transform to external (for base class compatibility).
   */
  protected transformToExternal(local: SyncEntity): SyncEntity {
    return local;
  }

  /**
   * Push to external (for base class compatibility).
   */
  protected async pushToExternal(): Promise<SyncEntity[]> {
    return [];
  }

  /**
   * Pull from external (for base class compatibility).
   */
  protected async pullFromExternal(): Promise<SyncEntity[]> {
    return [];
  }
}

export default MagentoSyncEngine;
