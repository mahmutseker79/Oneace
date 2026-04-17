/**
 * Comprehensive QuickBooks Online API Client.
 *
 * Full QBO V2 REST API coverage:
 * - Items (Products/Services), Customers, Vendors, Invoices, Bills, Payments
 * - Accounts (Chart of Accounts), Tax Codes, Estimates, Sales Receipts
 * - Credit Memos, Journal Entries, Deposits, Classes, Departments
 * - Purchase Orders, Terms, Employees
 * - CDC (Change Data Capture) for incremental sync
 * - Batch read operations, paginated queries, reports API
 * - Delete/void operations, attachment support
 */

import {
  IntegrationClient,
  type OAuthConfig,
  type OAuthToken,
} from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

// ── OAuth Config ────────────────────────────────────────────────

const QBO_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.QBO_CLIENT_ID || "",
  clientSecret: process.env.QBO_CLIENT_SECRET || "",
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/quickbooks/callback`,
  authorizationUrl: "https://appcenter.intuit.com/connect/oauth2",
  tokenUrl: "https://oauth.platform.intuit.com/oauth2/tokens",
  revokeUrl: "https://developer.api.intuit.com/v2/oauth/tokens/revoke",
};

// ── Raw QBO Response Types ──────────────────────────────────────

interface QBORawEntity {
  Id?: string;
  SyncToken?: string;
  MetaData?: { CreateTime?: string; LastUpdatedTime?: string };
  [key: string]: unknown;
}

interface QBOQueryResponse<T = QBORawEntity> {
  QueryResponse: {
    [key: string]: T[] | number | undefined;
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
}

interface QBOCDCResponse {
  CDCResponse: Array<{
    QueryResponse: Array<{
      [key: string]: QBORawEntity[];
    }>;
  }>;
}

interface QBOBatchResponse {
  BatchItemResponse: Array<{
    bId: string;
    Fault?: { Error: Array<{ Message: string; code: string }> };
    [key: string]: unknown;
  }>;
}

// ── Mapped Types (OneAce ↔ QBO) ─────────────────────────────────

export interface QBOItem {
  id: string;
  syncToken: string;
  name: string;
  sku?: string;
  description?: string;
  unitPrice?: number;
  purchaseCost?: number;
  type: "SERVICE" | "PRODUCT";
  active: boolean;
  taxable: boolean;
  qtyOnHand?: number;
  incomeAccountId?: string;
  expenseAccountId?: string;
  assetAccountId?: string;
  lastUpdated?: string;
}

export interface QBOCustomer {
  id: string;
  syncToken: string;
  displayName: string;
  companyName?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  billingAddress?: QBOAddress;
  shippingAddress?: QBOAddress;
  balance?: number;
  currencyCode?: string;
  taxExempt: boolean;
  active: boolean;
  notes?: string;
  lastUpdated?: string;
}

export interface QBOVendor {
  id: string;
  syncToken: string;
  displayName: string;
  companyName?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  billingAddress?: QBOAddress;
  balance?: number;
  currencyCode?: string;
  taxId?: string;
  active: boolean;
  lastUpdated?: string;
}

export interface QBOInvoice {
  id: string;
  syncToken: string;
  docNumber: string;
  customerId: string;
  customerName?: string;
  txnDate: string;
  dueDate?: string;
  totalAmount: number;
  balance: number;
  currencyCode?: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOIDED";
  emailStatus?: string;
  billingAddress?: QBOAddress;
  shippingAddress?: QBOAddress;
  lineItems: QBOInvoiceLine[];
  taxAmount?: number;
  depositAmount?: number;
  memo?: string;
  lastUpdated?: string;
}

export interface QBOInvoiceLine {
  id: string;
  lineNum?: number;
  description?: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  itemId?: string;
  itemName?: string;
  taxCodeId?: string;
  serviceDate?: string;
}

export interface QBOBill {
  id: string;
  syncToken: string;
  docNumber?: string;
  vendorId: string;
  vendorName?: string;
  txnDate: string;
  dueDate?: string;
  totalAmount: number;
  balance: number;
  currencyCode?: string;
  lineItems: QBOBillLine[];
  memo?: string;
  lastUpdated?: string;
}

export interface QBOBillLine {
  id: string;
  lineNum?: number;
  description?: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  itemId?: string;
  accountId?: string;
  customerId?: string;
  taxCodeId?: string;
}

export interface QBOPayment {
  id: string;
  syncToken: string;
  txnDate: string;
  totalAmount: number;
  customerId: string;
  customerName?: string;
  paymentMethodId?: string;
  depositToAccountId?: string;
  currencyCode?: string;
  memo?: string;
  invoiceRefs: Array<{ invoiceId: string; amount: number }>;
  lastUpdated?: string;
}

export interface QBOAccount {
  id: string;
  syncToken: string;
  name: string;
  fullyQualifiedName?: string;
  accountType: string;
  accountSubType?: string;
  classification?: string;
  currentBalance?: number;
  currencyCode?: string;
  active: boolean;
  description?: string;
  lastUpdated?: string;
}

export interface QBOTaxCode {
  id: string;
  syncToken: string;
  name: string;
  description?: string;
  active: boolean;
  taxable: boolean;
  taxGroup: boolean;
  purchaseTaxRateId?: string;
  salesTaxRateId?: string;
}

export interface QBOTaxRate {
  id: string;
  syncToken: string;
  name: string;
  description?: string;
  rateValue: number;
  agencyRef?: string;
  active: boolean;
}

export interface QBOEstimate {
  id: string;
  syncToken: string;
  docNumber: string;
  customerId: string;
  customerName?: string;
  txnDate: string;
  expirationDate?: string;
  totalAmount: number;
  status: "PENDING" | "ACCEPTED" | "CLOSED" | "REJECTED";
  lineItems: QBOInvoiceLine[];
  memo?: string;
  lastUpdated?: string;
}

export interface QBOSalesReceipt {
  id: string;
  syncToken: string;
  docNumber: string;
  customerId?: string;
  customerName?: string;
  txnDate: string;
  totalAmount: number;
  currencyCode?: string;
  paymentMethodId?: string;
  depositToAccountId?: string;
  lineItems: QBOInvoiceLine[];
  memo?: string;
  lastUpdated?: string;
}

export interface QBOCreditMemo {
  id: string;
  syncToken: string;
  docNumber: string;
  customerId: string;
  customerName?: string;
  txnDate: string;
  totalAmount: number;
  balance: number;
  currencyCode?: string;
  lineItems: QBOInvoiceLine[];
  memo?: string;
  lastUpdated?: string;
}

export interface QBOJournalEntry {
  id: string;
  syncToken: string;
  docNumber?: string;
  txnDate: string;
  totalAmount: number;
  adjustment: boolean;
  lines: Array<{
    id: string;
    description?: string;
    amount: number;
    postingType: "DEBIT" | "CREDIT";
    accountId: string;
    accountName?: string;
    classId?: string;
    departmentId?: string;
  }>;
  memo?: string;
  lastUpdated?: string;
}

export interface QBODeposit {
  id: string;
  syncToken: string;
  txnDate: string;
  totalAmount: number;
  depositToAccountId: string;
  currencyCode?: string;
  lines: Array<{
    amount: number;
    accountId?: string;
    paymentMethodId?: string;
    description?: string;
    entityId?: string;
    entityType?: string;
  }>;
  memo?: string;
  lastUpdated?: string;
}

export interface QBOPurchaseOrder {
  id: string;
  syncToken: string;
  docNumber: string;
  vendorId: string;
  vendorName?: string;
  txnDate?: string;
  totalAmount: number;
  dueDate?: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  currencyCode?: string;
  lineItems: Array<{
    id: string;
    itemId?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  memo?: string;
  lastUpdated?: string;
}

export interface QBOClass {
  id: string;
  syncToken: string;
  name: string;
  fullyQualifiedName?: string;
  parentId?: string;
  active: boolean;
}

export interface QBODepartment {
  id: string;
  syncToken: string;
  name: string;
  fullyQualifiedName?: string;
  parentId?: string;
  active: boolean;
}

export interface QBOTerm {
  id: string;
  syncToken: string;
  name: string;
  dueDays: number;
  discountPercent?: number;
  discountDays?: number;
  active: boolean;
}

export interface QBOEmployee {
  id: string;
  syncToken: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  phone?: string;
  active: boolean;
  lastUpdated?: string;
}

export interface QBOAddress {
  line1?: string;
  line2?: string;
  city?: string;
  countrySubDivisionCode?: string;
  postalCode?: string;
  country?: string;
}

export interface QBOCompanyInfo {
  companyName: string;
  legalName?: string;
  country: string;
  email?: string;
  phone?: string;
  fiscalYearStartMonth?: number;
  currencyCode?: string;
  multiCurrencyEnabled: boolean;
  taxForm?: string;
  address?: QBOAddress;
}

export interface QBOReport {
  header: {
    reportName: string;
    startPeriod?: string;
    endPeriod?: string;
    currency?: string;
  };
  rows: QBOReportRow[];
  columns: Array<{ colTitle: string; colType: string }>;
}

export interface QBOReportRow {
  group?: string;
  data: Array<{ value: string; id?: string }>;
  children?: QBOReportRow[];
}

/** Paginated query result */
export interface QBOPagedResult<T> {
  items: T[];
  startPosition: number;
  maxResults: number;
  totalCount?: number;
  hasMore: boolean;
}

/** CDC result: entities changed since a given timestamp */
export interface QBOCDCResult {
  entities: Record<string, QBORawEntity[]>;
  timestamp: string;
}

// ── Helper: parse QBO address ───────────────────────────────────

function parseAddress(raw: Record<string, unknown> | undefined): QBOAddress | undefined {
  if (!raw) return undefined;
  return {
    line1: raw.Line1 as string | undefined,
    line2: raw.Line2 as string | undefined,
    city: raw.City as string | undefined,
    countrySubDivisionCode: raw.CountrySubDivisionCode as string | undefined,
    postalCode: raw.PostalCode as string | undefined,
    country: raw.Country as string | undefined,
  };
}

function buildAddress(addr: QBOAddress | undefined): Record<string, unknown> | undefined {
  if (!addr) return undefined;
  return {
    Line1: addr.line1,
    Line2: addr.line2,
    City: addr.city,
    CountrySubDivisionCode: addr.countrySubDivisionCode,
    PostalCode: addr.postalCode,
    Country: addr.country,
  };
}

// ── Entity type names for QBO queries ───────────────────────────

export const QBO_ENTITY_NAMES = [
  "Item",
  "Customer",
  "Vendor",
  "Invoice",
  "Bill",
  "Payment",
  "Account",
  "TaxCode",
  "TaxRate",
  "Estimate",
  "SalesReceipt",
  "CreditMemo",
  "JournalEntry",
  "Deposit",
  "PurchaseOrder",
  "Class",
  "Department",
  "Term",
  "Employee",
] as const;

export type QBOEntityName = (typeof QBO_ENTITY_NAMES)[number];

// ═════════════════════════════════════════════════════════════════
// QBOClient
// ═════════════════════════════════════════════════════════════════

export class QBOClient extends IntegrationClient {
  private realmId = "";

  constructor(credentials: OAuthToken, realmId: string) {
    super(QBO_OAUTH_CONFIG, credentials, {
      maxRequests: 500,          // QBO allows 500 req/min
      windowMs: 60_000,
      backoffMultiplier: 2,
      maxBackoffMs: 60_000,
    });
    this.realmId = realmId;
    this.baseUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}`;
  }

  // ── Auth helpers ────────────────────────────────────────────

  getAuthorizationUrl(state: string): string {
    return super.getAuthorizationUrl(state, [
      "com.intuit.quickbooks.accounting",
      "com.intuit.quickbooks.payment",
    ]);
  }

  setRealmId(realmId: string): void {
    this.realmId = realmId;
    this.baseUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}`;
  }

  getRealmId(): string {
    return this.realmId;
  }

  // ── QBO-specific API helpers ────────────────────────────────

  /**
   * Run a QBO query (SELECT ... FROM Entity) with pagination.
   */
  private async query<T extends QBORawEntity>(
    entityName: string,
    where?: string,
    orderBy?: string,
    startPosition = 1,
    maxResults = 1000,
  ): Promise<QBOPagedResult<T>> {
    let q = `SELECT * FROM ${entityName}`;
    if (where) q += ` WHERE ${where}`;
    if (orderBy) q += ` ORDERBY ${orderBy}`;
    q += ` STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;

    const response = await this.apiCall<QBOQueryResponse<T>>("/query", {
      params: { query: q },
    });

    const qr = response.data.QueryResponse;
    const items = (qr[entityName] ?? []) as T[];
    const total = qr.totalCount as number | undefined;

    return {
      items,
      startPosition,
      maxResults,
      totalCount: total,
      hasMore: items.length === maxResults,
    };
  }

  /**
   * Fetch ALL records for an entity, handling pagination automatically.
   */
  async queryAll<T extends QBORawEntity>(
    entityName: string,
    where?: string,
    orderBy?: string,
    pageSize = 1000,
  ): Promise<T[]> {
    const all: T[] = [];
    let start = 1;
    let hasMore = true;

    while (hasMore) {
      const page = await this.query<T>(entityName, where, orderBy, start, pageSize);
      all.push(...page.items);
      hasMore = page.hasMore;
      start += pageSize;

      // Safety limit: 50,000 records max
      if (all.length >= 50_000) {
        logger.warn("QBO query hit safety limit", { entityName, count: all.length });
        break;
      }
    }

    return all;
  }

  /**
   * Count entities.
   */
  async count(entityName: string, where?: string): Promise<number> {
    let q = `SELECT COUNT(*) FROM ${entityName}`;
    if (where) q += ` WHERE ${where}`;

    const response = await this.apiCall<QBOQueryResponse>("/query", {
      params: { query: q },
    });

    return (response.data.QueryResponse.totalCount as number) ?? 0;
  }

  /**
   * Read a single entity by ID.
   */
  async read<T = QBORawEntity>(entityName: string, id: string): Promise<T> {
    const response = await this.apiCall<Record<string, T>>(
      `/${entityName.toLowerCase()}/${id}`,
    );
    return response.data[entityName] as T;
  }

  /**
   * Create an entity.
   */
  async create<T = QBORawEntity>(entityName: string, data: Record<string, unknown>): Promise<T> {
    const response = await this.apiCall<Record<string, T>>(
      `/${entityName.toLowerCase()}`,
      { method: "POST", body: data },
    );
    return response.data[entityName] as T;
  }

  /**
   * Update an entity (requires Id + SyncToken).
   */
  async update<T = QBORawEntity>(
    entityName: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const response = await this.apiCall<Record<string, T>>(
      `/${entityName.toLowerCase()}`,
      { method: "POST", body: { ...data, sparse: true } },
    );
    return response.data[entityName] as T;
  }

  /**
   * Delete an entity (soft-delete for most QBO entities).
   */
  async deleteEntity(entityName: string, id: string, syncToken: string): Promise<void> {
    await this.apiCall(`/${entityName.toLowerCase()}`, {
      method: "POST",
      params: { operation: "delete" },
      body: { Id: id, SyncToken: syncToken },
    });
  }

  /**
   * Void a transaction (Invoice, Payment, SalesReceipt, etc.).
   */
  async voidEntity(entityName: string, id: string, syncToken: string): Promise<void> {
    await this.apiCall(`/${entityName.toLowerCase()}`, {
      method: "POST",
      params: { operation: "void" },
      body: { Id: id, SyncToken: syncToken },
    });
  }

  /**
   * Send a transaction via email (Invoice, Estimate, SalesReceipt).
   */
  async sendEmail(entityName: string, id: string, email?: string): Promise<void> {
    const params: Record<string, string> = {};
    if (email) params.sendTo = email;

    await this.apiCall(`/${entityName.toLowerCase()}/${id}/send`, {
      method: "POST",
      params,
    });
  }

  /**
   * Get PDF of a transaction.
   */
  async getPdf(entityName: string, id: string): Promise<ArrayBuffer> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/${entityName.toLowerCase()}/${id}/pdf`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/pdf",
      },
    });
    if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`);
    return response.arrayBuffer();
  }

  // ── CDC (Change Data Capture) ───────────────────────────────

  /**
   * Fetch all changes since a given timestamp (ISO 8601).
   * Supports up to ~15 entity types per call.
   */
  async cdc(
    entities: QBOEntityName[],
    changedSince: string,
  ): Promise<QBOCDCResult> {
    const response = await this.apiCall<QBOCDCResponse>("/cdc", {
      params: {
        entities: entities.join(","),
        changedSince,
      },
    });

    const result: Record<string, QBORawEntity[]> = {};
    const cdcEntries = response.data.CDCResponse?.[0]?.QueryResponse ?? [];

    for (const entry of cdcEntries) {
      for (const [key, value] of Object.entries(entry)) {
        if (Array.isArray(value)) {
          result[key] = value;
        }
      }
    }

    return {
      entities: result,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Batch Operations ────────────────────────────────────────

  /**
   * Batch read: fetch multiple entities in a single API call.
   * QBO supports up to 30 items per batch.
   */
  async batchRead(
    requests: Array<{ entity: string; id: string }>,
  ): Promise<QBOBatchResponse> {
    const batchItems = requests.map((r, idx) => ({
      bId: String(idx),
      Query: `SELECT * FROM ${r.entity} WHERE Id = '${r.id}'`,
    }));

    const response = await this.apiCall<QBOBatchResponse>("/batch", {
      method: "POST",
      body: { BatchItemRequest: batchItems },
    });

    return response.data;
  }

  /**
   * Batch create/update: up to 30 operations per call.
   */
  async batchWrite(
    operations: Array<{
      entity: string;
      operation: "create" | "update" | "delete";
      data: Record<string, unknown>;
    }>,
  ): Promise<QBOBatchResponse> {
    const batchItems = operations.map((op, idx) => ({
      bId: String(idx),
      operation: op.operation,
      [op.entity]: op.data,
    }));

    const response = await this.apiCall<QBOBatchResponse>("/batch", {
      method: "POST",
      body: { BatchItemRequest: batchItems },
    });

    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════
  // ITEMS
  // ═══════════════════════════════════════════════════════════════

  async getItems(options: { limit?: number; offset?: number; active?: boolean; updatedAfter?: Date } = {}): Promise<QBOPagedResult<QBOItem>> {
    const conditions: string[] = [];
    if (options.active !== undefined) conditions.push(`Active = ${options.active}`);
    if (options.updatedAfter) conditions.push(`MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("Item", where, "MetaData.LastUpdatedTime DESC", options.offset ?? 1, options.limit ?? 1000);

    return {
      ...result,
      items: result.items.map(this.mapItem),
    };
  }

  async getAllItems(updatedAfter?: Date): Promise<QBOItem[]> {
    const where = updatedAfter ? `MetaData.LastUpdatedTime >= '${updatedAfter.toISOString()}'` : undefined;
    const raw = await this.queryAll("Item", where, "MetaData.LastUpdatedTime DESC");
    return raw.map(this.mapItem);
  }

  async getItem(id: string): Promise<QBOItem> {
    const raw = await this.read("Item", id);
    return this.mapItem(raw as QBORawEntity);
  }

  async createItem(item: Partial<QBOItem>): Promise<QBOItem> {
    const payload: Record<string, unknown> = {
      Name: item.name,
      Sku: item.sku,
      Description: item.description,
      Type: item.type === "SERVICE" ? "Service" : "Inventory",
      UnitPrice: item.unitPrice,
      PurchaseCost: item.purchaseCost,
      TrackQtyOnHand: item.type === "PRODUCT",
      QtyOnHand: item.qtyOnHand ?? 0,
      InvStartDate: new Date().toISOString().split("T")[0],
      Taxable: item.taxable ?? true,
    };

    if (item.incomeAccountId) payload.IncomeAccountRef = { value: item.incomeAccountId };
    if (item.expenseAccountId) payload.ExpenseAccountRef = { value: item.expenseAccountId };
    if (item.assetAccountId) payload.AssetAccountRef = { value: item.assetAccountId };

    const raw = await this.create("Item", payload);
    return this.mapItem(raw as QBORawEntity);
  }

  async updateItem(id: string, syncToken: string, updates: Partial<QBOItem>): Promise<QBOItem> {
    const payload: Record<string, unknown> = {
      Id: id,
      SyncToken: syncToken,
    };

    if (updates.name !== undefined) payload.Name = updates.name;
    if (updates.sku !== undefined) payload.Sku = updates.sku;
    if (updates.description !== undefined) payload.Description = updates.description;
    if (updates.unitPrice !== undefined) payload.UnitPrice = updates.unitPrice;
    if (updates.purchaseCost !== undefined) payload.PurchaseCost = updates.purchaseCost;
    if (updates.qtyOnHand !== undefined) payload.QtyOnHand = updates.qtyOnHand;
    if (updates.active !== undefined) payload.Active = updates.active;
    if (updates.taxable !== undefined) payload.Taxable = updates.taxable;
    if (updates.incomeAccountId) payload.IncomeAccountRef = { value: updates.incomeAccountId };
    if (updates.expenseAccountId) payload.ExpenseAccountRef = { value: updates.expenseAccountId };
    if (updates.assetAccountId) payload.AssetAccountRef = { value: updates.assetAccountId };

    const raw = await this.update("Item", payload);
    return this.mapItem(raw as QBORawEntity);
  }

  private mapItem = (raw: QBORawEntity): QBOItem => ({
    id: String(raw.Id ?? ""),
    syncToken: String(raw.SyncToken ?? "0"),
    name: String(raw.Name ?? ""),
    sku: raw.Sku ? String(raw.Sku) : undefined,
    description: raw.Description ? String(raw.Description) : undefined,
    unitPrice: raw.UnitPrice != null ? Number(raw.UnitPrice) : undefined,
    purchaseCost: raw.PurchaseCost != null ? Number(raw.PurchaseCost) : undefined,
    type: raw.Type === "Service" ? "SERVICE" : "PRODUCT",
    active: raw.Active !== false,
    taxable: raw.Taxable !== false,
    qtyOnHand: raw.QtyOnHand != null ? Number(raw.QtyOnHand) : undefined,
    incomeAccountId: (raw.IncomeAccountRef as Record<string, unknown>)?.value as string | undefined,
    expenseAccountId: (raw.ExpenseAccountRef as Record<string, unknown>)?.value as string | undefined,
    assetAccountId: (raw.AssetAccountRef as Record<string, unknown>)?.value as string | undefined,
    lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
  });

  // ═══════════════════════════════════════════════════════════════
  // CUSTOMERS
  // ═══════════════════════════════════════════════════════════════

  async getCustomers(options: { limit?: number; offset?: number; active?: boolean; updatedAfter?: Date } = {}): Promise<QBOPagedResult<QBOCustomer>> {
    const conditions: string[] = [];
    if (options.active !== undefined) conditions.push(`Active = ${options.active}`);
    if (options.updatedAfter) conditions.push(`MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("Customer", where, "MetaData.LastUpdatedTime DESC", options.offset ?? 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapCustomer) };
  }

  async getAllCustomers(updatedAfter?: Date): Promise<QBOCustomer[]> {
    const where = updatedAfter ? `MetaData.LastUpdatedTime >= '${updatedAfter.toISOString()}'` : undefined;
    const raw = await this.queryAll("Customer", where);
    return raw.map(this.mapCustomer);
  }

  async getCustomer(id: string): Promise<QBOCustomer> {
    const raw = await this.read("Customer", id);
    return this.mapCustomer(raw as QBORawEntity);
  }

  async createCustomer(customer: Partial<QBOCustomer>): Promise<QBOCustomer> {
    const payload: Record<string, unknown> = {
      DisplayName: customer.displayName,
      CompanyName: customer.companyName,
      GivenName: customer.givenName,
      FamilyName: customer.familyName,
      PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
      PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
      Mobile: customer.mobile ? { FreeFormNumber: customer.mobile } : undefined,
      Fax: customer.fax ? { FreeFormNumber: customer.fax } : undefined,
      WebAddr: customer.website ? { URI: customer.website } : undefined,
      BillAddr: buildAddress(customer.billingAddress),
      ShipAddr: buildAddress(customer.shippingAddress),
      Notes: customer.notes,
      TaxExemptionReasonId: customer.taxExempt ? "1" : undefined,
    };

    if (customer.currencyCode) payload.CurrencyRef = { value: customer.currencyCode };

    const raw = await this.create("Customer", payload);
    return this.mapCustomer(raw as QBORawEntity);
  }

  async updateCustomer(id: string, syncToken: string, updates: Partial<QBOCustomer>): Promise<QBOCustomer> {
    const payload: Record<string, unknown> = { Id: id, SyncToken: syncToken };

    if (updates.displayName !== undefined) payload.DisplayName = updates.displayName;
    if (updates.companyName !== undefined) payload.CompanyName = updates.companyName;
    if (updates.givenName !== undefined) payload.GivenName = updates.givenName;
    if (updates.familyName !== undefined) payload.FamilyName = updates.familyName;
    if (updates.email !== undefined) payload.PrimaryEmailAddr = { Address: updates.email };
    if (updates.phone !== undefined) payload.PrimaryPhone = { FreeFormNumber: updates.phone };
    if (updates.billingAddress) payload.BillAddr = buildAddress(updates.billingAddress);
    if (updates.shippingAddress) payload.ShipAddr = buildAddress(updates.shippingAddress);
    if (updates.notes !== undefined) payload.Notes = updates.notes;
    if (updates.active !== undefined) payload.Active = updates.active;

    const raw = await this.update("Customer", payload);
    return this.mapCustomer(raw as QBORawEntity);
  }

  private mapCustomer = (raw: QBORawEntity): QBOCustomer => ({
    id: String(raw.Id ?? ""),
    syncToken: String(raw.SyncToken ?? "0"),
    displayName: String(raw.DisplayName ?? ""),
    companyName: raw.CompanyName ? String(raw.CompanyName) : undefined,
    givenName: raw.GivenName ? String(raw.GivenName) : undefined,
    familyName: raw.FamilyName ? String(raw.FamilyName) : undefined,
    email: (raw.PrimaryEmailAddr as Record<string, unknown>)?.Address as string | undefined,
    phone: (raw.PrimaryPhone as Record<string, unknown>)?.FreeFormNumber as string | undefined,
    mobile: (raw.Mobile as Record<string, unknown>)?.FreeFormNumber as string | undefined,
    fax: (raw.Fax as Record<string, unknown>)?.FreeFormNumber as string | undefined,
    website: (raw.WebAddr as Record<string, unknown>)?.URI as string | undefined,
    billingAddress: parseAddress(raw.BillAddr as Record<string, unknown> | undefined),
    shippingAddress: parseAddress(raw.ShipAddr as Record<string, unknown> | undefined),
    balance: raw.Balance != null ? Number(raw.Balance) : undefined,
    currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
    taxExempt: raw.Taxable === false,
    active: raw.Active !== false,
    notes: raw.Notes ? String(raw.Notes) : undefined,
    lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
  });

  // ═══════════════════════════════════════════════════════════════
  // VENDORS (SUPPLIERS)
  // ═══════════════════════════════════════════════════════════════

  async getVendors(options: { limit?: number; offset?: number; active?: boolean; updatedAfter?: Date } = {}): Promise<QBOPagedResult<QBOVendor>> {
    const conditions: string[] = [];
    if (options.active !== undefined) conditions.push(`Active = ${options.active}`);
    if (options.updatedAfter) conditions.push(`MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("Vendor", where, "MetaData.LastUpdatedTime DESC", options.offset ?? 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapVendor) };
  }

  async getAllVendors(updatedAfter?: Date): Promise<QBOVendor[]> {
    const where = updatedAfter ? `MetaData.LastUpdatedTime >= '${updatedAfter.toISOString()}'` : undefined;
    const raw = await this.queryAll("Vendor", where);
    return raw.map(this.mapVendor);
  }

  async getVendor(id: string): Promise<QBOVendor> {
    const raw = await this.read("Vendor", id);
    return this.mapVendor(raw as QBORawEntity);
  }

  async createVendor(vendor: Partial<QBOVendor>): Promise<QBOVendor> {
    const payload: Record<string, unknown> = {
      DisplayName: vendor.displayName,
      CompanyName: vendor.companyName,
      GivenName: vendor.givenName,
      FamilyName: vendor.familyName,
      PrimaryEmailAddr: vendor.email ? { Address: vendor.email } : undefined,
      PrimaryPhone: vendor.phone ? { FreeFormNumber: vendor.phone } : undefined,
      Mobile: vendor.mobile ? { FreeFormNumber: vendor.mobile } : undefined,
      Fax: vendor.fax ? { FreeFormNumber: vendor.fax } : undefined,
      WebAddr: vendor.website ? { URI: vendor.website } : undefined,
      BillAddr: buildAddress(vendor.billingAddress),
      TaxIdentifier: vendor.taxId,
    };

    if (vendor.currencyCode) payload.CurrencyRef = { value: vendor.currencyCode };

    const raw = await this.create("Vendor", payload);
    return this.mapVendor(raw as QBORawEntity);
  }

  async updateVendor(id: string, syncToken: string, updates: Partial<QBOVendor>): Promise<QBOVendor> {
    const payload: Record<string, unknown> = { Id: id, SyncToken: syncToken };

    if (updates.displayName !== undefined) payload.DisplayName = updates.displayName;
    if (updates.companyName !== undefined) payload.CompanyName = updates.companyName;
    if (updates.email !== undefined) payload.PrimaryEmailAddr = { Address: updates.email };
    if (updates.phone !== undefined) payload.PrimaryPhone = { FreeFormNumber: updates.phone };
    if (updates.billingAddress) payload.BillAddr = buildAddress(updates.billingAddress);
    if (updates.active !== undefined) payload.Active = updates.active;
    if (updates.taxId !== undefined) payload.TaxIdentifier = updates.taxId;

    const raw = await this.update("Vendor", payload);
    return this.mapVendor(raw as QBORawEntity);
  }

  private mapVendor = (raw: QBORawEntity): QBOVendor => ({
    id: String(raw.Id ?? ""),
    syncToken: String(raw.SyncToken ?? "0"),
    displayName: String(raw.DisplayName ?? ""),
    companyName: raw.CompanyName ? String(raw.CompanyName) : undefined,
    givenName: raw.GivenName ? String(raw.GivenName) : undefined,
    familyName: raw.FamilyName ? String(raw.FamilyName) : undefined,
    email: (raw.PrimaryEmailAddr as Record<string, unknown>)?.Address as string | undefined,
    phone: (raw.PrimaryPhone as Record<string, unknown>)?.FreeFormNumber as string | undefined,
    mobile: (raw.Mobile as Record<string, unknown>)?.FreeFormNumber as string | undefined,
    fax: (raw.Fax as Record<string, unknown>)?.FreeFormNumber as string | undefined,
    website: (raw.WebAddr as Record<string, unknown>)?.URI as string | undefined,
    billingAddress: parseAddress(raw.BillAddr as Record<string, unknown> | undefined),
    balance: raw.Balance != null ? Number(raw.Balance) : undefined,
    currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
    taxId: raw.TaxIdentifier ? String(raw.TaxIdentifier) : undefined,
    active: raw.Active !== false,
    lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
  });

  // ═══════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════

  async getInvoices(options: { limit?: number; offset?: number; updatedAfter?: Date; customerId?: string } = {}): Promise<QBOPagedResult<QBOInvoice>> {
    const conditions: string[] = [];
    if (options.updatedAfter) conditions.push(`MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`);
    if (options.customerId) conditions.push(`CustomerRef = '${options.customerId}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("Invoice", where, "MetaData.LastUpdatedTime DESC", options.offset ?? 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapInvoice) };
  }

  async getAllInvoices(updatedAfter?: Date): Promise<QBOInvoice[]> {
    const where = updatedAfter ? `MetaData.LastUpdatedTime >= '${updatedAfter.toISOString()}'` : undefined;
    const raw = await this.queryAll("Invoice", where);
    return raw.map(this.mapInvoice);
  }

  async getInvoice(id: string): Promise<QBOInvoice> {
    const raw = await this.read("Invoice", id);
    return this.mapInvoice(raw as QBORawEntity);
  }

  async createInvoice(invoice: Partial<QBOInvoice>): Promise<QBOInvoice> {
    const payload: Record<string, unknown> = {
      CustomerRef: { value: invoice.customerId },
      TxnDate: invoice.txnDate,
      DueDate: invoice.dueDate,
      DocNumber: invoice.docNumber,
      CustomerMemo: invoice.memo ? { value: invoice.memo } : undefined,
      BillAddr: buildAddress(invoice.billingAddress),
      ShipAddr: buildAddress(invoice.shippingAddress),
      Line: invoice.lineItems?.map((line) => ({
        Amount: line.amount,
        Description: line.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: line.itemId ? { value: line.itemId } : undefined,
          UnitPrice: line.unitPrice,
          Qty: line.quantity,
          TaxCodeRef: line.taxCodeId ? { value: line.taxCodeId } : undefined,
          ServiceDate: line.serviceDate,
        },
      })),
    };

    if (invoice.currencyCode) payload.CurrencyRef = { value: invoice.currencyCode };

    const raw = await this.create("Invoice", payload);
    return this.mapInvoice(raw as QBORawEntity);
  }

  async updateInvoice(id: string, syncToken: string, updates: Partial<QBOInvoice>): Promise<QBOInvoice> {
    const payload: Record<string, unknown> = { Id: id, SyncToken: syncToken };

    if (updates.dueDate !== undefined) payload.DueDate = updates.dueDate;
    if (updates.memo !== undefined) payload.CustomerMemo = { value: updates.memo };
    if (updates.billingAddress) payload.BillAddr = buildAddress(updates.billingAddress);
    if (updates.shippingAddress) payload.ShipAddr = buildAddress(updates.shippingAddress);
    if (updates.lineItems) {
      payload.Line = updates.lineItems.map((line) => ({
        Id: line.id !== "new" ? line.id : undefined,
        Amount: line.amount,
        Description: line.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: line.itemId ? { value: line.itemId } : undefined,
          UnitPrice: line.unitPrice,
          Qty: line.quantity,
          TaxCodeRef: line.taxCodeId ? { value: line.taxCodeId } : undefined,
        },
      }));
    }

    const raw = await this.update("Invoice", payload);
    return this.mapInvoice(raw as QBORawEntity);
  }

  async voidInvoice(id: string, syncToken: string): Promise<void> {
    await this.voidEntity("Invoice", id, syncToken);
  }

  async sendInvoiceEmail(id: string, email?: string): Promise<void> {
    await this.sendEmail("Invoice", id, email);
  }

  async getInvoicePdf(id: string): Promise<ArrayBuffer> {
    return this.getPdf("Invoice", id);
  }

  private mapInvoice = (raw: QBORawEntity): QBOInvoice => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];

    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      docNumber: String(raw.DocNumber ?? ""),
      customerId: String((raw.CustomerRef as Record<string, unknown>)?.value ?? ""),
      customerName: (raw.CustomerRef as Record<string, unknown>)?.name as string | undefined,
      txnDate: String(raw.TxnDate ?? ""),
      dueDate: raw.DueDate ? String(raw.DueDate) : undefined,
      totalAmount: Number(raw.TotalAmt ?? 0),
      balance: Number(raw.Balance ?? 0),
      currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
      status: this.mapInvoiceStatus(raw),
      emailStatus: raw.EmailStatus ? String(raw.EmailStatus) : undefined,
      billingAddress: parseAddress(raw.BillAddr as Record<string, unknown> | undefined),
      shippingAddress: parseAddress(raw.ShipAddr as Record<string, unknown> | undefined),
      lineItems: lines
        .filter((l) => l.DetailType === "SalesItemLineDetail")
        .map((l) => this.mapInvoiceLine(l)),
      taxAmount: raw.TxnTaxDetail ? Number((raw.TxnTaxDetail as Record<string, unknown>).TotalTax ?? 0) : undefined,
      depositAmount: raw.Deposit != null ? Number(raw.Deposit) : undefined,
      memo: (raw.CustomerMemo as Record<string, unknown>)?.value as string | undefined,
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  private mapInvoiceStatus(raw: QBORawEntity): QBOInvoice["status"] {
    if (raw.VoidedDate) return "VOIDED";
    const balance = Number(raw.Balance ?? 0);
    const total = Number(raw.TotalAmt ?? 0);
    if (balance === 0 && total > 0) return "PAID";
    if (raw.DueDate && new Date(String(raw.DueDate)) < new Date()) return "OVERDUE";
    if (raw.EmailStatus === "EmailSent") return "SENT";
    return "DRAFT";
  }

  private mapInvoiceLine = (raw: QBORawEntity): QBOInvoiceLine => {
    const detail = raw.SalesItemLineDetail as Record<string, unknown> | undefined;
    return {
      id: String(raw.Id ?? ""),
      lineNum: raw.LineNum ? Number(raw.LineNum) : undefined,
      description: raw.Description ? String(raw.Description) : undefined,
      amount: Number(raw.Amount ?? 0),
      quantity: detail?.Qty != null ? Number(detail.Qty) : undefined,
      unitPrice: detail?.UnitPrice != null ? Number(detail.UnitPrice) : undefined,
      itemId: (detail?.ItemRef as Record<string, unknown>)?.value as string | undefined,
      itemName: (detail?.ItemRef as Record<string, unknown>)?.name as string | undefined,
      taxCodeId: (detail?.TaxCodeRef as Record<string, unknown>)?.value as string | undefined,
      serviceDate: detail?.ServiceDate ? String(detail.ServiceDate) : undefined,
    };
  };

  // ═══════════════════════════════════════════════════════════════
  // BILLS
  // ═══════════════════════════════════════════════════════════════

  async getBills(options: { limit?: number; offset?: number; updatedAfter?: Date; vendorId?: string } = {}): Promise<QBOPagedResult<QBOBill>> {
    const conditions: string[] = [];
    if (options.updatedAfter) conditions.push(`MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`);
    if (options.vendorId) conditions.push(`VendorRef = '${options.vendorId}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("Bill", where, "MetaData.LastUpdatedTime DESC", options.offset ?? 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapBill) };
  }

  async getAllBills(updatedAfter?: Date): Promise<QBOBill[]> {
    const where = updatedAfter ? `MetaData.LastUpdatedTime >= '${updatedAfter.toISOString()}'` : undefined;
    const raw = await this.queryAll("Bill", where);
    return raw.map(this.mapBill);
  }

  async createBill(bill: Partial<QBOBill>): Promise<QBOBill> {
    const payload: Record<string, unknown> = {
      VendorRef: { value: bill.vendorId },
      TxnDate: bill.txnDate,
      DueDate: bill.dueDate,
      DocNumber: bill.docNumber,
      PrivateNote: bill.memo,
      Line: bill.lineItems?.map((line) => ({
        Amount: line.amount,
        Description: line.description,
        DetailType: line.itemId ? "ItemBasedExpenseLineDetail" : "AccountBasedExpenseLineDetail",
        ...(line.itemId
          ? {
              ItemBasedExpenseLineDetail: {
                ItemRef: { value: line.itemId },
                UnitPrice: line.unitPrice,
                Qty: line.quantity,
                TaxCodeRef: line.taxCodeId ? { value: line.taxCodeId } : undefined,
                CustomerRef: line.customerId ? { value: line.customerId } : undefined,
              },
            }
          : {
              AccountBasedExpenseLineDetail: {
                AccountRef: { value: line.accountId },
                TaxCodeRef: line.taxCodeId ? { value: line.taxCodeId } : undefined,
                CustomerRef: line.customerId ? { value: line.customerId } : undefined,
              },
            }),
      })),
    };

    if (bill.currencyCode) payload.CurrencyRef = { value: bill.currencyCode };

    const raw = await this.create("Bill", payload);
    return this.mapBill(raw as QBORawEntity);
  }

  async updateBill(id: string, syncToken: string, updates: Partial<QBOBill>): Promise<QBOBill> {
    const payload: Record<string, unknown> = { Id: id, SyncToken: syncToken };

    if (updates.dueDate !== undefined) payload.DueDate = updates.dueDate;
    if (updates.memo !== undefined) payload.PrivateNote = updates.memo;

    const raw = await this.update("Bill", payload);
    return this.mapBill(raw as QBORawEntity);
  }

  async deleteBill(id: string, syncToken: string): Promise<void> {
    await this.deleteEntity("Bill", id, syncToken);
  }

  private mapBill = (raw: QBORawEntity): QBOBill => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];

    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      docNumber: raw.DocNumber ? String(raw.DocNumber) : undefined,
      vendorId: String((raw.VendorRef as Record<string, unknown>)?.value ?? ""),
      vendorName: (raw.VendorRef as Record<string, unknown>)?.name as string | undefined,
      txnDate: String(raw.TxnDate ?? ""),
      dueDate: raw.DueDate ? String(raw.DueDate) : undefined,
      totalAmount: Number(raw.TotalAmt ?? 0),
      balance: Number(raw.Balance ?? 0),
      currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
      lineItems: lines.filter((l) => l.DetailType !== "SubTotalLineDetail").map(this.mapBillLine),
      memo: raw.PrivateNote ? String(raw.PrivateNote) : undefined,
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  private mapBillLine = (raw: QBORawEntity): QBOBillLine => {
    const itemDetail = raw.ItemBasedExpenseLineDetail as Record<string, unknown> | undefined;
    const accountDetail = raw.AccountBasedExpenseLineDetail as Record<string, unknown> | undefined;

    return {
      id: String(raw.Id ?? ""),
      lineNum: raw.LineNum ? Number(raw.LineNum) : undefined,
      description: raw.Description ? String(raw.Description) : undefined,
      amount: Number(raw.Amount ?? 0),
      quantity: itemDetail?.Qty != null ? Number(itemDetail.Qty) : undefined,
      unitPrice: itemDetail?.UnitPrice != null ? Number(itemDetail.UnitPrice) : undefined,
      itemId: (itemDetail?.ItemRef as Record<string, unknown>)?.value as string | undefined,
      accountId: (accountDetail?.AccountRef as Record<string, unknown>)?.value as string | undefined,
      customerId: ((itemDetail ?? accountDetail) as Record<string, unknown> | undefined)?.CustomerRef
        ? String(((itemDetail ?? accountDetail) as Record<string, Record<string, unknown>>).CustomerRef?.value ?? "")
        : undefined,
      taxCodeId: ((itemDetail ?? accountDetail) as Record<string, unknown> | undefined)?.TaxCodeRef
        ? String(((itemDetail ?? accountDetail) as Record<string, Record<string, unknown>>).TaxCodeRef?.value ?? "")
        : undefined,
    };
  };

  // ═══════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════

  async getPayments(options: { limit?: number; offset?: number; updatedAfter?: Date; customerId?: string } = {}): Promise<QBOPagedResult<QBOPayment>> {
    const conditions: string[] = [];
    if (options.updatedAfter) conditions.push(`MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`);
    if (options.customerId) conditions.push(`CustomerRef = '${options.customerId}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("Payment", where, "MetaData.LastUpdatedTime DESC", options.offset ?? 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapPayment) };
  }

  async getAllPayments(updatedAfter?: Date): Promise<QBOPayment[]> {
    const where = updatedAfter ? `MetaData.LastUpdatedTime >= '${updatedAfter.toISOString()}'` : undefined;
    const raw = await this.queryAll("Payment", where);
    return raw.map(this.mapPayment);
  }

  async createPayment(payment: Partial<QBOPayment>): Promise<QBOPayment> {
    const payload: Record<string, unknown> = {
      CustomerRef: { value: payment.customerId },
      TotalAmt: payment.totalAmount,
      TxnDate: payment.txnDate,
      PrivateNote: payment.memo,
      PaymentMethodRef: payment.paymentMethodId ? { value: payment.paymentMethodId } : undefined,
      DepositToAccountRef: payment.depositToAccountId ? { value: payment.depositToAccountId } : undefined,
      Line: payment.invoiceRefs?.map((ref) => ({
        Amount: ref.amount,
        LinkedTxn: [{ TxnId: ref.invoiceId, TxnType: "Invoice" }],
      })),
    };

    if (payment.currencyCode) payload.CurrencyRef = { value: payment.currencyCode };

    const raw = await this.create("Payment", payload);
    return this.mapPayment(raw as QBORawEntity);
  }

  async voidPayment(id: string, syncToken: string): Promise<void> {
    await this.voidEntity("Payment", id, syncToken);
  }

  private mapPayment = (raw: QBORawEntity): QBOPayment => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];

    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      txnDate: String(raw.TxnDate ?? ""),
      totalAmount: Number(raw.TotalAmt ?? 0),
      customerId: String((raw.CustomerRef as Record<string, unknown>)?.value ?? ""),
      customerName: (raw.CustomerRef as Record<string, unknown>)?.name as string | undefined,
      paymentMethodId: (raw.PaymentMethodRef as Record<string, unknown>)?.value as string | undefined,
      depositToAccountId: (raw.DepositToAccountRef as Record<string, unknown>)?.value as string | undefined,
      currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
      memo: raw.PrivateNote ? String(raw.PrivateNote) : undefined,
      invoiceRefs: lines
        .filter((l) => Array.isArray(l.LinkedTxn))
        .map((l) => ({
          invoiceId: String(((l.LinkedTxn as QBORawEntity[])?.[0] as Record<string, unknown>)?.TxnId ?? ""),
          amount: Number(l.Amount ?? 0),
        })),
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  // ═══════════════════════════════════════════════════════════════
  // ACCOUNTS (Chart of Accounts)
  // ═══════════════════════════════════════════════════════════════

  async getAccounts(options: { limit?: number; active?: boolean; accountType?: string } = {}): Promise<QBOPagedResult<QBOAccount>> {
    const conditions: string[] = [];
    if (options.active !== undefined) conditions.push(`Active = ${options.active}`);
    if (options.accountType) conditions.push(`AccountType = '${options.accountType}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("Account", where, "Name ASC", 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapAccount) };
  }

  async getAllAccounts(): Promise<QBOAccount[]> {
    const raw = await this.queryAll("Account");
    return raw.map(this.mapAccount);
  }

  async createAccount(account: Partial<QBOAccount>): Promise<QBOAccount> {
    const payload: Record<string, unknown> = {
      Name: account.name,
      AccountType: account.accountType,
      AccountSubType: account.accountSubType,
      Description: account.description,
    };

    if (account.currencyCode) payload.CurrencyRef = { value: account.currencyCode };

    const raw = await this.create("Account", payload);
    return this.mapAccount(raw as QBORawEntity);
  }

  private mapAccount = (raw: QBORawEntity): QBOAccount => ({
    id: String(raw.Id ?? ""),
    syncToken: String(raw.SyncToken ?? "0"),
    name: String(raw.Name ?? ""),
    fullyQualifiedName: raw.FullyQualifiedName ? String(raw.FullyQualifiedName) : undefined,
    accountType: String(raw.AccountType ?? ""),
    accountSubType: raw.AccountSubType ? String(raw.AccountSubType) : undefined,
    classification: raw.Classification ? String(raw.Classification) : undefined,
    currentBalance: raw.CurrentBalance != null ? Number(raw.CurrentBalance) : undefined,
    currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
    active: raw.Active !== false,
    description: raw.Description ? String(raw.Description) : undefined,
    lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
  });

  // ═══════════════════════════════════════════════════════════════
  // TAX CODES & TAX RATES
  // ═══════════════════════════════════════════════════════════════

  async getTaxCodes(): Promise<QBOTaxCode[]> {
    const raw = await this.queryAll("TaxCode");
    return raw.map(this.mapTaxCode);
  }

  async getTaxRates(): Promise<QBOTaxRate[]> {
    const raw = await this.queryAll("TaxRate");
    return raw.map(this.mapTaxRate);
  }

  private mapTaxCode = (raw: QBORawEntity): QBOTaxCode => ({
    id: String(raw.Id ?? ""),
    syncToken: String(raw.SyncToken ?? "0"),
    name: String(raw.Name ?? ""),
    description: raw.Description ? String(raw.Description) : undefined,
    active: raw.Active !== false,
    taxable: raw.Taxable !== false,
    taxGroup: raw.TaxGroup === true,
    purchaseTaxRateId: (raw.PurchaseTaxRateList as Record<string, unknown>)?.TaxRateDetail
      ? String((((raw.PurchaseTaxRateList as Record<string, unknown>).TaxRateDetail as Array<Record<string, Record<string, unknown>>>)?.[0]?.TaxRateRef?.value ?? ""))
      : undefined,
    salesTaxRateId: (raw.SalesTaxRateList as Record<string, unknown>)?.TaxRateDetail
      ? String((((raw.SalesTaxRateList as Record<string, unknown>).TaxRateDetail as Array<Record<string, Record<string, unknown>>>)?.[0]?.TaxRateRef?.value ?? ""))
      : undefined,
  });

  private mapTaxRate = (raw: QBORawEntity): QBOTaxRate => ({
    id: String(raw.Id ?? ""),
    syncToken: String(raw.SyncToken ?? "0"),
    name: String(raw.Name ?? ""),
    description: raw.Description ? String(raw.Description) : undefined,
    rateValue: Number(raw.RateValue ?? 0),
    agencyRef: (raw.AgencyRef as Record<string, unknown>)?.value as string | undefined,
    active: raw.Active !== false,
  });

  // ═══════════════════════════════════════════════════════════════
  // ESTIMATES
  // ═══════════════════════════════════════════════════════════════

  async getEstimates(options: { limit?: number; updatedAfter?: Date; customerId?: string } = {}): Promise<QBOPagedResult<QBOEstimate>> {
    const conditions: string[] = [];
    if (options.updatedAfter) conditions.push(`MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`);
    if (options.customerId) conditions.push(`CustomerRef = '${options.customerId}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("Estimate", where, "MetaData.LastUpdatedTime DESC", 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapEstimate) };
  }

  async createEstimate(estimate: Partial<QBOEstimate>): Promise<QBOEstimate> {
    const payload: Record<string, unknown> = {
      CustomerRef: { value: estimate.customerId },
      TxnDate: estimate.txnDate,
      ExpirationDate: estimate.expirationDate,
      DocNumber: estimate.docNumber,
      CustomerMemo: estimate.memo ? { value: estimate.memo } : undefined,
      Line: estimate.lineItems?.map((line) => ({
        Amount: line.amount,
        Description: line.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: line.itemId ? { value: line.itemId } : undefined,
          UnitPrice: line.unitPrice,
          Qty: line.quantity,
        },
      })),
    };

    const raw = await this.create("Estimate", payload);
    return this.mapEstimate(raw as QBORawEntity);
  }

  async sendEstimateEmail(id: string, email?: string): Promise<void> {
    await this.sendEmail("Estimate", id, email);
  }

  private mapEstimate = (raw: QBORawEntity): QBOEstimate => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];
    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      docNumber: String(raw.DocNumber ?? ""),
      customerId: String((raw.CustomerRef as Record<string, unknown>)?.value ?? ""),
      customerName: (raw.CustomerRef as Record<string, unknown>)?.name as string | undefined,
      txnDate: String(raw.TxnDate ?? ""),
      expirationDate: raw.ExpirationDate ? String(raw.ExpirationDate) : undefined,
      totalAmount: Number(raw.TotalAmt ?? 0),
      status: this.mapEstimateStatus(raw),
      lineItems: lines
        .filter((l) => l.DetailType === "SalesItemLineDetail")
        .map(this.mapInvoiceLine),
      memo: (raw.CustomerMemo as Record<string, unknown>)?.value as string | undefined,
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  private mapEstimateStatus(raw: QBORawEntity): QBOEstimate["status"] {
    const status = String(raw.TxnStatus ?? "Pending");
    if (status === "Accepted") return "ACCEPTED";
    if (status === "Closed") return "CLOSED";
    if (status === "Rejected") return "REJECTED";
    return "PENDING";
  }

  // ═══════════════════════════════════════════════════════════════
  // SALES RECEIPTS
  // ═══════════════════════════════════════════════════════════════

  async getSalesReceipts(options: { limit?: number; updatedAfter?: Date } = {}): Promise<QBOPagedResult<QBOSalesReceipt>> {
    const where = options.updatedAfter
      ? `MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`
      : undefined;

    const result = await this.query<QBORawEntity>("SalesReceipt", where, "MetaData.LastUpdatedTime DESC", 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapSalesReceipt) };
  }

  async createSalesReceipt(receipt: Partial<QBOSalesReceipt>): Promise<QBOSalesReceipt> {
    const payload: Record<string, unknown> = {
      CustomerRef: receipt.customerId ? { value: receipt.customerId } : undefined,
      TxnDate: receipt.txnDate,
      DocNumber: receipt.docNumber,
      PrivateNote: receipt.memo,
      PaymentMethodRef: receipt.paymentMethodId ? { value: receipt.paymentMethodId } : undefined,
      DepositToAccountRef: receipt.depositToAccountId ? { value: receipt.depositToAccountId } : undefined,
      Line: receipt.lineItems?.map((line) => ({
        Amount: line.amount,
        Description: line.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: line.itemId ? { value: line.itemId } : undefined,
          UnitPrice: line.unitPrice,
          Qty: line.quantity,
        },
      })),
    };

    const raw = await this.create("SalesReceipt", payload);
    return this.mapSalesReceipt(raw as QBORawEntity);
  }

  private mapSalesReceipt = (raw: QBORawEntity): QBOSalesReceipt => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];
    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      docNumber: String(raw.DocNumber ?? ""),
      customerId: (raw.CustomerRef as Record<string, unknown>)?.value as string | undefined,
      customerName: (raw.CustomerRef as Record<string, unknown>)?.name as string | undefined,
      txnDate: String(raw.TxnDate ?? ""),
      totalAmount: Number(raw.TotalAmt ?? 0),
      currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
      paymentMethodId: (raw.PaymentMethodRef as Record<string, unknown>)?.value as string | undefined,
      depositToAccountId: (raw.DepositToAccountRef as Record<string, unknown>)?.value as string | undefined,
      lineItems: lines
        .filter((l) => l.DetailType === "SalesItemLineDetail")
        .map(this.mapInvoiceLine),
      memo: raw.PrivateNote ? String(raw.PrivateNote) : undefined,
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  // ═══════════════════════════════════════════════════════════════
  // CREDIT MEMOS
  // ═══════════════════════════════════════════════════════════════

  async getCreditMemos(options: { limit?: number; updatedAfter?: Date } = {}): Promise<QBOPagedResult<QBOCreditMemo>> {
    const where = options.updatedAfter
      ? `MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`
      : undefined;

    const result = await this.query<QBORawEntity>("CreditMemo", where, "MetaData.LastUpdatedTime DESC", 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapCreditMemo) };
  }

  async createCreditMemo(memo: Partial<QBOCreditMemo>): Promise<QBOCreditMemo> {
    const payload: Record<string, unknown> = {
      CustomerRef: { value: memo.customerId },
      TxnDate: memo.txnDate,
      DocNumber: memo.docNumber,
      PrivateNote: memo.memo,
      Line: memo.lineItems?.map((line) => ({
        Amount: line.amount,
        Description: line.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: line.itemId ? { value: line.itemId } : undefined,
          UnitPrice: line.unitPrice,
          Qty: line.quantity,
        },
      })),
    };

    const raw = await this.create("CreditMemo", payload);
    return this.mapCreditMemo(raw as QBORawEntity);
  }

  private mapCreditMemo = (raw: QBORawEntity): QBOCreditMemo => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];
    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      docNumber: String(raw.DocNumber ?? ""),
      customerId: String((raw.CustomerRef as Record<string, unknown>)?.value ?? ""),
      customerName: (raw.CustomerRef as Record<string, unknown>)?.name as string | undefined,
      txnDate: String(raw.TxnDate ?? ""),
      totalAmount: Number(raw.TotalAmt ?? 0),
      balance: Number(raw.Balance ?? 0),
      currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
      lineItems: lines
        .filter((l) => l.DetailType === "SalesItemLineDetail")
        .map(this.mapInvoiceLine),
      memo: raw.PrivateNote ? String(raw.PrivateNote) : undefined,
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  // ═══════════════════════════════════════════════════════════════
  // JOURNAL ENTRIES
  // ═══════════════════════════════════════════════════════════════

  async getJournalEntries(options: { limit?: number; updatedAfter?: Date } = {}): Promise<QBOPagedResult<QBOJournalEntry>> {
    const where = options.updatedAfter
      ? `MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`
      : undefined;

    const result = await this.query<QBORawEntity>("JournalEntry", where, "MetaData.LastUpdatedTime DESC", 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapJournalEntry) };
  }

  async createJournalEntry(entry: Partial<QBOJournalEntry>): Promise<QBOJournalEntry> {
    const payload: Record<string, unknown> = {
      TxnDate: entry.txnDate,
      DocNumber: entry.docNumber,
      Adjustment: entry.adjustment ?? false,
      PrivateNote: entry.memo,
      Line: entry.lines?.map((line) => ({
        Description: line.description,
        Amount: line.amount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: line.postingType === "DEBIT" ? "Debit" : "Credit",
          AccountRef: { value: line.accountId },
          ClassRef: line.classId ? { value: line.classId } : undefined,
          DepartmentRef: line.departmentId ? { value: line.departmentId } : undefined,
        },
      })),
    };

    const raw = await this.create("JournalEntry", payload);
    return this.mapJournalEntry(raw as QBORawEntity);
  }

  async deleteJournalEntry(id: string, syncToken: string): Promise<void> {
    await this.deleteEntity("JournalEntry", id, syncToken);
  }

  private mapJournalEntry = (raw: QBORawEntity): QBOJournalEntry => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];

    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      docNumber: raw.DocNumber ? String(raw.DocNumber) : undefined,
      txnDate: String(raw.TxnDate ?? ""),
      totalAmount: Number(raw.TotalAmt ?? 0),
      adjustment: raw.Adjustment === true,
      lines: lines.map((l) => {
        const detail = l.JournalEntryLineDetail as Record<string, unknown> | undefined;
        return {
          id: String(l.Id ?? ""),
          description: l.Description ? String(l.Description) : undefined,
          amount: Number(l.Amount ?? 0),
          postingType: (detail?.PostingType === "Debit" ? "DEBIT" : "CREDIT") as "DEBIT" | "CREDIT",
          accountId: String((detail?.AccountRef as Record<string, unknown>)?.value ?? ""),
          accountName: (detail?.AccountRef as Record<string, unknown>)?.name as string | undefined,
          classId: (detail?.ClassRef as Record<string, unknown>)?.value as string | undefined,
          departmentId: (detail?.DepartmentRef as Record<string, unknown>)?.value as string | undefined,
        };
      }),
      memo: raw.PrivateNote ? String(raw.PrivateNote) : undefined,
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  // ═══════════════════════════════════════════════════════════════
  // DEPOSITS
  // ═══════════════════════════════════════════════════════════════

  async getDeposits(options: { limit?: number; updatedAfter?: Date } = {}): Promise<QBOPagedResult<QBODeposit>> {
    const where = options.updatedAfter
      ? `MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`
      : undefined;

    const result = await this.query<QBORawEntity>("Deposit", where, "MetaData.LastUpdatedTime DESC", 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapDeposit) };
  }

  async createDeposit(deposit: Partial<QBODeposit>): Promise<QBODeposit> {
    const payload: Record<string, unknown> = {
      DepositToAccountRef: { value: deposit.depositToAccountId },
      TxnDate: deposit.txnDate,
      PrivateNote: deposit.memo,
      Line: deposit.lines?.map((line) => ({
        Amount: line.amount,
        DetailType: "DepositLineDetail",
        DepositLineDetail: {
          AccountRef: line.accountId ? { value: line.accountId } : undefined,
          PaymentMethodRef: line.paymentMethodId ? { value: line.paymentMethodId } : undefined,
          Entity: line.entityId ? { value: line.entityId, type: line.entityType } : undefined,
        },
      })),
    };

    if (deposit.currencyCode) payload.CurrencyRef = { value: deposit.currencyCode };

    const raw = await this.create("Deposit", payload);
    return this.mapDeposit(raw as QBORawEntity);
  }

  private mapDeposit = (raw: QBORawEntity): QBODeposit => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];

    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      txnDate: String(raw.TxnDate ?? ""),
      totalAmount: Number(raw.TotalAmt ?? 0),
      depositToAccountId: String((raw.DepositToAccountRef as Record<string, unknown>)?.value ?? ""),
      currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
      lines: lines.map((l) => {
        const detail = l.DepositLineDetail as Record<string, unknown> | undefined;
        return {
          amount: Number(l.Amount ?? 0),
          accountId: (detail?.AccountRef as Record<string, unknown>)?.value as string | undefined,
          paymentMethodId: (detail?.PaymentMethodRef as Record<string, unknown>)?.value as string | undefined,
          description: l.Description ? String(l.Description) : undefined,
          entityId: (detail?.Entity as Record<string, unknown>)?.value as string | undefined,
          entityType: (detail?.Entity as Record<string, unknown>)?.type as string | undefined,
        };
      }),
      memo: raw.PrivateNote ? String(raw.PrivateNote) : undefined,
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  // ═══════════════════════════════════════════════════════════════
  // PURCHASE ORDERS
  // ═══════════════════════════════════════════════════════════════

  async getPurchaseOrders(options: { limit?: number; updatedAfter?: Date; vendorId?: string } = {}): Promise<QBOPagedResult<QBOPurchaseOrder>> {
    const conditions: string[] = [];
    if (options.updatedAfter) conditions.push(`MetaData.LastUpdatedTime >= '${options.updatedAfter.toISOString()}'`);
    if (options.vendorId) conditions.push(`VendorRef = '${options.vendorId}'`);

    const where = conditions.length > 0 ? conditions.join(" AND ") : undefined;
    const result = await this.query<QBORawEntity>("PurchaseOrder", where, "MetaData.LastUpdatedTime DESC", 1, options.limit ?? 1000);

    return { ...result, items: result.items.map(this.mapPurchaseOrder) };
  }

  async getAllPurchaseOrders(updatedAfter?: Date): Promise<QBOPurchaseOrder[]> {
    const where = updatedAfter ? `MetaData.LastUpdatedTime >= '${updatedAfter.toISOString()}'` : undefined;
    const raw = await this.queryAll("PurchaseOrder", where);
    return raw.map(this.mapPurchaseOrder);
  }

  async createPurchaseOrder(po: Partial<QBOPurchaseOrder>): Promise<QBOPurchaseOrder> {
    const payload: Record<string, unknown> = {
      VendorRef: { value: po.vendorId },
      TxnDate: po.txnDate,
      DocNumber: po.docNumber,
      PrivateNote: po.memo,
      Line: po.lineItems?.map((line) => ({
        Amount: line.amount,
        Description: line.description,
        DetailType: "ItemBasedExpenseLineDetail",
        ItemBasedExpenseLineDetail: {
          ItemRef: line.itemId ? { value: line.itemId } : undefined,
          UnitPrice: line.unitPrice,
          Qty: line.quantity,
        },
      })),
    };

    if (po.currencyCode) payload.CurrencyRef = { value: po.currencyCode };

    const raw = await this.create("PurchaseOrder", payload);
    return this.mapPurchaseOrder(raw as QBORawEntity);
  }

  async deletePurchaseOrder(id: string, syncToken: string): Promise<void> {
    await this.deleteEntity("PurchaseOrder", id, syncToken);
  }

  private mapPurchaseOrder = (raw: QBORawEntity): QBOPurchaseOrder => {
    const lines = Array.isArray(raw.Line) ? (raw.Line as QBORawEntity[]) : [];

    return {
      id: String(raw.Id ?? ""),
      syncToken: String(raw.SyncToken ?? "0"),
      docNumber: String(raw.DocNumber ?? ""),
      vendorId: String((raw.VendorRef as Record<string, unknown>)?.value ?? ""),
      vendorName: (raw.VendorRef as Record<string, unknown>)?.name as string | undefined,
      txnDate: raw.TxnDate ? String(raw.TxnDate) : undefined,
      totalAmount: Number(raw.TotalAmt ?? 0),
      dueDate: raw.DueDate ? String(raw.DueDate) : undefined,
      status: this.mapPOStatus(raw),
      currencyCode: (raw.CurrencyRef as Record<string, unknown>)?.value as string | undefined,
      lineItems: lines
        .filter((l) => l.DetailType === "ItemBasedExpenseLineDetail")
        .map((l) => {
          const detail = l.ItemBasedExpenseLineDetail as Record<string, unknown> | undefined;
          return {
            id: String(l.Id ?? ""),
            itemId: (detail?.ItemRef as Record<string, unknown>)?.value as string | undefined,
            description: l.Description ? String(l.Description) : undefined,
            quantity: Number(detail?.Qty ?? 0),
            unitPrice: Number(detail?.UnitPrice ?? 0),
            amount: Number(l.Amount ?? 0),
          };
        }),
      memo: raw.PrivateNote ? String(raw.PrivateNote) : undefined,
      lastUpdated: (raw.MetaData as Record<string, string>)?.LastUpdatedTime,
    };
  };

  private mapPOStatus(raw: QBORawEntity): QBOPurchaseOrder["status"] {
    const status = String(raw.POStatus ?? "Open");
    if (status === "Closed") return "CLOSED";
    if (status === "Open") return "OPEN";
    return "DRAFT";
  }

  // ═══════════════════════════════════════════════════════════════
  // CLASSES, DEPARTMENTS, TERMS, EMPLOYEES
  // ═══════════════════════════════════════════════════════════════

  async getClasses(): Promise<QBOClass[]> {
    const raw = await this.queryAll("Class");
    return raw.map((r) => ({
      id: String(r.Id ?? ""),
      syncToken: String(r.SyncToken ?? "0"),
      name: String(r.Name ?? ""),
      fullyQualifiedName: r.FullyQualifiedName ? String(r.FullyQualifiedName) : undefined,
      parentId: (r.ParentRef as Record<string, unknown>)?.value as string | undefined,
      active: r.Active !== false,
    }));
  }

  async getDepartments(): Promise<QBODepartment[]> {
    const raw = await this.queryAll("Department");
    return raw.map((r) => ({
      id: String(r.Id ?? ""),
      syncToken: String(r.SyncToken ?? "0"),
      name: String(r.Name ?? ""),
      fullyQualifiedName: r.FullyQualifiedName ? String(r.FullyQualifiedName) : undefined,
      parentId: (r.ParentRef as Record<string, unknown>)?.value as string | undefined,
      active: r.Active !== false,
    }));
  }

  async getTerms(): Promise<QBOTerm[]> {
    const raw = await this.queryAll("Term");
    return raw.map((r) => ({
      id: String(r.Id ?? ""),
      syncToken: String(r.SyncToken ?? "0"),
      name: String(r.Name ?? ""),
      dueDays: Number(r.DueDays ?? 0),
      discountPercent: r.DiscountPercent != null ? Number(r.DiscountPercent) : undefined,
      discountDays: r.DiscountDays != null ? Number(r.DiscountDays) : undefined,
      active: r.Active !== false,
    }));
  }

  async getEmployees(options: { active?: boolean } = {}): Promise<QBOEmployee[]> {
    const where = options.active !== undefined ? `Active = ${options.active}` : undefined;
    const raw = await this.queryAll("Employee", where);
    return raw.map((r) => ({
      id: String(r.Id ?? ""),
      syncToken: String(r.SyncToken ?? "0"),
      displayName: String(r.DisplayName ?? ""),
      givenName: r.GivenName ? String(r.GivenName) : undefined,
      familyName: r.FamilyName ? String(r.FamilyName) : undefined,
      email: (r.PrimaryEmailAddr as Record<string, unknown>)?.Address as string | undefined,
      phone: (r.PrimaryPhone as Record<string, unknown>)?.FreeFormNumber as string | undefined,
      active: r.Active !== false,
      lastUpdated: (r.MetaData as Record<string, string>)?.LastUpdatedTime,
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch a QBO report (ProfitAndLoss, BalanceSheet, GeneralLedger, etc.).
   */
  async getReport(
    reportName: string,
    params: Record<string, string> = {},
  ): Promise<QBOReport> {
    const response = await this.apiCall<Record<string, unknown>>(`/reports/${reportName}`, {
      params,
    });

    const header = response.data.Header as Record<string, unknown> | undefined;
    const columns = response.data.Columns as Record<string, unknown> | undefined;
    const rows = response.data.Rows as Record<string, unknown> | undefined;

    return {
      header: {
        reportName: String(header?.ReportName ?? reportName),
        startPeriod: header?.StartPeriod as string | undefined,
        endPeriod: header?.EndPeriod as string | undefined,
        currency: header?.Currency as string | undefined,
      },
      columns: Array.isArray((columns as Record<string, unknown>)?.Column)
        ? ((columns as Record<string, unknown>).Column as Array<Record<string, unknown>>).map((c) => ({
            colTitle: String(c.ColTitle ?? ""),
            colType: String(c.ColType ?? ""),
          }))
        : [],
      rows: this.parseReportRows(rows),
    };
  }

  /** Helper: parse nested QBO report rows */
  private parseReportRows(rows: Record<string, unknown> | undefined): QBOReportRow[] {
    if (!rows || !Array.isArray(rows.Row)) return [];

    return (rows.Row as Array<Record<string, unknown>>).map((row) => {
      const colData = row.ColData as Array<Record<string, string>> | undefined;
      const summary = row.Summary as Record<string, Array<Record<string, string>>> | undefined;

      return {
        group: row.group as string | undefined,
        data: (colData ?? summary?.ColData ?? []).map((c) => ({
          value: String(c.value ?? ""),
          id: c.id,
        })),
        children: row.Rows ? this.parseReportRows(row.Rows as Record<string, unknown>) : undefined,
      };
    });
  }

  /** Profit & Loss report */
  async getProfitAndLoss(startDate: string, endDate: string): Promise<QBOReport> {
    return this.getReport("ProfitAndLoss", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** Balance Sheet report */
  async getBalanceSheet(asOfDate: string): Promise<QBOReport> {
    return this.getReport("BalanceSheet", {
      date_macro: "custom",
      end_date: asOfDate,
    });
  }

  /** General Ledger report */
  async getGeneralLedger(startDate: string, endDate: string): Promise<QBOReport> {
    return this.getReport("GeneralLedger", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** Accounts Receivable Aging */
  async getARAgingSummary(): Promise<QBOReport> {
    return this.getReport("AgedReceivables");
  }

  /** Accounts Payable Aging */
  async getAPAgingSummary(): Promise<QBOReport> {
    return this.getReport("AgedPayables");
  }

  /** Inventory Valuation Summary */
  async getInventoryValuation(): Promise<QBOReport> {
    return this.getReport("InventoryValuationSummary");
  }

  /** Sales by Customer Summary */
  async getSalesByCustomer(startDate: string, endDate: string): Promise<QBOReport> {
    return this.getReport("CustomerSales", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** Sales by Item Summary */
  async getSalesByItem(startDate: string, endDate: string): Promise<QBOReport> {
    return this.getReport("ItemSales", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPANY INFO
  // ═══════════════════════════════════════════════════════════════

  async getCompanyInfo(): Promise<QBOCompanyInfo> {
    const response = await this.apiCall<Record<string, QBORawEntity>>(
      `/companyinfo/${this.realmId}`,
    );

    const raw = response.data.CompanyInfo;

    return {
      companyName: String(raw?.CompanyName ?? ""),
      legalName: raw?.LegalName ? String(raw.LegalName) : undefined,
      country: String(raw?.Country ?? ""),
      email: (raw?.Email as Record<string, unknown>)?.Address as string | undefined,
      phone: (raw?.PrimaryPhone as Record<string, unknown>)?.FreeFormNumber as string | undefined,
      fiscalYearStartMonth: raw?.FiscalYearStartMonth ? Number(raw.FiscalYearStartMonth) : undefined,
      currencyCode: raw?.HomeCurrency ? String(raw.HomeCurrency) : undefined,
      multiCurrencyEnabled: raw?.MultiCurrencyEnabled === true,
      taxForm: raw?.TaxForm ? String(raw.TaxForm) : undefined,
      address: parseAddress(raw?.CompanyAddr as Record<string, unknown> | undefined),
    };
  }

  /**
   * Test connection by fetching company info.
   */
  async testConnection(): Promise<{ ok: boolean; companyName?: string; error?: string }> {
    try {
      const info = await this.getCompanyInfo();
      return { ok: true, companyName: info.companyName };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }
}

export default QBOClient;
