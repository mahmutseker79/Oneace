/**
 * Phase S6 — Fishbowl CSV parser.
 *
 * Fishbowl exports multiple CSV files with tabs/groups:
 *   - parts.csv: PartNumber, Description, Type, UOM, DefaultVendor, Price, Cost, Weight, Length, Width, Height
 *   - vendors.csv: VendorName, ContactName, Email, Phone, Address
 *   - locationgroups.csv: Group, Description
 *   - locations.csv: LocationName, LocationGroup, PickFromLocation
 *   - stocklevels.csv: PartNumber, Location, QtyOnHand, QtyAllocated, QtyAvailable
 *   - pos.csv: PO, Vendor, PODate, Status, Total
 *   - poitems.csv: PO, PartNumber, Qty, UnitCost
 *   - uomconversions.csv: FromUOM, ToUOM, ConversionFactor
 *
 * This parser detects files by flexible filename matching and converts them
 * into Raw* canonical types.
 */

import { parseDecimalLocaleAware } from "@/lib/migrations/core/csv-utils";
import { parseDateFlexible } from "@/lib/migrations/core/date-utils";
import type {
  ParsedSnapshot,
  RawCategory,
  RawItem,
  RawLocation,
  RawPurchaseOrder,
  RawPurchaseOrderLine,
  RawStockLevel,
  RawSupplier,
  RawWarehouse,
} from "@/lib/migrations/core/types";

/**
 * Parse Fishbowl CSV exports into canonical Raw* types.
 * Files are detected by flexible name matching (case-insensitive, suffix tolerance).
 *
 * @param allRows - Flattened rows from all detected CSV files, with filename metadata
 * @param allHeaders - Headers from each CSV
 * @returns Partial ParsedSnapshot; caller merges into final snapshot
 */
