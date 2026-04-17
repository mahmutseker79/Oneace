/**
 * Phase MIG-S2 — inFlow CSV parser.
 *
 * Parses inFlow's multi-CSV export (Products, Vendors, StockLevels, POs).
 */

import type {
  ParsedSnapshot,
  RawCategory,
  RawItem,
  RawPurchaseOrder,
  RawPurchaseOrderLine,
  RawStockLevel,
  RawSupplier,
  RawWarehouse,
} from "@/lib/migrations/core/types";

export function parseInflowCSV(fileMap: Map<string, Record<string, string>[]>): ParsedSnapshot {
  const categories: RawCategory[] = [];
  const suppliers: RawSupplier[] = [];
  const warehouses: RawWarehouse[] = [];
  const items: RawItem[] = [];
  const stockLevels: RawStockLevel[] = [];
  const purchaseOrders: RawPurchaseOrder[] = [];

  // Add default warehouse (inFlow may not export locations).
  warehouses.push({
    externalId: "inflow-default-warehouse",
    name: "Default Warehouse",
    isDefault: true,
  });

  // Parse Products.csv.
  const productsRows = fileMap.get("products.csv") || [];
  const productMap = new Map<string, string>(); // SKU → category

  for (const row of productsRows) {
    const sku = row.SKU || row.sku;
    const name = row.ProductName || row.productname;
    const category = row.Category || row.category;
    const defaultVendor = row.DefaultVendor || row.defaultvendor;
    const cost = Number.parseFloat(row.Cost || "0");
    const price = Number.parseFloat(row.Price || "0");
    const reorderPoint = Number.parseFloat(row.ReorderPoint || "0");
    const description = row.Description || row.description;

    if (sku && name) {
      // Track category.
      if (category && !categories.find((c) => c.name === category)) {
        categories.push({
          externalId: `inflow-cat-${category}`,
          name: category,
          parentExternalId: null,
        });
      }
      if (category) productMap.set(sku, `inflow-cat-${category}`);

      items.push({
        externalId: `inflow-product-${sku}`,
        sku,
        name,
        description,
        costPrice: cost || undefined,
        salePrice: price || undefined,
        reorderPoint: reorderPoint || undefined,
        categoryExternalId: category ? `inflow-cat-${category}` : undefined,
        preferredSupplierExternalId: defaultVendor ? `inflow-vendor-${defaultVendor}` : undefined,
      });
    }
  }

  // Parse Vendors.csv.
  const vendorsRows = fileMap.get("vendors.csv") || [];
  for (const row of vendorsRows) {
    const name = row.VendorName || row.vendorname;
    if (name) {
      suppliers.push({
        externalId: `inflow-vendor-${name}`,
        name,
        contactName: row.ContactName || row.contactname,
        email: row.Email || row.email,
        phone: row.Phone || row.phone,
      });
    }
  }

  // Parse StockLevels.csv.
  const stockRows = fileMap.get("stocklevels.csv") || [];
  for (const row of stockRows) {
    const sku = row.SKU || row.sku;
    const location = row.Location || row.location;
    const qty = Number.parseFloat(row.Quantity || "0");

    if (sku) {
      stockLevels.push({
        itemExternalId: `inflow-product-${sku}`,
        warehouseExternalId: "inflow-default-warehouse",
        quantity: qty || 0,
      });
    }
  }

  // Parse PurchaseOrders.csv + PurchaseOrderItems.csv.
  const poRows = fileMap.get("purchaseorders.csv") || [];
  const poLineRows = fileMap.get("purchaseorderitems.csv") || [];

  const poLineMap = new Map<string, RawPurchaseOrderLine[]>();
  for (const lineRow of poLineRows) {
    const poId = lineRow.PurchaseOrderID || lineRow.purchaseorderid;
    const sku = lineRow.SKU || lineRow.sku;
    const qty = Number.parseFloat(lineRow.Quantity || "0");
    const cost = Number.parseFloat(lineRow.UnitCost || "0");

    if (poId && sku) {
      if (!poLineMap.has(poId)) {
        poLineMap.set(poId, []);
      }
      poLineMap.get(poId)?.push({
        itemExternalId: `inflow-product-${sku}`,
        quantity: qty,
        unitCost: cost || undefined,
      });
    }
  }

  for (const row of poRows) {
    const poId = row.PurchaseOrderID || row.purchaseorderid;
    const poNumber = row.PONumber || row.ponumber;
    const vendor = row.Vendor || row.vendor;
    const status = row.Status || row.status;
    const orderDate = row.OrderDate || row.orderdate;

    if (poId && poNumber && vendor) {
      purchaseOrders.push({
        externalId: `inflow-po-${poId}`,
        poNumber,
        supplierExternalId: `inflow-vendor-${vendor}`,
        status: status || "PENDING",
        orderDate: orderDate || undefined,
        lines: poLineMap.get(poId) || [],
      });
    }
  }

  return {
    source: "INFLOW",
    parsedAt: new Date().toISOString(),
    categories,
    suppliers,
    warehouses,
    locations: [],
    customFieldDefs: [],
    items,
    stockLevels,
    purchaseOrders,
    attachments: [],
    adapterWarnings: [],
  };
}
