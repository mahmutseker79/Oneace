/**
 * Phase QBD-2 — QBXML (QuickBooks XML) parser (secondary format).
 *
 * QBXML is an optional XML-based export format from QB Desktop.
 * Lighter-weight than Web Connector SOAP; often used for one-time exports.
 *
 * Key elements:
 *   - <ItemInventoryRet>: inventory item
 *   - <VendorRet>: vendor
 *   - <PurchaseOrderRet>: PO with nested <PurchaseOrderLineRet> items
 *
 * Parse with native DOMParser; no external XML library dependency.
 * Gracefully handle malformed XML or missing fields.
 */

import { normalizeCsvBuffer } from "@/lib/migrations/core/csv-utils";

/**
 * Parsed QBXML document.
 */
export interface QbxmlDocument {
  items: QbxmlItem[];
  vendors: QbxmlVendor[];
  purchaseOrders: QbxmlPurchaseOrder[];
  warnings: string[];
}

export interface QbxmlItem {
  ListID: string;
  Name: string;
  SKU?: string;
  Description?: string;
  UnitPrice?: number;
  Cost?: number;
  InvAccount?: string;
  IsActive?: boolean;
}

export interface QbxmlVendor {
  ListID: string;
  Name: string;
  Contact?: string;
  Email?: string;
  Phone?: string;
  Address?: string;
  IsActive?: boolean;
}

export interface QbxmlPurchaseOrder {
  TxnID: string;
  RefNumber: string;
  VendorID: string;
  TxnDate?: string;
  DueDate?: string;
  Memo?: string;
  LineItems: Array<{
    ItemID: string;
    Quantity: number;
    UnitCost?: number;
  }>;
}

/**
 * Parse a QBXML file buffer into structured data.
 *
 * @param buffer - Raw file bytes or string
 * @returns QbxmlDocument with parsed records and warnings
 */
