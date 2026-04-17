/**
 * Odoo JSON-RPC Integration Client
 *
 * Odoo is not OAuth-based; instead uses API key or session-based authentication.
 * Odoo uses JSON-RPC at `/jsonrpc` endpoint with `call` method for `execute_kw`.
 *
 * Covers:
 * - Products (product.product / product.template)
 * - Sale Orders
 * - Purchase Orders
 * - Partners (customers/suppliers)
 * - Stock (stock.quant, stock.picking)
 * - Invoices
 * - Payments
 * - Categories
 *
 * This is a standalone class that does NOT extend IntegrationClient,
 * as Odoo uses a different authentication model.
 */

import { logger } from "@/lib/logger";

export interface OdooCredentials {
  url: string;
  database: string;
  username: string;
  password?: string;
  apiKey?: string;
  uid?: number;
}

export interface OdooProduct {
  id: number;
  name: string;
  sku?: string;
  default_code?: string;
  type?: string;
  list_price?: number;
  standard_price?: number;
  qty_available?: number;
  virtual_available?: number;
  uom_id?: Array<number | string>;
  categ_id?: Array<number | string>;
}

export interface OdooPartner {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  street?: string;
  city?: string;
  country_id?: Array<number | string>;
  is_company?: boolean;
  customer_rank?: number;
  supplier_rank?: number;
}

export interface OdooSaleOrder {
  id: number;
  name: string;
  partner_id: Array<number | string>;
  order_line?: Array<{
    id: number;
    product_id: Array<number | string>;
    product_qty: number;
    price_unit: number;
  }>;
  state?: string;
  amount_total?: number;
  date_order?: string;
}

export interface OdooPurchaseOrder {
  id: number;
  name: string;
  partner_id: Array<number | string>;
  order_line?: Array<{
    id: number;
    product_id: Array<number | string>;
    product_qty: number;
    price_unit: number;
  }>;
  state?: string;
  amount_total?: number;
  date_order?: string;
}

export interface OdooInvoice {
  id: number;
  name: string;
  partner_id: Array<number | string>;
  invoice_line_ids?: Array<{
    id: number;
    product_id: Array<number | string>;
    quantity: number;
    price_unit: number;
  }>;
  state?: string;
  amount_total?: number;
  invoice_date?: string;
  move_type?: string;
}

export interface OdooStockQuant {
  id: number;
  product_id: Array<number | string>;
  location_id: Array<number | string>;
  quantity: number;
  reserved_quantity?: number;
}

class OdooClient {
  private credentials: OdooCredentials;
  private uid: number | null = null;
  private sessionId: string | null = null;

  constructor(credentials: OdooCredentials) {
    this.credentials = credentials;
  }

