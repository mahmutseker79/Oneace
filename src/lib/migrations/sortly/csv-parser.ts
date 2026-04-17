/**
 * Phase MIG-S2 — Sortly CSV parser.
 *
 * Parses Sortly's single-file CSV export into ParsedSnapshot.
 */

import type {
  ParsedSnapshot,
  RawCategory,
  RawItem,
  RawStockLevel,
  RawCustomFieldDef,
} from "@/lib/migrations/core/types";
import { inferType } from "@/lib/migrations/core/csv-utils";

export function parseSortlyCSV(
  headers: string[],
  rows: Record<string, string>[],
): ParsedSnapshot {
  const categories = new Map<string, RawCategory>();
  const items: RawItem[] = [];
  const stockLevels: RawStockLevel[] = [];
  const customFieldDefs = new Map<string, RawCustomFieldDef>();

  // Identify column indices.
  const colName = headers.findIndex((h) => h.toLowerCase() === "name");
  const colSku = headers.findIndex((h) => h.toLowerCase() === "sku");
  const colQuantity = headers.findIndex((h) => h.toLowerCase() === "quantity");
  const colFolderPath = headers.findIndex(
    (h) => h.toLowerCase() === "folder path",
  );
  const colPrice = headers.findIndex((h) => h.toLowerCase() === "price");
  const colMinLevel = headers.findIndex((h) => h.toLowerCase() === "min level");
  const colTags = headers.findIndex((h) => h.toLowerCase() === "tags");
  const colNotes = headers.findIndex((h) => h.toLowerCase() === "notes");

  // Custom field columns are "Field: <name>".
  const customFieldCols = headers
    .map((h, i) => ({ name: h, index: i }))
    .filter((c) => c.name.startsWith("Field:"));

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];

    const name = colName >= 0 ? row[headers[colName]] : "";
    const sku = colSku >= 0 ? row[headers[colSku]] : "";

    if (!name || !sku) continue; // Skip incomplete rows.

    const externalId = `sortly-item-${idx}`;

    // Parse folder path into category hierarchy.
    if (colFolderPath >= 0 && row[headers[colFolderPath]]) {
      const folderPath = row[headers[colFolderPath]];
      const parts = folderPath.split("/").filter((p) => p.trim());

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
    if (colQuantity >= 0 && row[headers[colQuantity]]) {
      const qty = parseFloat(row[headers[colQuantity]]);
      if (!isNaN(qty)) {
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

      if (value && value.trim()) {
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
    items.push({
      externalId,
      sku,
      name,
      description: colNotes >= 0 ? row[headers[colNotes]] : undefined,
      salePrice:
        colPrice >= 0
          ? parseFloat(row[headers[colPrice]]) || undefined
          : undefined,
      reorderPoint:
        colMinLevel >= 0
          ? parseFloat(row[headers[colMinLevel]]) || undefined
          : undefined,
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
  };
}
