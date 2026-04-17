/**
 * Phase MIG-S5 — Cin7 Core snapshot parser.
 *
 * Converts Cin7 API responses into the canonical ParsedSnapshot format.
 */

import type {
  Cin7Attachment,
  Cin7Location,
  Cin7Product,
  Cin7Purchase,
  Cin7StockItem,
  Cin7Supplier,
} from "@/lib/migrations/cin7/api-client";
import type {
  ParsedSnapshot,
  RawAttachment,
  RawItem,
  RawLocation,
  RawPurchaseOrder,
  RawPurchaseOrderLine,
  RawStockLevel,
  RawSupplier,
  RawWarehouse,
} from "@/lib/migrations/core/types";

interface Cin7SnapshotInput {
  products: Cin7Product[];
  suppliers: Cin7Supplier[];
  locations: Cin7Location[];
  stockItems: Cin7StockItem[];
  purchases: Cin7Purchase[];
  attachmentsByProduct: Record<string, Cin7Attachment[]>;
}

export function parseCin7Snapshot(input: Cin7SnapshotInput): ParsedSnapshot {
  const adapterWarnings: string[] = [];

  // Parse suppliers
  const suppliers: RawSupplier[] = input.suppliers.map((s) => ({
    externalId: s.ID,
    name: s.Name,
    contactName: s.ContactName || null,
    email: s.Email || null,
    phone: s.Phone || null,
    website: s.Website || null,
    address: formatAddress(s),
    currency: s.Currency || null,
    notes: s.Notes || null,
  }));

  // Parse locations (warehouses in Cin7)
  const warehouses: RawWarehouse[] = input.locations.map((loc) => ({
    externalId: loc.ID,
    name: loc.Name,
    code: loc.Code || null,
    address: loc.Address || null,
    isDefault: loc.IsDefault || false,
  }));

  // Parse products
  const items: RawItem[] = [];
  for (const product of input.products) {
    // Skip products without SKU
    if (!product.SKU || product.SKU.trim() === "") {
      adapterWarnings.push(`Product "${product.Name}" (ID: ${product.ID}) skipped: missing SKU`);
      continue;
    }

    items.push({
      externalId: product.ID,
      sku: product.SKU,
      name: product.Name,
      barcode: product.Barcode || null,
      description: product.Description || null,
      unit: product.UOM || null,
      costPrice: product.CostPrice || null,
      salePrice: product.SalePrice || null,
      currency: null, // Cin7 doesn't expose currency per item; falls back to org currency
      status:
        (product.Status?.toUpperCase() as any) === "ACTIVE"
          ? "ACTIVE"
          : product.Status?.toUpperCase() === "DISCONTINUED"
            ? "DISCONTINUED"
            : null,
    });
  }

  // Parse stock levels
  const stockLevels: RawStockLevel[] = input.stockItems.map((stock) => ({
    itemExternalId: stock.ProductID,
    warehouseExternalId: stock.LocationID,
    quantity: stock.QtyOnHand,
  }));

  // Parse purchase orders
  const purchaseOrders: RawPurchaseOrder[] = input.purchases.map((po) => ({
    externalId: po.ID,
    poNumber: po.PurchaseNumber,
    supplierExternalId: po.SupplierID,
    status: normalizePOStatus(po.Status),
    orderDate: po.OrderDate || null,
    expectedDate: po.ExpectedDate || null,
    currency: po.Currency || null,
    notes: po.Notes || null,
    lines: (po.Lines || []).map((line) => ({
      itemExternalId: line.ProductID,
      quantity: line.Quantity,
      unitCost: line.UnitCost || null,
    })),
  }));

  // Parse attachments
  const attachments: RawAttachment[] = [];
  for (const [productId, atts] of Object.entries(input.attachmentsByProduct)) {
    for (const att of atts) {
      attachments.push({
        itemExternalId: productId,
        sourceRef: att.FileUrl, // URL to download from Cin7
        filename: att.FileName,
        mimeType: att.MimeType || null,
      });
    }
  }

  return {
    source: "CIN7",
    parsedAt: new Date().toISOString(),
    categories: [], // Cin7 doesn't have categories
    suppliers,
    warehouses,
    locations: [], // Cin7 locations are warehouses, not bins
    customFieldDefs: [],
    items,
    stockLevels,
    purchaseOrders,
    attachments,
    adapterWarnings,
  };
}

/**
 * Normalize Cin7 PO status to OneAce canonical values.
 */
function normalizePOStatus(cin7Status: string): string {
  const normalized = cin7Status?.toUpperCase() || "";

  // Cin7 statuses: DRAFT, OPEN, RECEIVED, CLOSED, CANCELLED
  const map: Record<string, string> = {
    DRAFT: "DRAFT",
    OPEN: "OPEN",
    RECEIVED: "RECEIVED",
    CLOSED: "CLOSED",
    CANCELLED: "CANCELLED",
  };

  return map[normalized] || cin7Status || "OPEN";
}

/**
 * Format supplier address from components.
 */
function formatAddress(s: {
  Address?: string;
  AddressLine2?: string;
  City?: string;
  State?: string;
  Postcode?: string;
  Country?: string;
}): string | null {
  const parts = [];
  if (s.Address) parts.push(s.Address);
  if (s.AddressLine2) parts.push(s.AddressLine2);
  if (s.City) parts.push(s.City);
  if (s.State) parts.push(s.State);
  if (s.Postcode) parts.push(s.Postcode);
  if (s.Country) parts.push(s.Country);

  return parts.length > 0 ? parts.join(", ") : null;
}
