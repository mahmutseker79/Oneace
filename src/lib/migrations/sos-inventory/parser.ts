/**
 * Phase MIG-S5 — SOS Inventory snapshot parser.
 */

import type {
  ParsedSnapshot,
  RawItem,
  RawStockLevel,
  RawSupplier,
  RawWarehouse,
  RawPurchaseOrder,
} from "@/lib/migrations/core/types";
import type {
  SOSItem,
  SOSVendor,
  SOSLocation,
  SOSInventoryLocation,
  SOSPurchaseOrder,
} from "@/lib/migrations/sos-inventory/api-client";

interface SOSSnapshotInput {
  items: SOSItem[];
  vendors: SOSVendor[];
  locations: SOSLocation[];
  inventoryLocations: SOSInventoryLocation[];
  purchaseOrders: SOSPurchaseOrder[];
}

export function parseSOSSnapshot(input: SOSSnapshotInput): ParsedSnapshot {
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
    currency: null, // SOS doesn't expose currency per vendor
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

  // Parse items
  const items: RawItem[] = [];
  for (const item of input.items) {
    if (!item.sku || item.sku.trim() === "") {
      adapterWarnings.push(
        `Item "${item.name}" (ID: ${item.id}) skipped: missing SKU`,
      );
      continue;
    }

    items.push({
      externalId: item.id,
      sku: item.sku,
      name: item.name,
      barcode: item.barcode || null,
      description: item.description || null,
      unit: item.unit || null,
      costPrice: item.costPrice || null,
      salePrice: item.salePrice || null,
      currency: null,
      status:
        item.status?.toUpperCase() === "ACTIVE"
          ? "ACTIVE"
          : item.status?.toUpperCase() === "DISCONTINUED"
            ? "DISCONTINUED"
            : null,
    });
  }

  // Parse stock levels
  const stockLevels: RawStockLevel[] = input.inventoryLocations.map(
    (inv) => ({
      itemExternalId: inv.itemId,
      warehouseExternalId: inv.locationId,
      quantity: inv.quantity,
    }),
  );

  // Parse purchase orders
  const purchaseOrders: RawPurchaseOrder[] = input.purchaseOrders.map(
    (po) => ({
      externalId: po.id,
      poNumber: po.poNumber,
      supplierExternalId: po.vendorId,
      status: normalizeSOSPOStatus(po.status),
      orderDate: po.orderDate || null,
      expectedDate: po.expectedDate || null,
      currency: null,
      notes: po.notes || null,
      lines: (po.lines || []).map((line) => ({
        itemExternalId: line.itemId,
        quantity: line.quantity,
        unitCost: line.unitCost || null,
      })),
    }),
  );

  return {
    source: "SOS_INVENTORY",
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
 * Normalize SOS PO status to canonical values.
 */
function normalizeSOSPOStatus(sosStatus: string): string {
  const normalized = sosStatus?.toUpperCase() || "";

  const map: Record<string, string> = {
    DRAFT: "DRAFT",
    OPEN: "OPEN",
    RECEIVED: "RECEIVED",
    CLOSED: "CLOSED",
    CANCELLED: "CANCELLED",
  };

  return map[normalized] || sosStatus || "OPEN";
}
