/**
 * Phase MIG-S2 — Sortly CSV parser.
 *
 * Parses Sortly's single-file CSV export into ParsedSnapshot.
 */

import { inferType } from "@/lib/migrations/core/csv-utils";
import type {
  ParsedSnapshot,
  RawCategory,
  RawCustomFieldDef,
  RawItem,
  RawStockLevel,
} from "@/lib/migrations/core/types";

export function parseSortlyCSV(headers: string[], rows: Record<string, string>[]): ParsedSnapshot {
  const categories = new Map<string, RawCategory>();
  const items: RawItem[] = [];
  const stockLevels: RawStockLevel[] = [];
  const customFieldDefs = new Map<string, RawCustomFieldDef>();

  // Identify column indices.
  const colName = headers.findIndex((h) => h.toLowerCase() === "name");
  const colSku = headers.findIndex((h) => h.toLowerCase() === "sku");
  const colQuantity = headers.findIndex((h) => h.toLowerCase() === "quantity");
  const colFolderPath = headers.findIndex((h) => h.toLowerCase() === "folder path");
  const colPrice = headers.findIndex((h) => h.toLowerCase() === "price");
  const colMinLevel = headers.findIndex((h) => h.toLowerCase() === "min level");
  const colTags = headers.findIndex((h) => h.toLowerCase() === "tags");
  const colNotes = headers.findIndex((h) => h.toLowerCase() === "notes");

  // Custom field columns are "Field: <name>".
  const customFieldCols = headers
    .map((h, i) => ({ name: h, index: i }))
    .filter((c) => c.name.startsWith("Field:"));

  // Helper: safely read a column value from a row. Returns "" when any
  // link in the chain (row, header entry, value) is missing.
  const get = (row: Record<string, string>, colIndex: number): string => {
    if (colIndex < 0) return "";
    const headerName = headers[colIndex];
    if (!headerName) return "";
    return row[headerName] ?? "";
  };

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (!row) continue;

    const name = get(row, colName);
    const sku = get(row, colSku);

    if (!name || !sku) continue; // Skip incomplete rows.

    const externalId = `sortly-item-${idx}`;

    // Parse folder path into category hierarchy.
    const folderPath = get(row, colFolderPath);
    if (folderPath) {
      const parts = folderPath.split("/").filter((p: string) => p.trim());

      let parentId: string | null = null;
      for (const part of parts) {
        const catId = `sortly-cat-${part}`;
        if (!categories.has(catId)) {
          categories.set(catId, {
            externalId: catId,
            name: part,
            parentExternalId: parentId,
          });
        }
        parentId = catId;
      }
    }

    // Parse quantity into stock level.
    const qtyStr = get(row, colQuantity);
    if (qtyStr) {
      const qty = Number.parseFloat(qtyStr);
      if (!Number.isNaN(qty)) {
        stockLevels.push({
          itemExternalId: externalId,
          warehouseExternalId: "sortly-default-warehouse",
          quantity: qty,
        });
      }
    }

    // Parse custom fields.
    const customFieldValues: Record<string, any> = {};
    for (const col of customFieldCols) {
      const fieldName = col.name.replace("Field: ", "");
      const value = row[col.name];

      if (value?.trim()) {
        const fieldKey = `sortly_${fieldName.toLowerCase().replace(/\s+/g, "_")}`;
        const fieldId = `sortly-field-${fieldKey}`;

        if (!customFieldDefs.has(fieldId)) {
          customFieldDefs.set(fieldId, {
            externalId: fieldId,
            name: fieldName,
            fieldKey,
            fieldType: inferType([value]) as any,
          });
        }

        customFieldValues[fieldKey] = {
          fieldType: customFieldDefs.get(fieldId)?.fieldType || "TEXT",
          valueText: value,
        };
      }
    }

    // Build item.
    const notes = get(row, colNotes);
    const priceStr = get(row, colPrice);
    const minLevelStr = get(row, colMinLevel);
    items.push({
      externalId,
      sku,
      name,
      description: notes || undefined,
      salePrice: priceStr ? Number.parseFloat(priceStr) || undefined : undefined,
      reorderPoint: minLevelStr ? Number.parseFloat(minLevelStr) || undefined : undefined,
      customFieldValues: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    });
  }

  // Add default warehouse.
  const warehouses = [
    {
      externalId: "sortly-default-warehouse",
      name: "Default Warehouse",
      isDefault: true,
    },
  ];

  return {
    source: "SORTLY",
    parsedAt: new Date().toISOString(),
    categories: Array.from(categories.values()),
    suppliers: [],
    warehouses,
    locations: [],
    customFieldDefs: Array.from(customFieldDefs.values()),
    items,
    stockLevels,
    purchaseOrders: [],
    attachments: [],
    adapterWarnings: [],
  };
}
