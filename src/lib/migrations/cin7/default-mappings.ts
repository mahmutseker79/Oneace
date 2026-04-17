/**
 * Phase MIG-S5 — Cin7 Core default field mappings.
 *
 * Cin7 API returns structured JSON, so there's no CSV header guessing.
 * Instead, we provide sensible defaults based on the API schema.
 */

import type { FieldMapping, ParsedSnapshot } from "@/lib/migrations/core/types";

export function getCin7DefaultMappings(
  _snapshot: ParsedSnapshot,
): FieldMapping[] {
  // For API sources, field mappings are less relevant since the data
  // is already structured. Return an empty array; custom fields are
  // discovered during parsing.
  return [];
}
