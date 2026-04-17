/**
 * Phase MIG-QBO — QuickBooks Online snapshot parser.
 *
 * Maps QBO API responses into the canonical Raw* types that the
 * importer understands. Handles:
 *   - Items → RawItem (with SubItem hierarchy → categories)
 *   - Vendors → RawSupplier
 *   - Purchase Orders → RawPurchaseOrder
 *   - Stock levels (inferred from QtyOnHand)
 */

import type { QBOItem, QBOVendor, QBOPurchaseOrder } from "@/lib/integrations/quickbooks/qbo-client";
import type {
  RawItem,
  RawSupplier,
  RawCategory,
  RawPurchaseOrder,
  RawStockLevel,
  ParsedSnapshot,
} from "@/lib/migrations/core/types";
import type { MigrationSource } from "@/generated/prisma";

/**
 * Build a category hierarchy from QBO's SubItem structure.
 * QBO Items with ParentRef form a tree; we flatten it into OneAce categories.
 *
 * Returns a map of { parentExternalId → { id, name } } for later RawCategory creation.
 */
export function buildCategoriesFromItems(items: QBOItem[]): Map<string, RawCategory> {
  const categories = new Map<string, RawCategory>();
  const itemsById = new Map(items.map((i) => [i.id, i]));

  // Walk the parent chain for each item to identify distinct category nodes
  const parentChains = new Set<string>();

  for (const item of items) {
    // QBO doesn't have a native ParentRef on items in the API response we're reading,
    // but some inventory systems do. For now, we skip this optimization.
    // If QBO adds it later, walk the chain: item -> parent -> grandparent, etc.
    // and create a category for each unique parent name.
  }

  return categories;
}

/**
 * Parse a single QBO Item into a RawItem.
 * Skips Service items (not inventory).
 * Generates SKU from Name if missing (with warning).
 */
export function parseQboItem(item: QBOItem): RawItem | null {
  // Skip Service items
  if (item.type === "SERVICE") {
    return null; // Caller handles the warning
  }

  // Name is required
  if (!item.name || item.name.trim() === "") {
    return null; // Invalid item
  }

  // Generate SKU if missing
  let sku = item.sku || "";
  const generatedSku = sku === "";
  if (generatedSku) {
    sku = item.name
      .substring(0, 12)
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toUpperCase();
  }

  return {
    externalId: item.id,
    sku,
    name: item.name,
    barcode: undefined, // QBO items don't expose barcode in the API
    description: item.description || null,
    unit: undefined, // QBO doesn't track unit of measure on items in the standard API
    costPrice: item.purchaseCost || null,
    salePrice: item.unitPrice || null,
    currency: undefined, // Inherit from org; QBO is per-realm, not per-item
    reorderPoint: undefined, // Not in QBO item API
    reorderQty: undefined,
    status: item.active ? "ACTIVE" : "ARCHIVED",
    categoryExternalId: null, // No category mapping in basic QBO item export
    preferredSupplierExternalId: null, // Not exposed in QBO items
    customFieldValues: null,
  };
}

/**
 * Parse a single QBO Vendor into a RawSupplier.
 */
export function parseQboVendor(vendor: QBOVendor): RawSupplier {
  // Concatenate address parts
  const address = vendor.billingAddress
    ? [vendor.billingAddress.line1, vendor.billingAddress.line2, vendor.billingAddress.city, vendor.billingAddress.postalCode]
        .filter(Boolean)
        .join(", ")
    : null;

  return {
    externalId: vendor.id,
    name: vendor.displayName,
    contactName: vendor.givenName && vendor.familyName ? `${vendor.givenName} ${vendor.familyName}` : null,
    email: vendor.email || null,
    phone: vendor.phone || null,
    website: vendor.website || null,
    address: address || null,
    currency: vendor.currencyCode || null,
    notes: null, // QBO doesn't expose vendor notes in the API response
  };
}

/**
 * Parse a single QBO PurchaseOrder into a RawPurchaseOrder.
 * Maps status: Open → OPEN, Closed → RECEIVED, Draft → DRAFT.
 */
export function parseQboPurchaseOrder(po: QBOPurchaseOrder): RawPurchaseOrder {
  // Map QBO status to OneAce enum
  const statusMap: Record<string, string> = {
    OPEN: "OPEN",
    CLOSED: "RECEIVED",
    DRAFT: "DRAFT",
  };
  const poStatus = statusMap[po.status] || "DRAFT";

  return {
    externalId: po.id,
    poNumber: po.docNumber,
    supplierExternalId: po.vendorId,
    status: poStatus,
    orderDate: po.txnDate || null,
    expectedDate: po.dueDate || null,
    currency: po.currencyCode || null,
    notes: po.memo || null,
    lines: (po.lineItems || []).map((line) => ({
      itemExternalId: line.itemId || "",
      quantity: line.quantity || 0,
      unitCost: line.unitPrice || null,
    })),
  };
}

/**
 * Aggregate QBO data into a ParsedSnapshot.
 * This is called by the adapter after fetching all entities from QBO.
 */
export function parseQboSnapshot(qboData: {
  items: QBOItem[];
  vendors: QBOVendor[];
  purchaseOrders: QBOPurchaseOrder[];
}): ParsedSnapshot {
  const warnings: string[] = [];

  // Parse items
  const items: RawItem[] = [];
  let skippedServices = 0;
  let generatedSkus = 0;

  for (const item of qboData.items) {
    if (item.type === "SERVICE") {
      skippedServices++;
      continue;
    }

    const parsed = parseQboItem(item);
    if (!parsed) continue;

    // Track SKU generation
    if (parsed.sku !== item.sku && item.sku === undefined) {
      generatedSkus++;
    }

    items.push(parsed);
  }

  if (skippedServices > 0) {
    warnings.push(`Skipped ${skippedServices} Service items (OneAce uses Items for inventory only)`);
  }

  if (generatedSkus > 0) {
    warnings.push(`Generated SKUs for ${generatedSkus} items that had no SKU; check validity after import`);
  }

  // Parse vendors/suppliers
  const suppliers = qboData.vendors.map(parseQboVendor);

  // Parse purchase orders
  const purchaseOrders = qboData.purchaseOrders.map(parseQboPurchaseOrder);

  // Infer stock levels from items (QtyOnHand if present)
  const stockLevels: RawStockLevel[] = [];
  for (const item of qboData.items) {
    if (item.qtyOnHand != null && item.qtyOnHand !== 0) {
      // Default warehouse — the importer will resolve this to the first/default warehouse
      // using warehouseExternalId = "qbo_default"
      stockLevels.push({
        itemExternalId: item.id,
        warehouseExternalId: "qbo_default",
        quantity: item.qtyOnHand,
      });
    }
  }

  return {
    source: "QUICKBOOKS_ONLINE",
    parsedAt: new Date().toISOString(),
    categories: [], // No category mapping from QBO at this time
    suppliers,
    warehouses: [
      {
        externalId: "qbo_default",
        name: "Default (from QBO)",
        code: "QBO",
        isDefault: true,
      },
    ],
    locations: [],
    customFieldDefs: [],
    items,
    stockLevels,
    purchaseOrders,
    attachments: [],
    adapterWarnings: warnings,
  };
}
