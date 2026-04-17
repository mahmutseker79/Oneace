/**
 * Phase QBD-3 — Default field mappings for QuickBooks Desktop.
 *
 * IIF fields → OneAce canonical fields.
 */

import type { FieldMapping, ParsedSnapshot } from "@/lib/migrations/core/types";

/**
 * Get default field mappings for QBD IIF/QBXML exports.
 * Currently, QBD mappings are straightforward and don't require custom logic,
 * so this returns an empty array (adapters parse directly into canonical form).
 */
export function getQbdDefaultMappings(
  snapshot: ParsedSnapshot
): FieldMapping[] {
  // QBD adapter handles all parsing directly into Raw* types,
  // so no post-parse field mappings are needed.
  // Return empty array unless there are custom fields to map.
  return [];
}

/**
 * QBD-specific validation codes and messages.
 */
export const QBD_VALIDATION_CODES = {
  // Item validation
  ITEM_MISSING_NAME: "Item missing NAME field",
  ITEM_MISSING_REORDER_POINT: "Item missing REORDERPOINT; using 0",
  ITEM_INVALID_TYPE: "Item has invalid INVTYPE (expected INV)",
  ITEM_DUPLICATE_SKU: "Duplicate SKU detected across items",

  // Vendor validation
  VENDOR_MISSING_NAME: "Vendor missing NAME field",
  VENDOR_MISSING_ADDRESS: "Vendor missing address components",

  // PO validation
  PO_MISSING_VENDOR: "Purchase order missing vendor reference",
  PO_MISSING_DOCNUM: "Purchase order missing DOCNUM (PO number)",
  PO_ORPHANED_SPL: "SPL (split) line found with no parent PO",

  // Category validation
  CATEGORY_DUPLICATE_NAME: "Duplicate category name",
  CATEGORY_ORPHANED_PARENT: "Category references non-existent parent",

  // Encoding/parsing
  ENCODING_DETECTED: "Detected Windows-1252 encoding; auto-transcoded",
  MALFORMED_ROW: "Malformed IIF row (missing required fields)",
  MISSING_HIDDEN_FIELD: "Item missing HIDDEN field; assuming ACTIVE",
} as const;
