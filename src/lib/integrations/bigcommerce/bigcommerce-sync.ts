/**
 * Phase E: BigCommerce sync orchestrator.
 *
 * Bidirectional sync between OneAce and BigCommerce:
 * - Products ↔ Items (pull products, push inventory updates)
 * - Orders → SalesOrders (pull orders inbound only)
 * - Customers → external mapping (for reference, no local storage)
 * - Inventory → StockLevel (pull inventory levels)
 *
 * Uses ID mapping in integration settings JSON:
 * { itemIdMap: { "bc_prod_123": "oneace_item_456" }, ... }
 */

import { db } from "@/lib/db";
import SyncEngine, {
  type SyncContext,
  type SyncResult,
  type SyncEntity,
} from "@/lib/integrations/sync-engine";
import { logger } from "@/lib/logger";
import type BigCommerceClient from "./bigcommerce-client";
import type { BigCommerceOrder, BigCommerceProduct } from "./bigcommerce-client";

interface BigCommerceSyncSettings {
  itemIdMap?: Record<string, string>;
  orderIdMap?: Record<string, string>;
  lastSyncTimestamp?: Record<string, number>;
}

export class BigCommerceSyncEngine extends SyncEngine {
  private client: BigCommerceClient;

  constructor(client: BigCommerceClient) {
    super();
    this.client = client;
  }