export function parseQbxmlFile(buffer: Buffer | string): QbxmlDocument {
  const text = typeof buffer === "string" ? buffer : normalizeCsvBuffer(buffer);
  const warnings: string[] = [];
  const result: QbxmlDocument = {
    items: [],
    vendors: [],
    purchaseOrders: [],
    warnings,
  };

  // Use native DOMParser (available in Node.js 19+) or fallback.
  let doc: Document | null = null;

  try {
    // Node.js 19+ has built-in DOM APIs; for older versions, this will fail gracefully.
    // Built-in browser DOMParser takes no constructor arguments; options-bag
    // style is xmldom-specific. We fall back to regex if parsing fails.
    if (typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      doc = parser.parseFromString(text, "application/xml");
    } else {
      // Fallback: basic string parsing if DOMParser unavailable.
      warnings.push("DOMParser not available; using fallback string parsing");
      // Attempt to extract elements via regex as a backup.
      return fallbackQbxmlParse(text, warnings);
    }
  } catch (e) {
    warnings.push(`XML parsing failed: ${e instanceof Error ? e.message : String(e)}`);
    return result;
  }

  if (!doc) {
    return result;
  }

  // Parse items.
  try {
    const itemElems = doc.getElementsByTagName("ItemInventoryRet");
    for (let i = 0; i < itemElems.length; i++) {
      const elem = itemElems[i];
      if (!elem) continue;
      const listId = elem.getElementsByTagName("ListID")[0]?.textContent || `item_${i}`;
      const name = elem.getElementsByTagName("Name")[0]?.textContent || "";

      if (!name) continue; // Skip items without a name.

      result.items.push({
        ListID: listId,
        Name: name,
        SKU: elem.getElementsByTagName("SKU")[0]?.textContent || undefined,
        Description: elem.getElementsByTagName("Desc")[0]?.textContent || undefined,
        UnitPrice:
          Number.parseFloat(elem.getElementsByTagName("UnitPrice")[0]?.textContent || "0") ||
          undefined,
        Cost:
          Number.parseFloat(elem.getElementsByTagName("PurchaseCost")[0]?.textContent || "0") ||
          undefined,
        InvAccount: elem.getElementsByTagName("InvAccount")[0]?.textContent || undefined,
        IsActive: elem.getElementsByTagName("Active")[0]?.textContent !== "0",
      });
    }
  } catch (e) {
    warnings.push(`Failed to parse items: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Parse vendors.
  try {
    const vendorElems = doc.getElementsByTagName("VendorRet");
    for (let i = 0; i < vendorElems.length; i++) {
      const elem = vendorElems[i];
      if (!elem) continue;
      const listId = elem.getElementsByTagName("ListID")[0]?.textContent || `vendor_${i}`;
      const name = elem.getElementsByTagName("Name")[0]?.textContent || "";

      if (!name) continue;

      result.vendors.push({
        ListID: listId,
        Name: name,
        Contact: elem.getElementsByTagName("Contact")[0]?.textContent || undefined,
        Email: elem.getElementsByTagName("Email")[0]?.textContent || undefined,
        Phone: elem.getElementsByTagName("Phone")[0]?.textContent || undefined,
        Address: elem.getElementsByTagName("Addr1")[0]?.textContent || undefined,
        IsActive: elem.getElementsByTagName("Active")[0]?.textContent !== "0",
      });
    }
  } catch (e) {
    warnings.push(`Failed to parse vendors: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Parse purchase orders.
  try {
    const poElems = doc.getElementsByTagName("PurchaseOrderRet");
    for (let i = 0; i < poElems.length; i++) {
      const elem = poElems[i];
      if (!elem) continue;
      const txnId = elem.getElementsByTagName("TxnID")[0]?.textContent || `po_${i}`;
      const refNum = elem.getElementsByTagName("RefNumber")[0]?.textContent || "";
      const vendorId =
        elem.getElementsByTagName("VendorRef")[0]?.getElementsByTagName("ListID")[0]?.textContent ||
        "";

      const lineItems: QbxmlPurchaseOrder["LineItems"] = [];

      // Parse line items.
      const lineElems = elem.getElementsByTagName("PurchaseOrderLineRet");
      for (let j = 0; j < lineElems.length; j++) {
        const line = lineElems[j];
        if (!line) continue;
        const itemId =
          line.getElementsByTagName("ItemRef")[0]?.getElementsByTagName("ListID")[0]?.textContent ||
          "";
        const qty =
          Number.parseFloat(line.getElementsByTagName("Quantity")[0]?.textContent || "0") || 0;
        const cost =
          Number.parseFloat(line.getElementsByTagName("UnitPrice")[0]?.textContent || "0") ||
          undefined;

        if (itemId && qty > 0) {
          lineItems.push({
            ItemID: itemId,
            Quantity: qty,
            UnitCost: cost,
          });
        }
      }

      if (refNum && vendorId && lineItems.length > 0) {
        result.purchaseOrders.push({
          TxnID: txnId,
          RefNumber: refNum,
          VendorID: vendorId,
          TxnDate: elem.getElementsByTagName("TxnDate")[0]?.textContent || undefined,
          DueDate: elem.getElementsByTagName("DueDate")[0]?.textContent || undefined,
          Memo: elem.getElementsByTagName("Memo")[0]?.textContent || undefined,
          LineItems: lineItems,
        });
      }
    }
  } catch (e) {
    warnings.push(`Failed to parse purchase orders: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}

/**
 * Fallback QBXML parser using basic regex (for environments without DOMParser).
 * Very basic; extracts top-level elements only.
 */
function fallbackQbxmlParse(xml: string, warnings: string[]): QbxmlDocument {
  const result: QbxmlDocument = {
    items: [],
    vendors: [],
    purchaseOrders: [],
    warnings: [...warnings, "Using fallback regex-based XML parsing (limited)"],
  };

  // Extract item elements.
  const itemMatches = xml.matchAll(/<ItemInventoryRet>[\s\S]*?<\/ItemInventoryRet>/g);
  for (const match of itemMatches) {
    const elem = match[0];
    const name = extractXmlValue(elem, "Name");
    if (name) {
      result.items.push({
        ListID: extractXmlValue(elem, "ListID") || name,
        Name: name,
        SKU: extractXmlValue(elem, "SKU") || undefined,
        Description: extractXmlValue(elem, "Desc") || undefined,
      });
    }
  }

  // Extract vendor elements.
  const vendorMatches = xml.matchAll(/<VendorRet>[\s\S]*?<\/VendorRet>/g);
  for (const match of vendorMatches) {
    const elem = match[0];
    const name = extractXmlValue(elem, "Name");
    if (name) {
      result.vendors.push({
        ListID: extractXmlValue(elem, "ListID") || name,
        Name: name,
        Contact: extractXmlValue(elem, "Contact") || undefined,
        Email: extractXmlValue(elem, "Email") || undefined,
      });
    }
  }

  return result;
}

/**
 * Helper: extract a single XML element value via regex.
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`);
  const match = xml.match(regex);
  return match?.[1] ? match[1].trim() : null;
}
