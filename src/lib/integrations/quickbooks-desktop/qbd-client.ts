/**
 * QuickBooks Desktop Integration Client
 *
 * QB Desktop uses Web Connector (SOAP/XML) — NOT REST/OAuth.
 * Uses QBXML request/response format.
 * Communication via ticket-based request queue.
 * OneAce stores pending requests; Web Connector polls them.
 *
 * Covers:
 * - Items
 * - Customers
 * - Vendors
 * - Invoices
 * - Bills
 * - Payments
 * - Sales Receipts
 * - Estimates
 * - Purchase Orders
 * - Accounts
 * - Classes
 *
 * This is a standalone class that does NOT extend IntegrationClient,
 * as QB Desktop uses SOAP/XML instead of OAuth REST.
 */

import { logger } from "@/lib/logger";

export interface QBDesktopCredentials {
  appName: string;
  appId: string;
  connectionTicket?: string;
  sessionTicket?: string;
  qboRealmId?: string;
}

export interface QBDesktopItem {
  ListID: string;
  Name: string;
  BarCode?: string;
  Description?: string;
  UnitPrice?: number;
  Cost?: number;
  Active?: boolean;
  Type?: string;
  Account?: string;
}

export interface QBDesktopCustomer {
  ListID: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  BillingAddress?: {
    Addr1?: string;
    City?: string;
    State?: string;
    PostalCode?: string;
    Country?: string;
  };
  Active?: boolean;
}

export interface QBDesktopVendor {
  ListID: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  Address?: {
    Addr1?: string;
    City?: string;
    State?: string;
    PostalCode?: string;
    Country?: string;
  };
  Active?: boolean;
}

export interface QBDesktopInvoice {
  TxnID: string;
  TxnNumber: string;
  CustomerRef: string;
  DueDate?: string;
  TxnDate?: string;
  LineItems?: Array<{
    ItemRef: string;
    Quantity: number;
    UnitPrice: number;
  }>;
  Subtotal?: number;
  TaxableSubtotal?: number;
  SalesTaxTotal?: number;
  BalanceRemaining?: number;
}

export interface QBDesktopBill {
  TxnID: string;
  TxnNumber: string;
  VendorRef: string;
  DueDate?: string;
  TxnDate?: string;
  LineItems?: Array<{
    ItemRef: string;
    Quantity: number;
    UnitPrice: number;
  }>;
  AmountDue?: number;
}

export interface QBDesktopPurchaseOrder {
  TxnID: string;
  TxnNumber: string;
  VendorRef: string;
  DueDate?: string;
  TxnDate?: string;
  LineItems?: Array<{
    ItemRef: string;
    Quantity: number;
    UnitPrice: number;
  }>;
  Total?: number;
}

export interface QBDesktopPayment {
  TxnID: string;
  TxnNumber: string;
  CustomerRef?: string;
  VendorRef?: string;
  Amount: number;
  TxnDate?: string;
}

class QBDesktopClient {
  private credentials: QBDesktopCredentials;
  private requestQueue: Array<{
    id: string;
    qbxml: string;
    createdAt: Date;
    status: "pending" | "sent" | "completed" | "failed";
    response?: string;
  }> = [];

  constructor(credentials: QBDesktopCredentials) {
    this.credentials = credentials;
  }