  /**
   * Main sync entry point.
   */
  async sync(context: SyncContext): Promise<SyncResult> {
    logger.info("Starting BigCommerce sync", {
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
      logger.error("BigCommerce sync failed", { error, context });
      return {
        success: false,
        provider: "BIGCOMMERCE",
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
   * Sync products: pull from BigCommerce and update/create Items.
   */
  private async syncItems(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: "BIGCOMMERCE",
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
          provider: "BIGCOMMERCE",
        },
      });

      if (!integration) {
        throw new Error("BigCommerce integration not found");
      }

      const settings = (integration.settings as BigCommerceSyncSettings) || {};
      const itemIdMap = settings.itemIdMap || {};

      // Fetch all products from BigCommerce
      let allProducts: BigCommerceProduct[] = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const response = await this.client.listProducts(limit, offset);
        allProducts = allProducts.concat(response.data);

        if (response.meta.current_page >= response.meta.pages) {
          break;
        }

        offset += limit;
      }

      logger.info(`Fetched ${allProducts.length} products from BigCommerce`);

      // Process each product
      for (const product of allProducts) {
        try {
          const bcProductId = String(product.id);
          const existingItemId = itemIdMap[bcProductId];

          if (context.direction === "OUTBOUND") {
            // Push inventory updates to BigCommerce
            if (existingItemId) {
              const item = await db.item.findUnique({
                where: { id: existingItemId },
                include: { stockLevels: true },
              });

              if (item) {
                const totalStock = item.stockLevels.reduce(
                  (sum: number, sl: any) => sum + sl.quantity,
                  0,
                );
                await this.client.updateInventory(product.id, totalStock);
                result.itemsSynced++;
              }
            }
          } else {
            // Pull products from BigCommerce and update/create Items
            let item = existingItemId
              ? await db.item.findUnique({ where: { id: existingItemId } })
              : null;

            if (!item) {
              // Create new item
              item = await db.item.create({
                data: {
                  organizationId: context.organizationId,
                  sku: product.sku,
                  name: product.name,
                  description: product.description,
                },
              });

              itemIdMap[bcProductId] = item.id;
            } else {
              // Update existing item
              item = await db.item.update({
                where: { id: item.id },
                data: {
                  name: product.name,
                  description: product.description,
                },
              });
            }

            // Handle variants and inventory
            if (product.variants && product.variants.length > 0) {
              for (const variant of product.variants) {
                // Find or create default warehouse stock level
                const defaultWarehouse = await db.warehouse.findFirst({
                  where: { organizationId: context.organizationId, isDefault: true },
                });

                if (defaultWarehouse && variant.inventory_level !== undefined) {
                  const existingStock = await db.stockLevel.findFirst({
                    where: {
                      itemId: item.id,
                      warehouseId: defaultWarehouse.id,
                    },
                  });

                  if (existingStock) {
                    await db.stockLevel.update({
                      where: { id: existingStock.id },
                      data: { quantity: variant.inventory_level },
                    });
                  } else {
                    await db.stockLevel.create({
                      data: {
                        organizationId: context.organizationId,
                        itemId: item.id,
                        warehouseId: defaultWarehouse.id,
                        binId: "default",
                        quantity: variant.inventory_level,
                      },
                    });
                  }
                }
              }
            } else if (product.inventory_level !== undefined) {
              // Product without variants - use main inventory
              const defaultWarehouse = await db.warehouse.findFirst({
                where: { organizationId: context.organizationId, isDefault: true },
              });

              if (defaultWarehouse) {
                const existingStock = await db.stockLevel.findFirst({
                  where: {
                    itemId: item.id,
                    warehouseId: defaultWarehouse.id,
                  },
                });

                if (existingStock) {
                  await db.stockLevel.update({
                    where: { id: existingStock.id },
                    data: { quantity: product.inventory_level },
                  });
                } else {
                  await db.stockLevel.create({
                    data: {
                      organizationId: context.organizationId,
                      itemId: item.id,
                      warehouseId: defaultWarehouse.id,
                      binId: "default",
                      quantity: product.inventory_level,
                    },
                  });
                }
              }
            }

            result.itemsSynced++;
          }
        } catch (error) {
          result.itemsFailed++;
          result.errors.push({
            itemId: String(product.id),
            error: error instanceof Error ? error.message : "Unknown error",
          });
          logger.warn("Failed to sync product", { productId: product.id, error });
        }
      }

      // Save updated ID mapping
      if (Object.keys(itemIdMap).length > 0) {
        await db.integration.update({
          where: { id: integration.id },
          data: {
            settings: {
              ...settings,
              itemIdMap,
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
   * Sync orders: pull from BigCommerce and create/update SalesOrders.
   */
  private async syncOrders(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: "BIGCOMMERCE",
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
          provider: "BIGCOMMERCE",
        },
      });

      if (!integration) {
        throw new Error("BigCommerce integration not found");
      }

      const settings = (integration.settings as BigCommerceSyncSettings) || {};
      const orderIdMap = settings.orderIdMap || {};
      const itemIdMap = settings.itemIdMap || {};

      // Fetch all orders from BigCommerce
      let allOrders: BigCommerceOrder[] = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const response = await this.client.listOrders(limit, offset);
        allOrders = allOrders.concat(response.data);

        if (response.meta.current_page >= response.meta.pages) {
          break;
        }

        offset += limit;
      }

      logger.info(`Fetched ${allOrders.length} orders from BigCommerce`);

      // Process each order
      for (const order of allOrders) {
        try {
          const bcOrderId = String(order.id);
          const existingSalesOrderId = orderIdMap[bcOrderId];

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
                orderNumber: order.order_number,
                customerName: order.customer_name,
                customerRef: String(order.customer_id),
                status: "CONFIRMED",
                note: `BigCommerce Order #${order.id} - Status: ${order.status}`,
              },
            });

            orderIdMap[bcOrderId] = salesOrder.id;
          } else {
            // Update existing order
            salesOrder = await db.salesOrder.update({
              where: { id: salesOrder.id },
              data: {
                note: `BigCommerce Order #${order.id} - Status: ${order.status}`,
              },
            });
          }

          // Create/update sales order lines
          if (order.products && order.products.length > 0) {
            for (const product of order.products) {
              const itemId = itemIdMap[String(product.product_id)];

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
                    data: { orderedQty: product.quantity },
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
                        orderedQty: product.quantity,
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
            itemId: String(order.id),
            error: error instanceof Error ? error.message : "Unknown error",
          });
          logger.warn("Failed to sync order", { orderId: order.id, error });
        }
      }

      // Save updated ID mappings
      if (Object.keys(orderIdMap).length > 0 || Object.keys(itemIdMap).length > 0) {
        await db.integration.update({
          where: { id: integration.id },
          data: {
            settings: {
              ...settings,
              itemIdMap,
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
   * Sync inventory: pull inventory levels from BigCommerce and update StockLevels.
   */
  private async syncInventory(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: "BIGCOMMERCE",
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
          provider: "BIGCOMMERCE",
        },
      });

      if (!integration) {
        throw new Error("BigCommerce integration not found");
      }

      const settings = (integration.settings as BigCommerceSyncSettings) || {};
      const itemIdMap = settings.itemIdMap || {};

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

      // Fetch all products to get inventory
      let allProducts: BigCommerceProduct[] = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const response = await this.client.listProducts(limit, offset);
        allProducts = allProducts.concat(response.data);

        if (response.meta.current_page >= response.meta.pages) {
          break;
        }

        offset += limit;
      }

      // Process inventory for each product
      for (const product of allProducts) {
        try {
          const itemId = itemIdMap[String(product.id)];

          if (!itemId) {
            result.itemsSkipped++;
            continue;
          }

          if (product.variants && product.variants.length > 0) {
            for (const variant of product.variants) {
              if (variant.inventory_level !== undefined) {
                const existingStock = await db.stockLevel.findFirst({
                  where: {
                    itemId,
                    warehouseId: defaultWarehouse.id,
                  },
                });

                if (existingStock) {
                  await db.stockLevel.update({
                    where: { id: existingStock.id },
                    data: { quantity: variant.inventory_level },
                  });
                } else {
                  await db.stockLevel.create({
                    data: {
                      organizationId: context.organizationId,
                      itemId,
                      warehouseId: defaultWarehouse.id,
                      binId: "default",
                      quantity: variant.inventory_level,
                    },
                  });
                }

                result.itemsSynced++;
              }
            }
          } else if (product.inventory_level !== undefined) {
            const existingStock = await db.stockLevel.findFirst({
              where: {
                itemId,
                warehouseId: defaultWarehouse.id,
              },
            });

            if (existingStock) {
              await db.stockLevel.update({
                where: { id: existingStock.id },
                data: { quantity: product.inventory_level },
              });
            } else {
              await db.stockLevel.create({
                data: {
                  organizationId: context.organizationId,
                  itemId,
                  warehouseId: defaultWarehouse.id,
                  binId: "default",
                  quantity: product.inventory_level,
                },
              });
            }

            result.itemsSynced++;
          }
        } catch (error) {
          result.itemsFailed++;
          result.errors.push({
            itemId: String(product.id),
            error: error instanceof Error ? error.message : "Unknown error",
          });
          logger.warn("Failed to sync inventory", { productId: product.id, error });
        }
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

export default BigCommerceSyncEngine;