  /**
   * Authenticate with Odoo and establish a session.
   */
  async authenticate(): Promise<number> {
    try {
      const response = await fetch(`${this.credentials.url}/web/session/authenticate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params: {
            db: this.credentials.database,
            login: this.credentials.username,
            password: this.credentials.password,
          },
        }),
      });

      const data = (await response.json()) as { result?: { uid?: number }; error?: unknown };

      if (data.error) {
        throw new Error(`Odoo authentication failed: ${JSON.stringify(data.error)}`);
      }

      this.uid = data.result?.uid || 0;
      logger.info("Odoo authentication successful", { uid: this.uid });
      return this.uid;
    } catch (error) {
      logger.error("Odoo authentication error", { error });
      throw error;
    }
  }

  /**
   * Make a JSON-RPC call to Odoo.
   */
  private async jsonRpcCall<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    try {
      const response = await fetch(`${this.credentials.url}/jsonrpc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "call",
          params,
        }),
      });

      const data = (await response.json()) as { result?: T; error?: unknown };

      if (data.error) {
        throw new Error(`Odoo RPC error: ${JSON.stringify(data.error)}`);
      }

      return data.result as T;
    } catch (error) {
      logger.error("Odoo JSON-RPC call failed", { method, error });
      throw error;
    }
  }

  /**
   * Execute a model method on the server using execute_kw.
   */
  private async executeKw<T = unknown>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    if (!this.uid) {
      await this.authenticate();
    }

    return this.jsonRpcCall<T>("execute_kw", {
      db: this.credentials.database,
      uid: this.uid,
      password: this.credentials.password || this.credentials.apiKey,
      model,
      method,
      args,
      kwargs,
    });
  }

  /**
   * Search for products.
   */
  async searchProducts(domainFilter?: unknown[], limit?: number): Promise<number[]> {
    const domain = domainFilter || [];
    const ids = await this.executeKw<number[]>("product.product", "search", [domain], {
      limit,
    });
    return ids;
  }

  /**
   * Read product details.
   */
  async readProducts(ids: number[], fields?: string[]): Promise<OdooProduct[]> {
    const defaultFields = [
      "id",
      "name",
      "default_code",
      "list_price",
      "standard_price",
      "qty_available",
      "virtual_available",
      "uom_id",
      "categ_id",
    ];
    const products = await this.executeKw<OdooProduct[]>("product.product", "read", [ids], {
      fields: fields || defaultFields,
    });
    return products;
  }

  /**
   * Create a new product.
   */
  async createProduct(values: Partial<OdooProduct>): Promise<number> {
    const productId = await this.executeKw<number>("product.product", "create", [], {
      ...values,
    });
    return productId;
  }

  /**
   * Update a product.
   */
  async updateProduct(id: number, values: Partial<OdooProduct>): Promise<boolean> {
    const result = await this.executeKw<boolean>("product.product", "write", [[id]], {
      ...values,
    });
    return result;
  }

  /**
   * Search for partners (customers/suppliers).
   */
  async searchPartners(domainFilter?: unknown[]): Promise<number[]> {
    const domain = domainFilter || [];
    const ids = await this.executeKw<number[]>("res.partner", "search", [domain]);
    return ids;
  }

  /**
   * Read partner details.
   */
  async readPartners(ids: number[], fields?: string[]): Promise<OdooPartner[]> {
    const defaultFields = [
      "id",
      "name",
      "email",
      "phone",
      "mobile",
      "street",
      "city",
      "country_id",
      "is_company",
      "customer_rank",
      "supplier_rank",
    ];
    const partners = await this.executeKw<OdooPartner[]>("res.partner", "read", [ids], {
      fields: fields || defaultFields,
    });
    return partners;
  }

  /**
   * Search for sale orders.
   */
  async searchSaleOrders(domainFilter?: unknown[]): Promise<number[]> {
    const domain = domainFilter || [];
    const ids = await this.executeKw<number[]>("sale.order", "search", [domain]);
    return ids;
  }

  /**
   * Read sale order details.
   */
  async readSaleOrders(ids: number[], fields?: string[]): Promise<OdooSaleOrder[]> {
    const defaultFields = [
      "id",
      "name",
      "partner_id",
      "order_line",
      "state",
      "amount_total",
      "date_order",
    ];
    const orders = await this.executeKw<OdooSaleOrder[]>("sale.order", "read", [ids], {
      fields: fields || defaultFields,
    });
    return orders;
  }

  /**
   * Create a new sale order.
   */
  async createSaleOrder(values: Partial<OdooSaleOrder>): Promise<number> {
    const orderId = await this.executeKw<number>("sale.order", "create", [], {
      ...values,
    });
    return orderId;
  }

  /**
   * Search for purchase orders.
   */
  async searchPurchaseOrders(domainFilter?: unknown[]): Promise<number[]> {
    const domain = domainFilter || [];
    const ids = await this.executeKw<number[]>("purchase.order", "search", [domain]);
    return ids;
  }

  /**
   * Read purchase order details.
   */
  async readPurchaseOrders(ids: number[], fields?: string[]): Promise<OdooPurchaseOrder[]> {
    const defaultFields = [
      "id",
      "name",
      "partner_id",
      "order_line",
      "state",
      "amount_total",
      "date_order",
    ];
    const orders = await this.executeKw<OdooPurchaseOrder[]>("purchase.order", "read", [ids], {
      fields: fields || defaultFields,
    });
    return orders;
  }

  /**
   * Search for invoices.
   */
  async searchInvoices(domainFilter?: unknown[]): Promise<number[]> {
    const domain = domainFilter || [];
    const ids = await this.executeKw<number[]>("account.move", "search", [domain]);
    return ids;
  }

  /**
   * Read invoice details.
   */
  async readInvoices(ids: number[], fields?: string[]): Promise<OdooInvoice[]> {
    const defaultFields = [
      "id",
      "name",
      "partner_id",
      "invoice_line_ids",
      "state",
      "amount_total",
      "invoice_date",
      "move_type",
    ];
    const invoices = await this.executeKw<OdooInvoice[]>("account.move", "read", [ids], {
      fields: fields || defaultFields,
    });
    return invoices;
  }

  /**
   * Search for stock quants (inventory).
   */
  async searchStockQuants(domainFilter?: unknown[]): Promise<number[]> {
    const domain = domainFilter || [];
    const ids = await this.executeKw<number[]>("stock.quant", "search", [domain]);
    return ids;
  }

  /**
   * Read stock quant details.
   */
  async readStockQuants(ids: number[], fields?: string[]): Promise<OdooStockQuant[]> {
    const defaultFields = ["id", "product_id", "location_id", "quantity", "reserved_quantity"];
    const quants = await this.executeKw<OdooStockQuant[]>("stock.quant", "read", [ids], {
      fields: fields || defaultFields,
    });
    return quants;
  }
}

export default OdooClient;
