/**
 * Phase MIG-S2 — inFlow default field mappings.
 */

import type { FieldMapping, ParsedSnapshot } from "@/lib/migrations/core/types";

export function getInflowDefaultMappings(
  snapshot: ParsedSnapshot,
): FieldMapping[] {
  // inFlow doesn't typically have custom fields in the basic CSV export.
  // If future versions add them, implement mapping suggestions here.
  return [];
}
