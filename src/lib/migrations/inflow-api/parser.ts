/**
 * Phase MIG-S5 — inFlow Cloud API snapshot parser.
 */

import type {
  ParsedSnapshot,
  RawItem,
  RawPurchaseOrder,
  RawStockLevel,
  RawSupplier,
  RawWarehouse,
} from "@/lib/migrations/core/types";
import type {
  InflowLocation,
  InflowProduct,
  InflowPurchaseOrder,
  InflowStockLevel,
  InflowVendor,
} from "@/lib/migrations/inflow-api/api-client";

interface InflowApiSnapshotInput {
  products: InflowProduct[];
  vendors: InflowVendor[];
  locations: InflowLocation[];
  stockLevels: InflowStockLevel[];
  purchaseOrders: InflowPurchaseOrder[];
}

export function parseInflowApiSnapshot(input: InflowApiSnapshotInput): ParsedSnapshot {
  const adapterWarnings: string[] = [];

  // Parse vendors
  const suppliers: RawSupplier[] = input.vendors.map((v) => ({
    externalId: v.id,
    name: v.name,
    contactName: v.contactName || null,
    email: v.email || null,
    phone: v.phone || null,
    website: v.website || null,
    address: v.address || null,
    currency: null,
    notes: v.notes || null,
  }));

  // Parse locations (warehouses)
  const warehouses: RawWarehouse[] = input.locations.map((loc) => ({
    externalId: loc.id,
    name: loc.name,
    code: loc.code || null,
    address: loc.address || null,
    isDefault: loc.isDefault || false,
  }));

  // Parse products
  const items: RawItem[] = [];
  for (const product of input.products) {
    if (!product.sku || product.sku.trim() === "") {
      adapterWarnings.push(`Product "${product.name}" (ID: ${product.id}) skipped: missing SKU`);
      continue;
    }

    items.push({
      externalId: product.id,
      sku: product.sku,
      name: product.name,
      barcode: product.barcode || null,
      description: product.description || null,
      unit: product.unit || null,
      costPrice: product.costPrice || null,
      salePrice: product.salePrice || null,
      currency: null,
      status:
        product.status?.toUpperCase() === "ACTIVE"
          ? "ACTIVE"
          : product.status?.toUpperCase() === "DISCONTINUED"
            ? "ARCHIVED"
            : null,
    });
  }

  // Parse stock levels
  const stockLevels: RawStockLevel[] = input.stockLevels.map((stock) => ({
    itemExternalId: stock.productId,
    warehouseExternalId: stock.locationId,
    quantity: stock.quantity,
  }));

  // Parse purchase orders
  const purchaseOrders: RawPurchaseOrder[] = input.purchaseOrders.map((po) => ({
    externalId: po.id,
    poNumber: po.poNumber,
    supplierExternalId: po.vendorId,
    status: normalizeInflowPOStatus(po.status),
    orderDate: po.orderDate || null,
    expectedDate: po.expectedDate || null,
    currency: null,
    notes: po.notes || null,
    lines: (po.lines || []).map((line) => ({
      itemExternalId: line.productId,
      quantity: line.quantity,
      unitCost: line.unitCost || null,
    })),
  }));

  return {
    source: "INFLOW",
    parsedAt: new Date().toISOString(),
    categories: [],
    suppliers,
    warehouses,
    locations: [],
    customFieldDefs: [],
    items,
    stockLevels,
    purchaseOrders,
    attachments: [],
    adapterWarnings,
  };
}

/**
 * Normalize inFlow PO status to canonical values.
 */
function normalizeInflowPOStatus(inflowStatus: string): string {
  const normalized = inflowStatus?.toUpperCase() || "";

  const map: Record<string, string> = {
    DRAFT: "DRAFT",
    OPEN: "OPEN",
    RECEIVED: "RECEIVED",
    CLOSED: "CLOSED",
    CANCELLED: "CANCELLED",
  };

  return map[normalized] || inflowStatus || "OPEN";
}
