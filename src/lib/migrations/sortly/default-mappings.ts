/**
 * Phase MIG-S2 — Sortly default field mappings.
 *
 * Suggests mappings for Sortly custom fields based on field names.
 */

import type { FieldMapping, ParsedSnapshot } from "@/lib/migrations/core/types";

export function getSortlyDefaultMappings(
  snapshot: ParsedSnapshot,
): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  // Suggest mappings based on field key patterns.
  const keywordMap: Record<string, string> = {
    weight: "weight",
    dimension: "dimensions",
    color: "color",
    size: "size",
    brand: "brand",
    barcode: "barcode",
    supplier: "preferredSupplier",
    vendor: "preferredSupplier",
  };

  for (const def of snapshot.customFieldDefs) {
    let suggestion: string | null = null;

    for (const [keyword, field] of Object.entries(keywordMap)) {
      if (def.fieldKey.toLowerCase().includes(keyword)) {
        suggestion = field;
        break;
      }
    }

    mappings.push({
      externalFieldKey: def.fieldKey,
      suggestedOneAceField: suggestion || def.fieldKey,
      confidence: suggestion ? 0.8 : 0.3,
    });
  }

  return mappings;
}
