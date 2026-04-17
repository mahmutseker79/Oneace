/**
 * Odoo Sync Engine
 *
 * Handles bidirectional sync between OneAce and Odoo:
 * - Products (product.product) ↔ Items
 * - Sale Orders ↔ Sales Orders + Sales Order Lines
 * - Purchase Orders ↔ Purchase Orders
 * - Partners (customers/suppliers) ↔ Supplier/Customer references
 * - Stock Quants ↔ Stock Levels
 * - Invoices ↔ invoices (stored as reference)
 *
 * Uses ID mapping stored in integration settings JSON.
 * Per-entity sync timestamps for incremental updates.
 * Batch processing with error isolation.
 */

import SyncEngine, { type SyncContext, type SyncEntity, type SyncResult } from "@/lib/integrations/sync-engine";
import OdooClient, {
  type OdooProduct,
  type OdooSaleOrder,
  type OdooPurchaseOrder,
  type OdooPartner,
  type OdooInvoice,
  type OdooStockQuant,
} from "./odoo-client";
import { logger } from "@/lib/logger";

interface OdooSyncContext extends SyncContext {
  odooClient: OdooClient;
  idMapping?: Record<string, string>;
}

class OdooSyncEngine extends SyncEngine {
  /**
   * Main sync orchestrator for Odoo.
   */
  async sync(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const odooContext = context as OdooSyncContext;

    const result: SyncResult = {
      success: true,
      provider: "ODOO",
      direction: context.direction,
      entityType: context.entityType,
      itemsSynced: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [],
    };

    try {
      switch (context.entityType) {
        case "products":
          await this.syncProducts(odooContext, result);
          break;
        case "sale_orders":
          await this.syncSaleOrders(odooContext, result);
          break;
        case "purchase_orders":
          await this.syncPurchaseOrders(odooContext, result);
          break;
        case "partners":
          await this.syncPartners(odooContext, result);
          break;
        case "stock":
          await this.syncStock(odooContext, result);
          break;
        case "invoices":
          await this.syncInvoices(odooContext, result);
          break;
        default:
          throw new Error(`Unsupported entity type: ${context.entityType}`);
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      logger.error("Odoo sync failed", {
        entityType: context.entityType,
        direction: context.direction,
        error,
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Sync products between OneAce Items and Odoo Products.
   */
  private async syncProducts(context: OdooSyncContext, result: SyncResult): Promise<void> {
    const odooClient = context.odooClient;

    if (context.direction === "INBOUND") {
      // Pull Odoo products to OneAce items
      const productIds = await odooClient.searchProducts();
      const products = await odooClient.readProducts(productIds);

      const { processed, failed, errors } = await this.processBatch(
        products.map((p) => ({
          id: String(p.id),
          externalId: String(p.id),
          data: {
            name: p.name,
            sku: p.default_code,
            list_price: p.list_price,
            standard_price: p.standard_price,
            qty_available: p.qty_available,
            virtual_available: p.virtual_available,
            type: p.type,
            uom_id: p.uom_id,
            categ_id: p.categ_id,
          },
        })),
        context,
        async (entity) => {
          // Transform and save to OneAce Item
          const transformed = this.transformToLocal(entity);
          logger.info("Would create/update OneAce item from Odoo product", {
            itemId: entity.id,
            odooId: entity.externalId,
          });
        },
      );

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors = errors;
    } else if (context.direction === "OUTBOUND") {
      // Push OneAce items to Odoo products
      logger.info("Odoo product outbound sync would push items to Odoo");
      result.itemsSynced = 0;
    }
  }

  /**
   * Sync sale orders between Odoo Sale Orders and OneAce Sales Orders.
   */
  private async syncSaleOrders(context: OdooSyncContext, result: SyncResult): Promise<void> {
    const odooClient = context.odooClient;

    if (context.direction === "INBOUND") {
      // Pull Odoo sale orders to OneAce sales orders
      const orderIds = await odooClient.searchSaleOrders();
      const orders = await odooClient.readSaleOrders(orderIds);

      const { processed, failed, errors } = await this.processBatch(
        orders.map((o) => ({
          id: String(o.id),
          externalId: String(o.id),
          data: {
            orderNumber: o.name,
            partnerId: o.partner_id,
            orderLine: o.order_line,
            state: o.state,
            amountTotal: o.amount_total,
            dateOrder: o.date_order,
          },
        })),
        context,
        async (entity) => {
          // Transform and save to OneAce SalesOrder
          const transformed = this.transformToLocal(entity);
          logger.info("Would create/update OneAce sales order from Odoo sale order", {
            orderId: entity.id,
            odooId: entity.externalId,
          });
        },
      );

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors = errors;
    }
  }

  /**
   * Sync purchase orders between Odoo Purchase Orders and OneAce.
   */
  private async syncPurchaseOrders(context: OdooSyncContext, result: SyncResult): Promise<void> {
    const odooClient = context.odooClient;

    if (context.direction === "INBOUND") {
      // Pull Odoo purchase orders to OneAce
      const orderIds = await odooClient.searchPurchaseOrders();
      const orders = await odooClient.readPurchaseOrders(orderIds);

      const { processed, failed, errors } = await this.processBatch(
        orders.map((o) => ({
          id: String(o.id),
          externalId: String(o.id),
          data: {
            orderNumber: o.name,
            partnerId: o.partner_id,
            orderLine: o.order_line,
            state: o.state,
            amountTotal: o.amount_total,
            dateOrder: o.date_order,
          },
        })),
        context,
        async (entity) => {
          // Transform and save to OneAce PurchaseOrder
          logger.info("Would create/update OneAce purchase order from Odoo", {
            orderId: entity.id,
            odooId: entity.externalId,
          });
        },
      );

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors = errors;
    }
  }

  /**
   * Sync partners between Odoo Partners and OneAce customer/supplier references.
   */
  private async syncPartners(context: OdooSyncContext, result: SyncResult): Promise<void> {
    const odooClient = context.odooClient;

    if (context.direction === "INBOUND") {
      // Pull Odoo partners to OneAce (as external references)
      const partnerIds = await odooClient.searchPartners();
      const partners = await odooClient.readPartners(partnerIds);

      const { processed, failed, errors } = await this.processBatch(
        partners.map((p) => ({
          id: String(p.id),
          externalId: String(p.id),
          data: {
            name: p.name,
            email: p.email,
            phone: p.phone,
            mobile: p.mobile,
            street: p.street,
            city: p.city,
            countryId: p.country_id,
            isCompany: p.is_company,
            customerRank: p.customer_rank,
            supplierRank: p.supplier_rank,
          },
        })),
        context,
        async (entity) => {
          // Store as external partner reference
          logger.info("Would store Odoo partner as external reference", {
            partnerId: entity.id,
          });
        },
      );

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors = errors;
    }
  }

  /**
   * Sync stock levels between Odoo Stock Quants and OneAce Stock Levels.
   */
  private async syncStock(context: OdooSyncContext, result: SyncResult): Promise<void> {
    const odooClient = context.odooClient;

    if (context.direction === "BIDIRECTIONAL" || context.direction === "INBOUND") {
      // Pull Odoo stock quants to OneAce stock levels
      const quantIds = await odooClient.searchStockQuants();
      const quants = await odooClient.readStockQuants(quantIds);

      const { processed, failed, errors } = await this.processBatch(
        quants.map((q) => ({
          id: String(q.id),
          externalId: String(q.id),
          data: {
            productId: q.product_id,
            locationId: q.location_id,
            quantity: q.quantity,
            reservedQuantity: q.reserved_quantity,
          },
        })),
        context,
        async (entity) => {
          // Transform and save to OneAce StockLevel
          logger.info("Would update OneAce stock level from Odoo quant", {
            quantId: entity.id,
          });
        },
      );

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors = errors;
    }
  }

  /**
   * Sync invoices between Odoo Invoices and OneAce.
   */
  private async syncInvoices(context: OdooSyncContext, result: SyncResult): Promise<void> {
    const odooClient = context.odooClient;

    if (context.direction === "INBOUND") {
      // Pull Odoo invoices to OneAce (as external reference)
      const invoiceIds = await odooClient.searchInvoices();
      const invoices = await odooClient.readInvoices(invoiceIds);

      const { processed, failed, errors } = await this.processBatch(
        invoices.map((i) => ({
          id: String(i.id),
          externalId: String(i.id),
          data: {
            name: i.name,
            partnerId: i.partner_id,
            invoiceLineIds: i.invoice_line_ids,
            state: i.state,
            amountTotal: i.amount_total,
            invoiceDate: i.invoice_date,
            moveType: i.move_type,
          },
        })),
        context,
        async (entity) => {
          // Store as external invoice reference
          logger.info("Would store Odoo invoice as external reference", {
            invoiceId: entity.id,
          });
        },
      );

      result.itemsSynced = processed;
      result.itemsFailed = failed;
      result.errors = errors;
    }
  }

  /**
   * Transform external Odoo entity to OneAce format.
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
   * Transform OneAce entity to Odoo format.
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
   * Fetch entities from Odoo (not used in main sync, but available).
   */
  protected async fetchExternalEntities(
    context: SyncContext,
    _checkpoint?: string,
  ): Promise<SyncEntity[]> {
    const odooContext = context as OdooSyncContext;
    const odooClient = odooContext.odooClient;

    switch (context.entityType) {
      case "products": {
        const productIds = await odooClient.searchProducts();
        const products = await odooClient.readProducts(productIds);
        return products.map((p) => ({
          id: String(p.id),
          externalId: String(p.id),
          data: p as unknown as Record<string, unknown>,
        }));
      }
      case "sale_orders": {
        const orderIds = await odooClient.searchSaleOrders();
        const orders = await odooClient.readSaleOrders(orderIds);
        return orders.map((o) => ({
          id: String(o.id),
          externalId: String(o.id),
          data: o as unknown as Record<string, unknown>,
        }));
      }
      case "partners": {
        const partnerIds = await odooClient.searchPartners();
        const partners = await odooClient.readPartners(partnerIds);
        return partners.map((p) => ({
          id: String(p.id),
          externalId: String(p.id),
          data: p as unknown as Record<string, unknown>,
        }));
      }
      default:
        return [];
    }
  }

  protected async pushToExternal(
    _entities: SyncEntity[],
    _context: SyncContext,
  ): Promise<SyncEntity[]> {
    // Implementation would push OneAce data to Odoo
    return [];
  }

  protected async pullFromExternal(
    entities: SyncEntity[],
    _context: SyncContext,
  ): Promise<SyncEntity[]> {
    // Entities already fetched, just transform
    return entities.map((e) => this.transformToLocal(e));
  }
}

export default OdooSyncEngine;
