/**
 * Phase QBD-4 — QuickBooks Desktop Migration Adapter.
 *
 * Handles both IIF (Intuit Interchange Format) and QBXML exports from QB Desktop.
 * Parses items, vendors, purchase orders, and categories.
 *
 * Key design points:
 *   - IIF is the primary format (tab-delimited, Windows-1252 encoding)
 *   - QBXML is a secondary fallback (XML-based)
 *   - PO splits are stitched to their parent PO records
 *   - Inactive items (HIDDEN=Y) are tagged with status=ARCHIVED
 *   - Categories are inferred from CLASS records
 *   - Scope options are respected (archived items, PO history filters)
 */

import type { MigrationAdapter, UploadedFile } from "@/lib/migrations/core/adapter";
import type {
  FileDetectionResult,
  FieldMapping,
  ParsedSnapshot,
  ValidationIssue,
  ValidationReport,
  RawItem,
  RawSupplier,
  RawCategory,
  RawPurchaseOrder,
} from "@/lib/migrations/core/types";
import {
  parseIifFile,
  getIifField,
  stitchPoSplits,
  type IifDocument,
} from "@/lib/migrations/quickbooks-desktop/iif-parser";
import {
  parseQbxmlFile,
  type QbxmlDocument,
} from "@/lib/migrations/quickbooks-desktop/qbxml-parser";
import { parseDateFlexible } from "@/lib/migrations/core/date-utils";
import { parseDecimalLocaleAware } from "@/lib/migrations/core/csv-utils";
import { getQbdDefaultMappings } from "@/lib/migrations/quickbooks-desktop/default-mappings";
import { sortCategoriesByParent } from "@/lib/migrations/core/topological-sort";

