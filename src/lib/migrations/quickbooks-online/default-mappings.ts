/**
 * Phase MIG-QBO — QuickBooks Online default field mappings.
 *
 * This is a reference table of QBO → OneAce field translations.
 * Used by the adapter's suggestMappings() to inform the UI about
 * what was found and what it maps to.
 *
 * Most mappings are implicit (id → externalId, Name → name).
 * This file documents the brain-surgery precision mappings.
 */

import type { FieldMapping } from "@/lib/migrations/core/types";
import type { ParsedSnapshot } from "@/lib/migrations/core/types";

export const QBO_FIELD_REFERENCE: Record<string, Record<string, string>> = {
  Item: {
    Id: "externalId (stable QBO id)",
    Name: "item.name (required)",
    Sku: "item.sku (or generated from Name if missing)",
    Description: "item.description",
    UnitPrice: "item.salePrice",
    PurchaseCost: "item.costPrice",
    QtyOnHand: "stockLevel.quantity → default warehouse",
    ReorderPoint: "item.reorderPoint",
    Type: "(filter) Inventory/NonInventory only; Service → SKIP with WARNING",
    Active: "item.status (true → ACTIVE, false → ARCHIVED)",
    ParentRef: "(future) SubItem hierarchy → category tree",
    ClassRef: "customFieldValues.qbo_class (SELECT, if scope.includeCustomFields)",
  },
  Vendor: {
    Id: "supplier.externalId",
    DisplayName: "supplier.name",
    PrimaryEmailAddr: "supplier.email",
    PrimaryPhone: "supplier.phone",
    "BillAddr.*": "supplier.address (concatenated)",
    Active: "supplier archival (if scope.includeArchivedItems === false, skip inactive)",
  },
  PurchaseOrder: {
    Id: "po.externalId",
    DocNumber: "po.poNumber",
    VendorRef: "po.supplierExternalId",
    POStatus: "po.status (Open → OPEN, Closed → RECEIVED, unknown → DRAFT + WARNING)",
    TxnDate: "po.orderDate",
    DueDate: "po.expectedDate",
    "Line[].ItemBasedExpenseLineDetail.ItemRef": "line.itemExternalId",
    "Line[].Amount": "line.unitCost × quantity (must divide)",
  },
};

/**
 * Return suggested field mappings for display in the UI.
 * For QBO (API mode), we don't have a CSV to map — instead,
 * we suggest custom field handling if any are present.
 */
export function getQboDefaultMappings(snapshot: ParsedSnapshot): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  // QBO API mode doesn't require field mappings (it's not CSV-based).
  // All standard fields are mapped implicitly by the parser.
  // Custom fields (e.g., ClassRef) would be handled dynamically based on the items found.

  // For now, return an empty array — the adapter handles all standard mappings.
  // If custom fields were present, we'd add them here.

  if (snapshot.customFieldDefs.length > 0) {
    // Future: suggest custom field mappings based on what was found
    for (const def of snapshot.customFieldDefs) {
      mappings.push({
        sourceField: `qbo_${def.fieldKey}`,
        targetField: `item.customFieldValues.${def.fieldKey}`,
        note: `QBO custom field: ${def.name}`,
      });
    }
  }

  return mappings;
}
