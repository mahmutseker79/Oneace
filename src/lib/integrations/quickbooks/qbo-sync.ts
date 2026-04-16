/**
 * Phase E: QuickBooks Online sync engine.
 *
 * Syncs Items, Suppliers, and Purchase Orders between OneAce and QBO.
 * Implements entity-specific transformation and conflict resolution.
 */

import { db } from "@/lib/db";
import type { QBOClient, QBOItem } from "@/lib/integrations/quickbooks/qbo-client";
import {
  type SyncContext,
  SyncEngine,
  type SyncEntity,
  type SyncResult,
} from "@/lib/integrations/sync-engine";
import { logger } from "@/lib/logger";

export class QBOSyncEngine extends SyncEngine {
  private client: QBOClient;

  constructor(client: QBOClient) {
    super();
    this.client = client;
  }

  /**
   * Execute a QBO sync operation.
   */
  async sync(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: "QUICKBOOKS_ONLINE",
      direction: context.direction,
      entityType: context.entityType,
      itemsSynced: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [],
    };

    try {
      if (context.entityType === "ITEM") {
        await this.syncItems(context, result);
      } else if (context.entityType === "SUPPLIER") {
        await this.syncSuppliers(context, result);
      } else if (context.entityType === "PURCHASE_ORDER") {
        await this.syncPurchaseOrders(context, result);
      } else {
        throw new Error(`Unsupported entity type: ${context.entityType}`);
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      logger.error("QBO sync failed", {
        organizationId: context.organizationId,
        entityType: context.entityType,
        error,
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Sync items (products/services).
   */
  private async syncItems(context: SyncContext, result: SyncResult): Promise<void> {
    const qboItems = await this.client.getItems();

    const items = qboItems.map((item) => ({
      id: item.id,
      externalId: item.id,
      data: {
        name: item.name,
        sku: item.sku,
        description: item.description,
        unitPrice: item.unitPrice,
        type: item.type,
      },
    }));

    if (context.direction === "INBOUND") {
      const { processed, failed, errors } = await this.processBatch(
        items,
        context,
        async (item) => {
          await db.item.upsert({
            where: {
              organizationId_sku: {
                organizationId: context.organizationId,
                sku: String(item.data.sku || item.id),
              },
            },
            create: {
              organizationId: context.organizationId,
              name: String(item.data.name),
              sku: String(item.data.sku || item.id),
              description: String(item.data.description || ""),
              categoryId: (
                await db.category.findFirst({
                  where: { organizationId: context.organizationId },
                  select: { id: true },
                })
              )?.id,
            },
            update: {
              name: String(item.data.name),
              description: String(item.data.description || ""),
            },
          });
        },
      );

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors.push(...errors);
    }
  }

  /**
   * Sync suppliers (vendors).
   */
  private async syncSuppliers(context: SyncContext, result: SyncResult): Promise<void> {
    const qboVendors = await this.client.getVendors();

    const suppliers = qboVendors.map((vendor) => ({
      id: vendor.id,
      externalId: vendor.id,
      data: {
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
      },
    }));

    if (context.direction === "INBOUND") {
      const { processed, failed, errors } = await this.processBatch(
        suppliers,
        context,
        async (supplier) => {
          const code = String(supplier.data.name).substring(0, 4).toUpperCase();
          await db.supplier
            .create({
              data: {
                organizationId: context.organizationId,
                name: String(supplier.data.name),
                code,
                email: String(supplier.data.email || ""),
                phone: String(supplier.data.phone || ""),
              },
            })
            .catch(async () => {
              return db.supplier.updateMany({
                where: {
                  organizationId: context.organizationId,
                  name: String(supplier.data.name),
                },
                data: {
                  email: String(supplier.data.email || ""),
                  phone: String(supplier.data.phone || ""),
                },
              });
            });
        },
      );

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors.push(...errors);
    }
  }

  /**
   * Sync purchase orders.
   */
  private async syncPurchaseOrders(context: SyncContext, result: SyncResult): Promise<void> {
    const qboPOs = await this.client.getPurchaseOrders();

    const pos = qboPOs.map((po) => ({
      id: po.id,
      externalId: po.id,
      data: {
        docNumber: po.docNumber,
        vendorId: po.vendorId,
        amount: po.amount,
        dueDate: po.dueDate,
        status: po.status,
        lineItems: po.lineItems,
      },
    }));

    if (context.direction === "INBOUND") {
      const { processed, failed, errors } = await this.processBatch(pos, context, async (po) => {
        // For now, we'll need to match suppliers by vendorId or create a fallback
        // In a real scenario, this would be stored during vendor sync
        const vendorName = String(po.data.vendorId || "Unknown Vendor");

        const supplier = await db.supplier.findFirst({
          where: {
            organizationId: context.organizationId,
            name: vendorName,
          },
        });

        if (!supplier) {
          logger.warn("Supplier not found for PO", {
            poNumber: po.data.docNumber,
          });
          return;
        }

        // Get default warehouse
        const warehouse = await db.warehouse.findFirst({
          where: {
            organizationId: context.organizationId,
            isArchived: false,
          },
        });

        if (!warehouse) {
          logger.warn("No warehouse found for PO sync", {
            organizationId: context.organizationId,
          });
          return;
        }

        await db.purchaseOrder.upsert({
          where: {
            organizationId_poNumber: {
              organizationId: context.organizationId,
              poNumber: String(po.data.docNumber),
            },
          },
          create: {
            organizationId: context.organizationId,
            supplierId: supplier.id,
            warehouseId: warehouse.id,
            poNumber: String(po.data.docNumber),
            status: "DRAFT",
            notes: `Synced from QBO on ${new Date().toISOString()}`,
          },
          update: {
            notes: `Last synced from QBO on ${new Date().toISOString()}`,
          },
        });
      });

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors.push(...errors);
    }
  }

  protected async fetchExternalEntities(context: SyncContext): Promise<SyncEntity[]> {
    if (context.entityType === "ITEM") {
      const items = await this.client.getItems();
      return items.map((item) => ({
        id: item.id,
        externalId: item.id,
        data: {
          name: item.name,
          sku: item.sku,
          description: item.description,
          unitPrice: item.unitPrice,
          type: item.type,
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
    const pushed: SyncEntity[] = [];

    for (const entity of entities) {
      try {
        const item = await this.client.createItem({
          name: String(entity.data.name),
          sku: String(entity.data.sku),
          description: String(entity.data.description),
          unitPrice: Number(entity.data.unitPrice),
          type: entity.data.type === "SERVICE" ? "SERVICE" : "PRODUCT",
        });

        pushed.push({
          ...entity,
          externalId: item.id,
        });
      } catch (error) {
        logger.error("Failed to push entity to QBO", {
          entityId: entity.id,
          error,
        });
      }
    }

    return pushed;
  }

  protected async pullFromExternal(entities: SyncEntity[]): Promise<SyncEntity[]> {
    // Handled by specific sync methods above
    return entities;
  }
}

export default QBOSyncEngine;