export const QBD_ADAPTER: MigrationAdapter = {
  source: "QUICKBOOKS_DESKTOP",
  method: "CSV", // Treat IIF as CSV variant for UI purposes
  supportedFiles: ["*.iif", "*.IIF", "*.xml", "*.QBXML", "*.qbxml"],

  async detectFiles(files: UploadedFile[]): Promise<FileDetectionResult[]> {
    const results: FileDetectionResult[] = [];

    for (const file of files) {
      const filename = file.filename.toLowerCase();
      let entity: FileDetectionResult["entity"] = "UNKNOWN";
      let confidence = 0;

      // IIF files are QB Desktop exports.
      if (filename.endsWith(".iif")) {
        entity = "UNKNOWN"; // IIF is multi-entity
        confidence = 0.99;
      }
      // QBXML files are XML exports.
      else if (
        filename.endsWith(".xml") ||
        filename.endsWith(".qbxml")
      ) {
        // Try to detect if it's QBXML by checking for markers.
        const preview = file.buffer.toString("utf-8", 0, Math.min(1000, file.buffer.length));
        if (preview.includes("<QBXML>") || preview.includes("ItemInventoryRet")) {
          entity = "UNKNOWN";
          confidence = 0.85;
        } else {
          // Generic XML; low confidence.
          confidence = 0.3;
        }
      }

      results.push({
        fileRef: file.filename,
        entity,
        confidence,
        matchedHeaders: confidence > 0 ? ["QB Desktop export"] : [],
      });
    }

    return results;
  },

  async parse(files: UploadedFile[]): Promise<ParsedSnapshot> {
    const snapshot: ParsedSnapshot = {
      source: "QUICKBOOKS_DESKTOP",
      parsedAt: new Date().toISOString(),
      categories: [],
      suppliers: [],
      warehouses: [],
      locations: [],
      customFieldDefs: [],
      items: [],
      stockLevels: [],
      purchaseOrders: [],
      attachments: [],
      adapterWarnings: [],
    };

    // Separate IIF and QBXML files.
    const iifFiles = files.filter((f) =>
      f.filename.toLowerCase().endsWith(".iif")
    );
    const qbxmlFiles = files.filter((f) => {
      const lower = f.filename.toLowerCase();
      return (
        (lower.endsWith(".xml") || lower.endsWith(".qbxml")) &&
        f.buffer.toString("utf-8", 0, Math.min(500, f.buffer.length)).includes("QBXML")
      );
    });

    // Parse IIF files (primary).
    if (iifFiles.length > 0) {
      const iifSnapshot = parseIifExports(iifFiles);
      mergeSnapshots(snapshot, iifSnapshot);
    }

    // Parse QBXML files (secondary fallback).
    if (qbxmlFiles.length > 0 && snapshot.items.length === 0) {
      const qbxmlSnapshot = parseQbxmlExports(qbxmlFiles);
      mergeSnapshots(snapshot, qbxmlSnapshot);
    }

    // If no data parsed, throw.
    if (
      snapshot.items.length === 0 &&
      snapshot.suppliers.length === 0 &&
      snapshot.purchaseOrders.length === 0
    ) {
      throw new Error(
        "No valid QB Desktop export files found. Expected .iif or .qbxml files."
      );
    }

    return snapshot;
  },

  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[] {
    return getQbdDefaultMappings(snapshot);
  },

  validate(
    snapshot: ParsedSnapshot,
    mappings: FieldMapping[],
    scope: any
  ): ValidationReport {
    const issues: ValidationIssue[] = [];
    const totals: Record<string, { rows: number; errors: number; warnings: number }> = {
      items: { rows: snapshot.items.length, errors: 0, warnings: 0 },
      suppliers: { rows: snapshot.suppliers.length, errors: 0, warnings: 0 },
      categories: { rows: snapshot.categories.length, errors: 0, warnings: 0 },
      purchaseOrders: { rows: snapshot.purchaseOrders.length, errors: 0, warnings: 0 },
    };

    // Validate items.
    const skus = new Set<string>();
    for (const item of snapshot.items) {
      if (!item.sku || item.sku.trim() === "") {
        issues.push({
          severity: "ERROR",
          entity: "ITEM",
          externalId: item.externalId,
          field: "sku",
          code: "ITEM_MISSING_SKU",
          message: `Item "${item.name || item.externalId}" is missing a SKU`,
        });
        totals.items.errors++;
      } else if (skus.has(item.sku)) {
        issues.push({
          severity: "WARNING",
          entity: "ITEM",
          externalId: item.externalId,
          field: "sku",
          code: "DUPLICATE_SKU",
          message: `Item "${item.name}" has duplicate SKU "${item.sku}"`,
        });
        totals.items.warnings++;
      } else {
        skus.add(item.sku);
      }
    }

    // Validate suppliers.
    const supplierIds = new Set(snapshot.suppliers.map((s) => s.externalId));
    for (const supplier of snapshot.suppliers) {
      if (!supplier.name || supplier.name.trim() === "") {
        issues.push({
          severity: "ERROR",
          entity: "SUPPLIER",
          externalId: supplier.externalId,
          field: "name",
          code: "SUPPLIER_MISSING_NAME",
          message: `Supplier is missing a name`,
        });
        totals.suppliers.errors++;
      }
    }

    // Validate categories (parent references).
    const categoryIds = new Set(snapshot.categories.map((c) => c.externalId));
    for (const cat of snapshot.categories) {
      if (cat.parentExternalId && !categoryIds.has(cat.parentExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "CATEGORY",
          externalId: cat.externalId,
          field: "parentExternalId",
          code: "CATEGORY_PARENT_NOT_FOUND",
          message: `Category "${cat.name}" references unknown parent ${cat.parentExternalId}`,
        });
        totals.categories.warnings++;
      }
    }

    // Check for category cycles.
    if (snapshot.categories.length > 0) {
      const sortResult = sortCategoriesByParent(snapshot.categories);
      issues.push(...sortResult.issues);
      totals.categories.errors += sortResult.issues.filter(
        (i) => i.severity === "ERROR"
      ).length;
      totals.categories.warnings += sortResult.issues.filter(
        (i) => i.severity === "WARNING"
      ).length;
    }

    // Validate purchase orders.
    for (const po of snapshot.purchaseOrders) {
      if (!supplierIds.has(po.supplierExternalId)) {
        issues.push({
          severity: "WARNING",
          entity: "PURCHASE_ORDER",
          externalId: po.externalId,
          field: "supplierExternalId",
          code: "PO_SUPPLIER_NOT_FOUND",
          message: `PO ${po.poNumber} references unknown supplier ${po.supplierExternalId}`,
        });
        totals.purchaseOrders.warnings++;
      }

      // Validate PO lines reference existing items.
      const itemIds = new Set(snapshot.items.map((i) => i.externalId));
      for (const line of po.lines) {
        if (!itemIds.has(line.itemExternalId)) {
          issues.push({
            severity: "WARNING",
            entity: "PURCHASE_ORDER",
            externalId: po.externalId,
            field: "lines",
            code: "PO_ITEM_NOT_FOUND",
            message: `PO ${po.poNumber} line references unknown item ${line.itemExternalId}`,
          });
          totals.purchaseOrders.warnings++;
        }
      }
    }

    // Respect scope: filter archived items if scope says to exclude them.
    if (scope?.includeArchivedItems === false) {
      for (const item of snapshot.items) {
        if (item.status === "ARCHIVED") {
          issues.push({
            severity: "INFO",
            entity: "ITEM",
            externalId: item.externalId,
            code: "ITEM_ARCHIVED_EXCLUDED",
            message: `Item "${item.name}" is archived and will be skipped (scope: includeArchivedItems=false)`,
          });
        }
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      totals,
      issues,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Parsing Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse IIF files into a partial snapshot.
 */
function parseIifExports(files: UploadedFile[]): ParsedSnapshot {
  const snapshot: ParsedSnapshot = {
    source: "QUICKBOOKS_DESKTOP",
    parsedAt: new Date().toISOString(),
    categories: [],
    suppliers: [],
    warehouses: [],
    locations: [],
    customFieldDefs: [],
    items: [],
    stockLevels: [],
    purchaseOrders: [],
    attachments: [],
    adapterWarnings: [],
  };

  // Parse all IIF files and merge.
  let mergedByType = new Map<string, any[]>();

  for (const file of files) {
    const iif = parseIifFile(file.buffer);
    snapshot.adapterWarnings.push(...iif.warnings);

    // Merge records by type.
    for (const [type, records] of iif.recordsByType) {
      if (!mergedByType.has(type)) {
        mergedByType.set(type, []);
      }
      mergedByType.get(type)!.push(...records);
    }
  }

  // Process each record type.
  const classMap = new Map<string, string>(); // CLASS name → externalId

  // 1. Parse CLASS records → categories.
  const classRecords = mergedByType.get("CLASS") || [];
  for (const record of classRecords) {
    const name = getIifField(record, "NAME");
    if (name) {
      const externalId = `qbd_class_${name}`;
      classMap.set(name, externalId);
      snapshot.categories.push({
        externalId,
        name,
        parentExternalId: null,
        description: null,
      });
    }
  }

  // 2. Parse INVITEM records → items.
  const invitemRecords = mergedByType.get("INVITEM") || [];
  for (const record of invitemRecords) {
    const name = getIifField(record, "NAME");

    // All records in INVITEM section are inventory items (non-inventory items
    // are in NONINVITEM or SERV sections, which we skip at record-type level).
    if (!name) continue;

    const sku = getIifField(record, "SKU") || name; // Fallback to name if no SKU.
    const desc = getIifField(record, "DESC");
    const price = parseDecimalLocaleAware(getIifField(record, "PRICE"));
    const cost = parseDecimalLocaleAware(getIifField(record, "COST"));
    const reorder = parseDecimalLocaleAware(getIifField(record, "REORDERPOINT")) ?? 0;
    const hidden = getIifField(record, "HIDDEN");
    const itemClass = getIifField(record, "CLASS");

    // Warn if SKU was generated.
    if (!getIifField(record, "SKU")) {
      snapshot.adapterWarnings.push(
        `Generated SKU "${sku}" for item "${name}" (no SKU field in IIF)`
      );
    }

    const item: RawItem = {
      externalId: name,
      sku,
      name,
      description: desc || null,
      salePrice: price,
      costPrice: cost,
      reorderPoint: reorder > 0 ? reorder : undefined,
      status: hidden === "Y" ? "ARCHIVED" : "ACTIVE",
      categoryExternalId: itemClass ? classMap.get(itemClass) : null,
    };

    snapshot.items.push(item);
  }

  // 3. Parse VEND records → suppliers.
  const vendRecords = mergedByType.get("VEND") || [];
  for (const record of vendRecords) {
    const name = getIifField(record, "NAME");
    if (!name) continue;

    // Concatenate address components.
    const addr1 = getIifField(record, "BADDR1") || "";
    const addr2 = getIifField(record, "BADDR2") || "";
    const city = getIifField(record, "BADDR3") || "";
    const state = getIifField(record, "BADDR4") || "";
    const zip = getIifField(record, "BADDR5") || "";
    const address = [addr1, addr2, city, state, zip]
      .filter(Boolean)
      .join(", ")
      .trim() || null;

    const supplier = {
      externalId: name,
      name,
      contactName: getIifField(record, "CONTACT") || null,
      email: getIifField(record, "EMAIL") || null,
      phone: getIifField(record, "PHONE1") || null,
      address,
      notes: null,
    };

    snapshot.suppliers.push(supplier);
  }

  // 4. Parse PURCHORDR + SPL records → purchase orders.
  const poRecords = mergedByType.get("PURCHORDR") || [];
  const poSplitMap = stitchPoSplits(mergedByType);

  for (const record of poRecords) {
    const vendName = getIifField(record, "NAME");
    const docNum = getIifField(record, "DOCNUM");
    const txnId = getIifField(record, "TRNSID") || docNum;
    const date = getIifField(record, "DATE");
    const memo = getIifField(record, "MEMO");

    if (!vendName || !docNum) continue;

    const poId = txnId || vendName;
    const splits = poSplitMap.get(poId) || [];

    const lines = splits
      .map((split) => {
        // SPL rows have ITEM or ACCNT references. OneAce only cares about ITEM splits.
        // split is already a Record<string, string> of field values.
        const itemName = split["NAME"] || split["ITEM"];
        const qty = parseDecimalLocaleAware(split["QNTY"]) ?? 0;
        const amount = parseDecimalLocaleAware(split["AMOUNT"]) ?? 0;

        // Derive unit cost: amount / qty or explicit UNITCOST field.
        let unitCost = parseDecimalLocaleAware(split["UNITCOST"]);
        if (!unitCost && qty > 0 && amount) {
          unitCost = amount / qty;
        }

        return {
          itemExternalId: itemName || "",
          quantity: qty > 0 ? qty : 0,
          unitCost: unitCost || undefined,
        };
      })
      .filter((line) => line.itemExternalId && line.quantity > 0);

    const po: RawPurchaseOrder = {
      externalId: txnId || vendName,
      poNumber: docNum,
      supplierExternalId: vendName,
      status: "PENDING",
      orderDate: date ? parseDateFlexible(date) : null,
      notes: memo || null,
      lines,
    };

    snapshot.purchaseOrders.push(po);
  }

  return snapshot;
}

/**
 * Parse QBXML files into a partial snapshot (fallback).
 */
function parseQbxmlExports(files: UploadedFile[]): ParsedSnapshot {
  const snapshot: ParsedSnapshot = {
    source: "QUICKBOOKS_DESKTOP",
    parsedAt: new Date().toISOString(),
    categories: [],
    suppliers: [],
    warehouses: [],
    locations: [],
    customFieldDefs: [],
    items: [],
    stockLevels: [],
    purchaseOrders: [],
    attachments: [],
    adapterWarnings: [],
  };

  for (const file of files) {
    const qbxml = parseQbxmlFile(file.buffer);
    snapshot.adapterWarnings.push(...qbxml.warnings);

    // Convert QBXML items → RawItem.
    for (const item of qbxml.items) {
      snapshot.items.push({
        externalId: item.ListID,
        sku: item.SKU || item.Name,
        name: item.Name,
        description: item.Description || null,
        salePrice: item.UnitPrice || null,
        costPrice: item.Cost || null,
        status: item.IsActive ? "ACTIVE" : "ARCHIVED",
      });
    }

    // Convert QBXML vendors → RawSupplier.
    for (const vendor of qbxml.vendors) {
      snapshot.suppliers.push({
        externalId: vendor.ListID,
        name: vendor.Name,
        contactName: vendor.Contact || null,
        email: vendor.Email || null,
        phone: vendor.Phone || null,
        address: vendor.Address || null,
      });
    }

    // Convert QBXML POs → RawPurchaseOrder.
    for (const po of qbxml.purchaseOrders) {
      snapshot.purchaseOrders.push({
        externalId: po.TxnID,
        poNumber: po.RefNumber,
        supplierExternalId: po.VendorID,
        status: "PENDING",
        orderDate: po.TxnDate ? parseDateFlexible(po.TxnDate) : null,
        notes: po.Memo || null,
        lines: po.LineItems.map((line) => ({
          itemExternalId: line.ItemID,
          quantity: line.Quantity,
          unitCost: line.UnitCost || undefined,
        })),
      });
    }
  }

  return snapshot;
}

/**
 * Merge two partial snapshots (IIF + QBXML can coexist in same export).
 */
function mergeSnapshots(target: ParsedSnapshot, source: ParsedSnapshot): void {
  target.categories.push(...source.categories);
  target.suppliers.push(...source.suppliers);
  target.warehouses.push(...source.warehouses);
  target.locations.push(...source.locations);
  target.customFieldDefs.push(...source.customFieldDefs);
  target.items.push(...source.items);
  target.stockLevels.push(...source.stockLevels);
  target.purchaseOrders.push(...source.purchaseOrders);
  target.attachments.push(...source.attachments);
  target.adapterWarnings.push(...source.adapterWarnings);
}
