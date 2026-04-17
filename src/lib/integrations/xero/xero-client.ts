/**
 * Comprehensive Xero Accounting API Client.
 *
 * Full Xero REST API v2 coverage:
 * - Contacts (customers + suppliers combined)
 * - Invoices (ACCREC), Bills (ACCPAY), Credit Notes
 * - Payments, Overpayments, Prepayments
 * - Accounts (Chart of Accounts), Items (Products/Services)
 * - Purchase Orders, Bank Transactions, Manual Journals
 * - Tax Rates, Currencies, Organisation Info
 * - Reports (P&L, Balance Sheet, Trial Balance, Aged Receivables, Aged Payables)
 * - Attachments, History, Notes
 * - Multi-tenant support with Xero TenantID
 * - If-Modified-Since headers for incremental sync
 * - Rate limiting: 60 calls/minute, 5000/day
 * - Pagination via page parameter (100 records/page)
 */

import {
  type ApiCallOptions,
  type ApiResponse,
  IntegrationClient,
  type OAuthConfig,
  type OAuthToken,
} from "@/lib/integrations/base-client";
import { logger } from "@/lib/logger";

// ── OAuth Config ────────────────────────────────────────────────

const XERO_OAUTH_CONFIG: OAuthConfig = {
  clientId: process.env.XERO_CLIENT_ID || "",
  clientSecret: process.env.XERO_CLIENT_SECRET || "",
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/integrations/xero/callback`,
  authorizationUrl: "https://login.xero.com/identity/connect/authorize",
  tokenUrl: "https://identity.xero.com/connect/token",
  revokeUrl: "https://identity.xero.com/connect/revoke",
};

// ── Xero Response Types ─────────────────────────────────────────

export interface XeroContact {
  ContactID: string;
  ContactName: string;
  ContactStatus: "ACTIVE" | "ARCHIVED" | "GDPRREQUEST";
  ContactType?: "CUSTOMER" | "SUPPLIER" | "EMPLOYEE" | "PAYOR" | "PAYEE";
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  Phones?: Array<{
    PhoneType: "DEFAULT" | "DDI" | "MOBILE" | "FAX";
    PhoneNumber: string;
  }>;
  Addresses?: Array<{
    AddressType: "STREET" | "POBOX";
    City?: string;
    Region?: string;
    PostalCode?: string;
    Country?: string;
    AttentionTo?: string;
  }>;
  TaxNumber?: string;
  DefaultCurrency?: string;
  UpdatedDateUTC?: string;
  HasAttachments?: boolean;
  ContactGroups?: Array<{ Name: string; Status: string }>;
}

export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Type: "ACCREC" | "ACCPAY";
  Status: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" | "VOIDED";
  ContactID: string;
  Date: string;
  DueDate?: string;
  DeliveryDate?: string;
  LineAmountTypes?: "Inclusive" | "Exclusive";
  Description?: string;
  Total?: number;
  Tax?: number;
  AmountDue?: number;
  AmountPaid?: number;
  UpdatingPersonName?: string;
  Reference?: string;
  HasAttachments?: boolean;
  LineItems: Array<{
    LineItemID?: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    Tracking?: Array<{
      Name: string;
      Option: string;
    }>;
    AccountCode: string;
    TaxType?: string;
    TaxAmount?: number;
  }>;
  UpdatedDateUTC?: string;
}

export interface XeroCreditNote {
  CreditNoteID: string;
  CreditNoteNumber: string;
  Type: "ACCRECCREDIT" | "ACCPAYCREDIT";
  Status: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" | "VOIDED";
  ContactID: string;
  Date: string;
  Total?: number;
  Tax?: number;
  AmountDue?: number;
  Reference?: string;
  HasAttachments?: boolean;
  LineItems: Array<{
    LineItemID?: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType?: string;
    TaxAmount?: number;
  }>;
  UpdatedDateUTC?: string;
}

export interface XeroPayment {
  PaymentID: string;
  InvoiceID?: string;
  CreditNoteID?: string;
  ContactID: string;
  Account?: { Code: string; Name: string };
  PaymentType: "ARCREDITPAYMENT" | "APCREDITPAYMENT" | "ARRECEIPT" | "APPAYMENT";
  Status: "AUTHORISED" | "DELETED";
  LineAmountTypes?: "Inclusive" | "Exclusive";
  Amount?: number;
  Reference?: string;
  IsReconciled?: boolean;
  UpdatedDateUTC?: string;
}

export interface XeroOverpayment {
  OverpaymentID: string;
  Status: "AUTHORISED" | "PAID" | "VOIDED";
  ContactID: string;
  Date: string;
  Total?: number;
  Tax?: number;
  AmountDue?: number;
  LineItems: Array<{
    LineItemID?: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType?: string;
  }>;
  UpdatedDateUTC?: string;
}

export interface XeroPrepayment {
  PrepaymentID: string;
  Status: "AUTHORISED" | "PAID" | "VOIDED";
  ContactID: string;
  Date: string;
  Total?: number;
  Tax?: number;
  AmountDue?: number;
  LineItems: Array<{
    LineItemID?: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType?: string;
  }>;
  UpdatedDateUTC?: string;
}

export interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type:
    | "BANK"
    | "CURRENT"
    | "FIXED"
    | "EQUITY"
    | "EXPENSE"
    | "FIXED_ASSET"
    | "LIABILITY"
    | "REVENUE"
    | "SALES"
    | "OVERHEADS"
    | "DEPRECIATION";
  TaxType?: string;
  Description?: string;
  EnablePayments?: boolean;
  ShowInExpenseClaimLineItems?: boolean;
  UpdatedDateUTC?: string;
  Status: "ACTIVE" | "ARCHIVED";
  SystemAccount?: string;
  HasAttachments?: boolean;
}

export interface XeroItem {
  ItemID: string;
  Code: string;
  Description: string;
  InventoryAssetAccountCode?: string;
  PurchaseDetails?: {
    UnitAmount: number;
    AccountCode: string;
    TaxType?: string;
    COGSAccountCode?: string;
    TrackingCategories?: Array<{
      Name: string;
      Option: string;
    }>;
  };
  SalesDetails?: {
    UnitAmount: number;
    AccountCode: string;
    TaxType?: string;
    TrackingCategories?: Array<{
      Name: string;
      Option: string;
    }>;
  };
  UpdatedDateUTC?: string;
  Status: "ACTIVE" | "ARCHIVED";
}

export interface XeroPurchaseOrder {
  PurchaseOrderID: string;
  PurchaseOrderNumber: string;
  Status: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "RECEIVED" | "INVOICED" | "VOIDED";
  ContactID: string;
  Date: string;
  DeliveryDate?: string;
  DeliveryAddress?: string;
  AttentionTo?: string;
  Total?: number;
  Tax?: number;
  LineItems: Array<{
    LineItemID?: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType?: string;
    Tracking?: Array<{
      Name: string;
      Option: string;
    }>;
  }>;
  UpdatedDateUTC?: string;
  HasAttachments?: boolean;
}

export interface XeroBankTransaction {
  BankTransactionID: string;
  Type: "ACCREC" | "ACCPAY";
  Status: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" | "VOIDED";
  ContactID?: string;
  BankAccount?: {
    AccountID: string;
    Code: string;
    Name: string;
  };
  Date: string;
  Reference?: string;
  Total?: number;
  Tax?: number;
  LineItems: Array<{
    LineItemID?: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType?: string;
    Tracking?: Array<{
      Name: string;
      Option: string;
    }>;
  }>;
  UpdatedDateUTC?: string;
  HasAttachments?: boolean;
}

export interface XeroManualJournal {
  ManualJournalID: string;
  Status: "DRAFT" | "POSTED" | "SUBMITTED" | "AUTHORISED" | "VOIDED";
  Narration: string;
  Date: string;
  Reference?: string;
  LineAmountTypes?: "Inclusive" | "Exclusive";
  JournalLines: Array<{
    LineItemID?: string;
    Description?: string;
    LineAmount: number;
    AccountCode: string;
    TaxType?: string;
    TaxAmount?: number;
    Tracking?: Array<{
      Name: string;
      Option: string;
    }>;
  }>;
  UpdatedDateUTC?: string;
  HasAttachments?: boolean;
}

export interface XeroTaxRate {
  TaxType: string;
  TaxComponents: Array<{
    Name: string;
    Rate: string;
  }>;
  Status: "ACTIVE" | "DELETED";
}

export interface XeroCurrency {
  Code: string;
  Description: string;
}

export interface XeroOrganisation {
  OrganisationID: string;
  Name: string;
  LegalName?: string;
  PaysTax?: boolean;
  TaxNumber?: string;
  Version?: string;
  OrganisationType?: string;
  BaseCurrency?: string;
  CountryCode?: string;
  IsDemoCompany?: boolean;
  OrganisationStatus?: string;
  RegistrationNumber?: string;
  Timezone?: string;
  FinancialYearEndDay?: number;
  FinancialYearEndMonth?: number;
}

export interface XeroAttachment {
  AttachmentID: string;
  FileName: string;
  Url: string;
  MimeType: string;
  ContentLength: number;
  IncludeOnline?: boolean;
}

export interface XeroReportResponse {
  ReportID: string;
  ReportName: string;
  ReportDate: string;
  UpdatedDateUTC?: string;
  ReportTitles?: string[];
  ReportRows?: Array<{
    RowType: string;
    Cells: Array<{
      Value: string;
      Attributes?: Array<{
        Id: string;
        Value: string;
      }>;
    }>;
    RowItems?: Array<unknown>;
  }>;
}

export interface XeroApiListResponse<T> {
  Apiresources?: T[];
  Id?: string;
}

// ── Xero Client ─────────────────────────────────────────────────

export class XeroClient extends IntegrationClient {
  private tenantId = "";
  private baseApiUrl = "https://api.xero.com/api.xro/2.0";

  constructor(oauthConfig: OAuthConfig, credentials: OAuthToken, tenantId: string) {
    super(oauthConfig, credentials, {
      maxRequests: 60, // 60 calls per minute
      windowMs: 60000,
      backoffMultiplier: 2,
      maxBackoffMs: 32000,
    });
    this.tenantId = tenantId;
    this.baseUrl = this.baseApiUrl;
  }

  /**
   * Set the Xero tenant ID (multi-org support).
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Get the current tenant ID.
   */
  getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Override getRequestHeaders to include Xero-tenant-id.
   */
  protected async getRequestHeaders(
    customHeaders?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const headers = await super.getRequestHeaders(customHeaders);
    headers["Xero-tenant-id"] = this.tenantId;
    return headers;
  }

  // ── Contacts (Customers + Suppliers) ────────────────────

  /**
   * Get all contacts with optional pagination and filtering.
   */
  async getContacts(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroContact>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroContact>>("/Contacts", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific contact by ID.
   */
  async getContact(contactId: string): Promise<ApiResponse<XeroApiListResponse<XeroContact>>> {
    return this.apiCall<XeroApiListResponse<XeroContact>>(`/Contacts/${contactId}`);
  }

  /**
   * Create a new contact.
   */
  async createContact(
    contact: Partial<XeroContact>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroContact>>> {
    return this.apiCall<XeroApiListResponse<XeroContact>>("/Contacts", {
      method: "POST",
      body: { Contacts: [contact] },
    });
  }

  /**
   * Update an existing contact.
   */
  async updateContact(
    contactId: string,
    contact: Partial<XeroContact>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroContact>>> {
    return this.apiCall<XeroApiListResponse<XeroContact>>(`/Contacts/${contactId}`, {
      method: "POST",
      body: { Contacts: [contact] },
    });
  }

  // ── Invoices ────────────────────────────────────────────

  /**
   * Get all invoices (bills and sales invoices).
   */
  async getInvoices(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroInvoice>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroInvoice>>("/Invoices", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific invoice by ID.
   */
  async getInvoice(invoiceId: string): Promise<ApiResponse<XeroApiListResponse<XeroInvoice>>> {
    return this.apiCall<XeroApiListResponse<XeroInvoice>>(`/Invoices/${invoiceId}`);
  }

  /**
   * Create a new invoice.
   */
  async createInvoice(
    invoice: Partial<XeroInvoice>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroInvoice>>> {
    return this.apiCall<XeroApiListResponse<XeroInvoice>>("/Invoices", {
      method: "POST",
      body: { Invoices: [invoice] },
    });
  }

  /**
   * Update an existing invoice.
   */
  async updateInvoice(
    invoiceId: string,
    invoice: Partial<XeroInvoice>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroInvoice>>> {
    return this.apiCall<XeroApiListResponse<XeroInvoice>>(`/Invoices/${invoiceId}`, {
      method: "POST",
      body: { Invoices: [invoice] },
    });
  }

  /**
   * Mark invoice as sent.
   */
  async markInvoiceAsSent(
    invoiceId: string,
  ): Promise<ApiResponse<XeroApiListResponse<XeroInvoice>>> {
    return this.apiCall<XeroApiListResponse<XeroInvoice>>(`/Invoices/${invoiceId}`, {
      method: "POST",
      body: {
        Invoices: [
          {
            Status: "SUBMITTED",
          },
        ],
      },
    });
  }

  // ── Credit Notes ────────────────────────────────────────

  /**
   * Get all credit notes.
   */
  async getCreditNotes(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroCreditNote>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroCreditNote>>("/CreditNotes", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific credit note by ID.
   */
  async getCreditNote(
    creditNoteId: string,
  ): Promise<ApiResponse<XeroApiListResponse<XeroCreditNote>>> {
    return this.apiCall<XeroApiListResponse<XeroCreditNote>>(`/CreditNotes/${creditNoteId}`);
  }

  /**
   * Create a new credit note.
   */
  async createCreditNote(
    creditNote: Partial<XeroCreditNote>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroCreditNote>>> {
    return this.apiCall<XeroApiListResponse<XeroCreditNote>>("/CreditNotes", {
      method: "POST",
      body: { CreditNotes: [creditNote] },
    });
  }

  // ── Payments ────────────────────────────────────────────

  /**
   * Get all payments.
   */
  async getPayments(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroPayment>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroPayment>>("/Payments", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific payment by ID.
   */
  async getPayment(paymentId: string): Promise<ApiResponse<XeroApiListResponse<XeroPayment>>> {
    return this.apiCall<XeroApiListResponse<XeroPayment>>(`/Payments/${paymentId}`);
  }

  /**
   * Create a new payment.
   */
  async createPayment(
    payment: Partial<XeroPayment>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroPayment>>> {
    return this.apiCall<XeroApiListResponse<XeroPayment>>("/Payments", {
      method: "POST",
      body: { Payments: [payment] },
    });
  }

  // ── Overpayments ────────────────────────────────────────

  /**
   * Get all overpayments.
   */
  async getOverpayments(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroOverpayment>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroOverpayment>>("/Overpayments", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific overpayment by ID.
   */
  async getOverpayment(
    overpaymentId: string,
  ): Promise<ApiResponse<XeroApiListResponse<XeroOverpayment>>> {
    return this.apiCall<XeroApiListResponse<XeroOverpayment>>(`/Overpayments/${overpaymentId}`);
  }

  // ── Prepayments ─────────────────────────────────────────

  /**
   * Get all prepayments.
   */
  async getPrepayments(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroPrepayment>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroPrepayment>>("/Prepayments", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific prepayment by ID.
   */
  async getPrepayment(
    prepaymentId: string,
  ): Promise<ApiResponse<XeroApiListResponse<XeroPrepayment>>> {
    return this.apiCall<XeroApiListResponse<XeroPrepayment>>(`/Prepayments/${prepaymentId}`);
  }

  // ── Accounts (Chart of Accounts) ────────────────────────

  /**
   * Get all accounts.
   */
  async getAccounts(options?: {
    where?: string;
    order?: string;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroAccount>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroAccount>>("/Accounts", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific account by ID.
   */
  async getAccount(accountId: string): Promise<ApiResponse<XeroApiListResponse<XeroAccount>>> {
    return this.apiCall<XeroApiListResponse<XeroAccount>>(`/Accounts/${accountId}`);
  }

  /**
   * Create a new account.
   */
  async createAccount(
    account: Partial<XeroAccount>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroAccount>>> {
    return this.apiCall<XeroApiListResponse<XeroAccount>>("/Accounts", {
      method: "POST",
      body: { Accounts: [account] },
    });
  }

  /**
   * Update an existing account.
   */
  async updateAccount(
    accountId: string,
    account: Partial<XeroAccount>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroAccount>>> {
    return this.apiCall<XeroApiListResponse<XeroAccount>>(`/Accounts/${accountId}`, {
      method: "POST",
      body: { Accounts: [account] },
    });
  }

  // ── Items (Products/Services) ───────────────────────────

  /**
   * Get all items.
   */
  async getItems(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroItem>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroItem>>("/Items", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific item by ID.
   */
  async getItem(itemId: string): Promise<ApiResponse<XeroApiListResponse<XeroItem>>> {
    return this.apiCall<XeroApiListResponse<XeroItem>>(`/Items/${itemId}`);
  }

  /**
   * Create a new item.
   */
  async createItem(item: Partial<XeroItem>): Promise<ApiResponse<XeroApiListResponse<XeroItem>>> {
    return this.apiCall<XeroApiListResponse<XeroItem>>("/Items", {
      method: "POST",
      body: { Items: [item] },
    });
  }

  /**
   * Update an existing item.
   */
  async updateItem(
    itemId: string,
    item: Partial<XeroItem>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroItem>>> {
    return this.apiCall<XeroApiListResponse<XeroItem>>(`/Items/${itemId}`, {
      method: "POST",
      body: { Items: [item] },
    });
  }

  // ── Purchase Orders ─────────────────────────────────────

  /**
   * Get all purchase orders.
   */
  async getPurchaseOrders(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroPurchaseOrder>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroPurchaseOrder>>("/PurchaseOrders", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific purchase order by ID.
   */
  async getPurchaseOrder(
    poId: string,
  ): Promise<ApiResponse<XeroApiListResponse<XeroPurchaseOrder>>> {
    return this.apiCall<XeroApiListResponse<XeroPurchaseOrder>>(`/PurchaseOrders/${poId}`);
  }

  /**
   * Create a new purchase order.
   */
  async createPurchaseOrder(
    po: Partial<XeroPurchaseOrder>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroPurchaseOrder>>> {
    return this.apiCall<XeroApiListResponse<XeroPurchaseOrder>>("/PurchaseOrders", {
      method: "POST",
      body: { PurchaseOrders: [po] },
    });
  }

  /**
   * Update an existing purchase order.
   */
  async updatePurchaseOrder(
    poId: string,
    po: Partial<XeroPurchaseOrder>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroPurchaseOrder>>> {
    return this.apiCall<XeroApiListResponse<XeroPurchaseOrder>>(`/PurchaseOrders/${poId}`, {
      method: "POST",
      body: { PurchaseOrders: [po] },
    });
  }

  // ── Bank Transactions ───────────────────────────────────

  /**
   * Get all bank transactions.
   */
  async getBankTransactions(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroBankTransaction>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroBankTransaction>>("/BankTransactions", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific bank transaction by ID.
   */
  async getBankTransaction(
    txnId: string,
  ): Promise<ApiResponse<XeroApiListResponse<XeroBankTransaction>>> {
    return this.apiCall<XeroApiListResponse<XeroBankTransaction>>(`/BankTransactions/${txnId}`);
  }

  /**
   * Create a new bank transaction.
   */
  async createBankTransaction(
    txn: Partial<XeroBankTransaction>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroBankTransaction>>> {
    return this.apiCall<XeroApiListResponse<XeroBankTransaction>>("/BankTransactions", {
      method: "POST",
      body: { BankTransactions: [txn] },
    });
  }

  /**
   * Update an existing bank transaction.
   */
  async updateBankTransaction(
    txnId: string,
    txn: Partial<XeroBankTransaction>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroBankTransaction>>> {
    return this.apiCall<XeroApiListResponse<XeroBankTransaction>>(`/BankTransactions/${txnId}`, {
      method: "POST",
      body: { BankTransactions: [txn] },
    });
  }

  // ── Manual Journals ────────────────────────────────────

  /**
   * Get all manual journals.
   */
  async getManualJournals(options?: {
    where?: string;
    order?: string;
    page?: number;
    modifiedAfter?: Date;
  }): Promise<ApiResponse<XeroApiListResponse<XeroManualJournal>>> {
    const customHeaders: Record<string, string> = {};
    if (options?.modifiedAfter) {
      customHeaders["If-Modified-Since"] = options.modifiedAfter.toISOString();
    }

    return this.apiCall<XeroApiListResponse<XeroManualJournal>>("/ManualJournals", {
      params: {
        ...(options?.where && { where: options.where }),
        ...(options?.order && { order: options.order }),
        ...(options?.page && { page: options.page }),
      },
      headers: customHeaders,
    });
  }

  /**
   * Get a specific manual journal by ID.
   */
  async getManualJournal(
    journalId: string,
  ): Promise<ApiResponse<XeroApiListResponse<XeroManualJournal>>> {
    return this.apiCall<XeroApiListResponse<XeroManualJournal>>(`/ManualJournals/${journalId}`);
  }

  /**
   * Create a new manual journal.
   */
  async createManualJournal(
    journal: Partial<XeroManualJournal>,
  ): Promise<ApiResponse<XeroApiListResponse<XeroManualJournal>>> {
    return this.apiCall<XeroApiListResponse<XeroManualJournal>>("/ManualJournals", {
      method: "POST",
      body: { ManualJournals: [journal] },
    });
  }

  // ── Tax Rates ───────────────────────────────────────────

  /**
   * Get all tax rates.
   */
  async getTaxRates(): Promise<ApiResponse<XeroApiListResponse<XeroTaxRate>>> {
    return this.apiCall<XeroApiListResponse<XeroTaxRate>>("/TaxRates");
  }

  // ── Currencies ──────────────────────────────────────────

  /**
   * Get all currencies.
   */
  async getCurrencies(): Promise<ApiResponse<XeroApiListResponse<XeroCurrency>>> {
    return this.apiCall<XeroApiListResponse<XeroCurrency>>("/Currencies");
  }

  // ── Organisation Info ───────────────────────────────────

  /**
   * Get organisation info.
   */
  async getOrganisation(): Promise<ApiResponse<XeroApiListResponse<XeroOrganisation>>> {
    return this.apiCall<XeroApiListResponse<XeroOrganisation>>("/Organisation");
  }

  // ── Reports ────────────────────────────────────────────

  /**
   * Get Profit and Loss report.
   */
  async getProfitAndLossReport(params?: {
    fromDate?: string;
    toDate?: string;
    periods?: number;
    timeframe?: "MONTH" | "QUARTER" | "YEAR";
    paymentsOnly?: boolean;
    standardLayout?: boolean;
  }): Promise<ApiResponse<XeroReportResponse>> {
    return this.apiCall<XeroReportResponse>("/Reports/ProfitAndLoss", {
      params: params as Record<string, string | number | boolean>,
    });
  }

  /**
   * Get Balance Sheet report.
   */
  async getBalanceSheetReport(params?: {
    date?: string;
    paymentsOnly?: boolean;
    standardLayout?: boolean;
  }): Promise<ApiResponse<XeroReportResponse>> {
    return this.apiCall<XeroReportResponse>("/Reports/BalanceSheet", {
      params: params as Record<string, string | number | boolean>,
    });
  }

  /**
   * Get Trial Balance report.
   */
  async getTrialBalanceReport(params?: {
    date?: string;
  }): Promise<ApiResponse<XeroReportResponse>> {
    return this.apiCall<XeroReportResponse>("/Reports/TrialBalance", {
      params: params as Record<string, string | number | boolean>,
    });
  }

  /**
   * Get Aged Receivables report.
   */
  async getAgedReceivablesReport(params?: {
    fromDate?: string;
    toDate?: string;
    contactId?: string;
  }): Promise<ApiResponse<XeroReportResponse>> {
    return this.apiCall<XeroReportResponse>("/Reports/AgedReceivables", {
      params: params as Record<string, string | number | boolean>,
    });
  }

  /**
   * Get Aged Payables report.
   */
  async getAgedPayablesReport(params?: {
    fromDate?: string;
    toDate?: string;
    contactId?: string;
  }): Promise<ApiResponse<XeroReportResponse>> {
    return this.apiCall<XeroReportResponse>("/Reports/AgedPayables", {
      params: params as Record<string, string | number | boolean>,
    });
  }

  // ── Attachments ────────────────────────────────────────

  /**
   * Get attachments for an entity.
   */
  async getAttachments(
    entityType: "Invoice" | "Contact" | "PurchaseOrder" | "BankTransaction",
    entityId: string,
  ): Promise<ApiResponse<XeroApiListResponse<XeroAttachment>>> {
    return this.apiCall<XeroApiListResponse<XeroAttachment>>(
      `/${entityType}s/${entityId}/Attachments`,
    );
  }

  /**
   * Get a specific attachment.
   */
  async getAttachment(
    entityType: string,
    entityId: string,
    attachmentId: string,
  ): Promise<ApiResponse<XeroAttachment>> {
    return this.apiCall<XeroAttachment>(`/${entityType}s/${entityId}/Attachments/${attachmentId}`);
  }

  /**
   * Upload an attachment.
   */
  async uploadAttachment(
    entityType: string,
    entityId: string,
    fileName: string,
    fileData: Buffer,
    includeOnline?: boolean,
  ): Promise<ApiResponse<XeroAttachment>> {
    const headers = await this.getRequestHeaders({
      "Content-Type": "application/octet-stream",
    });

    return this.apiCall<XeroAttachment>(
      `/${entityType}s/${entityId}/Attachments/${fileName}?includeOnline=${includeOnline ? "true" : "false"}`,
      {
        method: "POST",
        headers,
        body: fileData as unknown as Record<string, unknown>,
      },
    );
  }

  // ── History & Notes ────────────────────────────────────

  /**
   * Get history for an entity.
   */
  async getHistory(
    entityType: string,
    entityId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.apiCall<Record<string, unknown>>(`/${entityType}s/${entityId}/History`);
  }
}

export default XeroClient;