  /**
   * Generate QBXML for querying items.
   */
  generateItemQueryXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <?qbxml version="15.0"?>
      <QBXMLMsgsRq onError="stopOnError">
        <ItemQueryRq requestID="1">
          <MaxReturned>100</MaxReturned>
          <ActiveStatus>All</ActiveStatus>
        </ItemQueryRq>
      </QBXMLMsgsRq>`;
  }

  /**
   * Generate QBXML for querying customers.
   */
  generateCustomerQueryXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <?qbxml version="15.0"?>
      <QBXMLMsgsRq onError="stopOnError">
        <CustomerQueryRq requestID="1">
          <MaxReturned>100</MaxReturned>
          <ActiveStatus>All</ActiveStatus>
        </CustomerQueryRq>
      </QBXMLMsgsRq>`;
  }

  /**
   * Generate QBXML for querying vendors.
   */
  generateVendorQueryXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <?qbxml version="15.0"?>
      <QBXMLMsgsRq onError="stopOnError">
        <VendorQueryRq requestID="1">
          <MaxReturned>100</MaxReturned>
          <ActiveStatus>All</ActiveStatus>
        </VendorQueryRq>
      </QBXMLMsgsRq>`;
  }

  /**
   * Generate QBXML for querying invoices.
   */
  generateInvoiceQueryXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <?qbxml version="15.0"?>
      <QBXMLMsgsRq onError="stopOnError">
        <InvoiceQueryRq requestID="1">
          <MaxReturned>100</MaxReturned>
        </InvoiceQueryRq>
      </QBXMLMsgsRq>`;
  }

  /**
   * Generate QBXML for querying bills.
   */
  generateBillQueryXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <?qbxml version="15.0"?>
      <QBXMLMsgsRq onError="stopOnError">
        <BillQueryRq requestID="1">
          <MaxReturned>100</MaxReturned>
        </BillQueryRq>
      </QBXMLMsgsRq>`;
  }

  /**
   * Generate QBXML for querying purchase orders.
   */
  generatePurchaseOrderQueryXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <?qbxml version="15.0"?>
      <QBXMLMsgsRq onError="stopOnError">
        <PurchaseOrderQueryRq requestID="1">
          <MaxReturned>100</MaxReturned>
        </PurchaseOrderQueryRq>
      </QBXMLMsgsRq>`;
  }

  /**
   * Enqueue a request for the QB Web Connector to pick up.
   */
  enqueueRequest(requestId: string, qbxml: string): void {
    try {
      this.requestQueue.push({
        id: requestId,
        qbxml,
        createdAt: new Date(),
        status: "pending",
      });

      logger.info("QB request enqueued", {
        requestId,
        queueSize: this.requestQueue.length,
      });
    } catch (error) {
      logger.error("Failed to enqueue QB request", { requestId, error });
      throw error;
    }
  }

  /**
   * Get pending requests (for Web Connector to poll).
   */
  getPendingRequests(): Array<{ id: string; qbxml: string }> {
    return this.requestQueue
      .filter((r) => r.status === "pending")
      .map((r) => ({
        id: r.id,
        qbxml: r.qbxml,
      }));
  }

  /**
   * Mark a request as sent.
   */
  markRequestSent(requestId: string): void {
    const req = this.requestQueue.find((r) => r.id === requestId);
    if (req) {
      req.status = "sent";
      logger.info("QB request marked as sent", { requestId });
    }
  }

  /**
   * Process a response from the QB Web Connector.
   */
  processResponse(requestId: string, responseXml: string): void {
    try {
      const req = this.requestQueue.find((r) => r.id === requestId);
      if (req) {
        req.status = "completed";
        req.response = responseXml;
        logger.info("QB response processed", { requestId });
      }
    } catch (error) {
      logger.error("Failed to process QB response", { requestId, error });
      throw error;
    }
  }

  /**
   * Mark a request as failed.
   */
  markRequestFailed(requestId: string, errorMessage: string): void {
    const req = this.requestQueue.find((r) => r.id === requestId);
    if (req) {
      req.status = "failed";
      logger.error("QB request failed", { requestId, error: errorMessage });
    }
  }

  /**
   * Get response for a completed request.
   */
  getResponse(requestId: string): string | undefined {
    const req = this.requestQueue.find((r) => r.id === requestId);
    return req?.response;
  }

  /**
   * Parse item from QBXML response.
   */
  parseItemFromXML(xmlElement: Element): QBDesktopItem {
    const extractText = (selector: string): string | undefined => {
      const el = xmlElement.querySelector(selector);
      return el?.textContent || undefined;
    };

    return {
      ListID: extractText("ListID") || "",
      Name: extractText("Name") || "",
      BarCode: extractText("BarCode"),
      Description: extractText("Description"),
      UnitPrice: Number.parseFloat(extractText("UnitPrice") || "0"),
      Cost: Number.parseFloat(extractText("Cost") || "0"),
      Active: extractText("Active") === "true",
      Type: extractText("Type"),
      Account: extractText("Account"),
    };
  }

  /**
   * Parse customer from QBXML response.
   */
  parseCustomerFromXML(xmlElement: Element): QBDesktopCustomer {
    const extractText = (selector: string): string | undefined => {
      const el = xmlElement.querySelector(selector);
      return el?.textContent || undefined;
    };

    return {
      ListID: extractText("ListID") || "",
      Name: extractText("Name") || "",
      FirstName: extractText("FirstName"),
      LastName: extractText("LastName"),
      Email: extractText("Email"),
      Phone: extractText("Phone"),
      BillingAddress: {
        Addr1: extractText("BillingAddress Addr1"),
        City: extractText("BillingAddress City"),
        State: extractText("BillingAddress State"),
        PostalCode: extractText("BillingAddress PostalCode"),
        Country: extractText("BillingAddress Country"),
      },
      Active: extractText("Active") === "true",
    };
  }

  /**
   * Create an item add request.
   */
  generateItemAddXML(item: Partial<QBDesktopItem>): string {
    const { Name = "", UnitPrice = 0, Type = "InventoryItem" } = item;

    return `<?xml version="1.0" encoding="UTF-8"?>
      <?qbxml version="15.0"?>
      <QBXMLMsgsRq onError="stopOnError">
        <ItemAddRq requestID="1">
          <ItemAdd>
            <Name>${this.escapeXML(Name)}</Name>
            <UnitPrice>${UnitPrice}</UnitPrice>
            <Type>${Type}</Type>
          </ItemAdd>
        </ItemAddRq>
      </QBXMLMsgsRq>`;
  }

  /**
   * Create a customer add request.
   */
  generateCustomerAddXML(customer: Partial<QBDesktopCustomer>): string {
    const { Name = "", FirstName = "", LastName = "", Email = "", Phone = "" } = customer;

    return `<?xml version="1.0" encoding="UTF-8"?>
      <?qbxml version="15.0"?>
      <QBXMLMsgsRq onError="stopOnError">
        <CustomerAddRq requestID="1">
          <CustomerAdd>
            <Name>${this.escapeXML(Name)}</Name>
            <FirstName>${this.escapeXML(FirstName)}</FirstName>
            <LastName>${this.escapeXML(LastName)}</LastName>
            <Email>${this.escapeXML(Email)}</Email>
            <Phone>${this.escapeXML(Phone)}</Phone>
          </CustomerAdd>
        </CustomerAddRq>
      </QBXMLMsgsRq>`;
  }

  /**
   * Escape XML special characters.
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

export default QBDesktopClient;