export function parseFishbowlCSVs(
  files: Array<{
    filename: string;
    headers: string[];
    rows: Record<string, string>[];
  }>,
): Partial<ParsedSnapshot> {
  const result: Partial<ParsedSnapshot> = {
    categories: [],
    suppliers: [],
    warehouses: [],
    locations: [],
    items: [],
    stockLevels: [],
    purchaseOrders: [],
    adapterWarnings: [],
  };

  const uomConversions = new Map<string, Record<string, number>>();

  for (const file of files) {
    const filename = file.filename.toLowerCase();

    // Detect file type by flexible matching.
    if (filename.includes("uom") && filename.includes("conversion")) {
      parseUOMConversions(file.rows, uomConversions);
    } else if (filename.includes("part")) {
      result.items = parsePartsCSV(file.headers, file.rows);
    } else if (filename.includes("vendor")) {
      result.suppliers = parseVendorsCSV(file.headers, file.rows);
    } else if (filename.includes("location") && !filename.includes("group")) {
      result.locations = parseLocationsCSV(file.headers, file.rows);
    } else if (filename.includes("location") && filename.includes("group")) {
      result.warehouses = parseLocationGroupsCSV(file.headers, file.rows);
    } else if (filename.includes("stock") && filename.includes("level")) {
      result.stockLevels = parseStockLevelsCSV(file.headers, file.rows);
    } else if (filename.includes("po") && !filename.includes("item")) {
      result.purchaseOrders = parsePOsCSV(file.headers, file.rows);
    } else if (filename.includes("po") && filename.includes("item")) {
      // Processed after POs so we have PO references.
      // Deferred to second pass.
    }
  }

  // Second pass: attach PO line items.
  for (const file of files) {
    const filename = file.filename.toLowerCase();
    if (filename.includes("po") && filename.includes("item")) {
      attachPOLineItems(file.headers, file.rows, result.purchaseOrders || []);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse parts.csv → RawItem[]
 * Columns: PartNumber, Description, Type, UOM, DefaultVendor, Price, Cost, Weight, Length, Width, Height
 */
function parsePartsCSV(headers: string[], rows: Record<string, string>[]): RawItem[] {
  const items: RawItem[] = [];

  for (const row of rows) {
    const partNumber =
      getColumn(row, headers, "PartNumber") || getColumn(row, headers, "Part Number");
    if (!partNumber || !partNumber.trim()) continue;

    const description = getColumn(row, headers, "Description") || "";
    const uom = getColumn(row, headers, "UOM") || null;
    const defaultVendor =
      getColumn(row, headers, "DefaultVendor") || getColumn(row, headers, "Default Vendor") || null;
    const price = parseDecimalLocaleAware(getColumn(row, headers, "Price"));
    const cost = parseDecimalLocaleAware(getColumn(row, headers, "Cost"));

    items.push({
      externalId: partNumber,
      sku: partNumber,
      name: description || partNumber,
      description: description || null,
      unit: uom,
      salePrice: price,
      costPrice: cost,
      preferredSupplierExternalId: defaultVendor,
    });
  }

  return items;
}

/**
 * Parse vendors.csv → RawSupplier[]
 * Columns: VendorName, ContactName, Email, Phone, Address
 */
function parseVendorsCSV(headers: string[], rows: Record<string, string>[]): RawSupplier[] {
  const suppliers: RawSupplier[] = [];

  for (const row of rows) {
    const vendorName =
      getColumn(row, headers, "VendorName") || getColumn(row, headers, "Vendor Name");
    if (!vendorName || !vendorName.trim()) continue;

    suppliers.push({
      externalId: vendorName,
      name: vendorName,
      contactName:
        getColumn(row, headers, "ContactName") || getColumn(row, headers, "Contact Name") || null,
      email: getColumn(row, headers, "Email") || null,
      phone: getColumn(row, headers, "Phone") || null,
      address: getColumn(row, headers, "Address") || null,
    });
  }

  return suppliers;
}

/**
 * Parse locationgroups.csv → RawWarehouse[]
 * Columns: Group, Description
 */
function parseLocationGroupsCSV(headers: string[], rows: Record<string, string>[]): RawWarehouse[] {
  const warehouses: RawWarehouse[] = [];

  for (const row of rows) {
    const group = getColumn(row, headers, "Group") || "";
    if (!group.trim()) continue;

    warehouses.push({
      externalId: group,
      name: group,
    });
  }

  return warehouses;
}

/**
 * Parse locations.csv → RawLocation[]
 * Columns: LocationName, LocationGroup, PickFromLocation
 */
function parseLocationsCSV(headers: string[], rows: Record<string, string>[]): RawLocation[] {
  const locations: RawLocation[] = [];

  for (const row of rows) {
    const locationName =
      getColumn(row, headers, "LocationName") || getColumn(row, headers, "Location Name");
    const locationGroup =
      getColumn(row, headers, "LocationGroup") || getColumn(row, headers, "Location Group");

    if (!locationName || !locationName.trim()) continue;

    locations.push({
      externalId: locationName,
      warehouseExternalId: locationGroup || "default",
      name: locationName,
    });
  }

  return locations;
}

/**
 * Parse stocklevels.csv → RawStockLevel[]
 * Columns: PartNumber, Location, QtyOnHand, QtyAllocated, QtyAvailable
 */
function parseStockLevelsCSV(headers: string[], rows: Record<string, string>[]): RawStockLevel[] {
  const levels: RawStockLevel[] = [];

  for (const row of rows) {
    const partNumber =
      getColumn(row, headers, "PartNumber") || getColumn(row, headers, "Part Number");
    const location = getColumn(row, headers, "Location");
    const qtyOnHand = parseDecimalLocaleAware(
      getColumn(row, headers, "QtyOnHand") || getColumn(row, headers, "Qty On Hand"),
    );

    if (!partNumber || !partNumber.trim()) continue;

    levels.push({
      itemExternalId: partNumber,
      warehouseExternalId: location || "default",
      locationExternalId: location || null,
      quantity: qtyOnHand ?? 0,
    });
  }

  return levels;
}

/**
 * Parse pos.csv → RawPurchaseOrder[]
 * Columns: PO, Vendor, PODate, Status, Total
 */
function parsePOsCSV(headers: string[], rows: Record<string, string>[]): RawPurchaseOrder[] {
  const pos: RawPurchaseOrder[] = [];

  for (const row of rows) {
    const po = getColumn(row, headers, "PO");
    const vendor = getColumn(row, headers, "Vendor");
    const poDate = getColumn(row, headers, "PODate") || getColumn(row, headers, "PO Date");
    const status = getColumn(row, headers, "Status") || "Pending";

    if (!po || !po.trim() || !vendor || !vendor.trim()) continue;

    const orderDate = poDate ? parseDateFlexible(poDate) : null;

    pos.push({
      externalId: po,
      poNumber: po,
      supplierExternalId: vendor,
      status: mapFishbowlPOStatus(status),
      orderDate: orderDate || null,
      lines: [],
    });
  }

  return pos;
}

/**
 * Parse poitems.csv → attach to existing POs.
 * Columns: PO, PartNumber, Qty, UnitCost
 */
function attachPOLineItems(
  headers: string[],
  rows: Record<string, string>[],
  pos: RawPurchaseOrder[],
): void {
  const poMap = new Map(pos.map((po) => [po.externalId, po]));

  for (const row of rows) {
    const po = getColumn(row, headers, "PO");
    const partNumber =
      getColumn(row, headers, "PartNumber") || getColumn(row, headers, "Part Number");
    const qty = parseDecimalLocaleAware(getColumn(row, headers, "Qty"));
    const unitCost = parseDecimalLocaleAware(
      getColumn(row, headers, "UnitCost") || getColumn(row, headers, "Unit Cost"),
    );

    if (!po || !po.trim() || !partNumber || !partNumber.trim()) continue;

    const poObj = poMap.get(po);
    if (poObj) {
      poObj.lines.push({
        itemExternalId: partNumber,
        quantity: qty ?? 1,
        unitCost: unitCost ?? 0,
      });
    }
  }
}

/**
 * Parse uomconversions.csv for reference.
 * Columns: FromUOM, ToUOM, ConversionFactor
 * Stores in a map for later UOM resolution.
 */
function parseUOMConversions(
  rows: Record<string, string>[],
  conversions: Map<string, Record<string, number>>,
): void {
  for (const row of rows) {
    const from = getColumn(row, ["FromUOM", "From UOM", "from_uom"], "FromUOM") || "";
    const to = getColumn(row, ["ToUOM", "To UOM", "to_uom"], "ToUOM") || "";
    const factor = parseDecimalLocaleAware(
      getColumn(
        row,
        ["ConversionFactor", "Conversion Factor", "conversion_factor"],
        "ConversionFactor",
      ),
    );

    if (!from || !to || !factor) continue;

    if (!conversions.has(from)) {
      conversions.set(from, {});
    }
    conversions.get(from)![to] = factor;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a column value by header name (case-insensitive, flexible matching).
 */
function getColumn(
  row: Record<string, string>,
  headers: string[],
  columnName: string,
): string | null {
  // Direct match (case-sensitive first for performance).
  if (row[columnName] !== undefined) return row[columnName] ?? null;

  // Case-insensitive match.
  const lower = columnName.toLowerCase();
  const matched = Object.keys(row).find((k) => k.toLowerCase() === lower);
  return matched ? (row[matched] ?? null) : null;
}

/**
 * Map Fishbowl PO status to OneAce PurchaseOrderStatus.
 * Fishbowl: Issued, Fulfilled, Received, Voided, Reviewed, Partial, Closed
 * OneAce: PENDING, CONFIRMED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED
 */
function mapFishbowlPOStatus(fbStatus: string): string {
  const upper = (fbStatus || "").toUpperCase();

  if (upper === "RECEIVED") return "RECEIVED";
  if (upper === "FULFILLED") return "RECEIVED";
  if (upper === "PARTIAL") return "PARTIALLY_RECEIVED";
  if (upper === "CLOSED") return "RECEIVED";
  if (upper === "VOIDED") return "CANCELLED";
  if (upper === "REVIEWED") return "CONFIRMED";
  if (upper === "ISSUED") return "PENDING";

  return "PENDING"; // Default.
}
