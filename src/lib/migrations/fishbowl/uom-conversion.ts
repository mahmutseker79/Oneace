/**
 * Phase S6 — Fishbowl UOM conversion and validation.
 *
 * Fishbowl has a rich UOM tree (each/box/case/kg/g/lb/ml/l/etc.).
 * Strategy:
 *   1. If uomconversions.csv is present, build a conversion map and use it
 *      to normalize UOMs to OneAce canonical set.
 *   2. If not present, preserve Fishbowl's UOM string verbatim and warn.
 *   3. Warn for any UOM that isn't a simple/canonical form so the user
 *      can review and manually adjust if needed.
 */

import type { ValidationIssue } from "@/lib/migrations/core/types";

/**
 * Canonical UOM set that OneAce recognizes.
 * Maps common forms to their canonical representation.
 */
const CANONICAL_UOMS = new Set([
  "EACH",
  "BOX",
  "CASE",
  "CARTON",
  "PALLET",
  "KG",
  "G",
  "MG",
  "LB",
  "OZ",
  "ML",
  "L",
  "GAL",
  "FT",
  "M",
  "CM",
  "IN",
  "YD",
]);

/**
 * Parse and validate a Fishbowl UOM string.
 * If the UOM is in the canonical set, return it as-is.
 * Otherwise, return it verbatim and emit a warning.
 *
 * @param fishbowlUom - Raw UOM from Fishbowl CSV
 * @returns Object with normalized UOM and optional warning
 */
export function validateAndNormalizeUom(fishbowlUom: string | null | undefined): {
  normalizedUom: string | null;
  issue: ValidationIssue | null;
} {
  if (!fishbowlUom || !fishbowlUom.trim()) {
    return { normalizedUom: null, issue: null };
  }

  const trimmed = fishbowlUom.trim().toUpperCase();

  // Check if it's canonical.
  if (CANONICAL_UOMS.has(trimmed)) {
    return { normalizedUom: trimmed, issue: null };
  }

  // Non-canonical UOM — preserve verbatim and warn.
  const issue: ValidationIssue = {
    severity: "WARNING",
    entity: "ITEM",
    code: "NON_CANONICAL_UOM",
    message: `Item UOM "${fishbowlUom}" is non-canonical. Preserved as-is; please review and adjust if needed.`,
    field: "unit",
  };

  return { normalizedUom: trimmed, issue };
}

/**
 * Build a UOM conversion map from uomconversions.csv data.
 * The map format: fromUom → { toUom → factor }
 *
 * @param rows - Raw CSV rows from uomconversions.csv
 * @returns Map of conversions and any warnings
 */
export function buildUomConversionMap(rows: Record<string, string>[]): {
  conversions: Map<string, Record<string, number>>;
  issues: ValidationIssue[];
} {
  const conversions = new Map<string, Record<string, number>>();
  const issues: ValidationIssue[] = [];

  for (const row of rows) {
    const from = (row.FromUOM || row.from_uom || row["From UOM"] || "").trim().toUpperCase();
    const to = (row.ToUOM || row.to_uom || row["To UOM"] || "").trim().toUpperCase();
    const factorStr = (
      row.ConversionFactor ||
      row.conversion_factor ||
      row["Conversion Factor"] ||
      ""
    ).trim();

    if (!from || !to || !factorStr) continue;

    const factor = Number.parseFloat(factorStr);
    if (Number.isNaN(factor) || !Number.isFinite(factor) || factor <= 0) {
      issues.push({
        severity: "WARNING",
        entity: "UOM_CONVERSION",
        code: "INVALID_CONVERSION_FACTOR",
        message: `UOM conversion ${from} → ${to}: factor "${factorStr}" is invalid; skipped`,
        field: "conversionFactor",
      });
      continue;
    }

    if (!conversions.has(from)) {
      conversions.set(from, {});
    }
    conversions.get(from)![to] = factor;
  }

  return { conversions, issues };
}

/**
 * Resolve a UOM using the conversion map (if available).
 * Strategy:
 *   1. If the UOM is already canonical, use it.
 *   2. If it can be converted to canonical via the map, use the target.
 *   3. Otherwise, preserve the Fishbowl UOM and emit a warning.
 *
 * @param fishbowlUom - Raw UOM from item
 * @param conversions - Map from buildUomConversionMap
 * @returns Resolved UOM and any warnings
 */
export function resolveUom(
  fishbowlUom: string | null | undefined,
  conversions: Map<string, Record<string, number>>,
): {
  finalUom: string | null;
  issue: ValidationIssue | null;
} {
  if (!fishbowlUom || !fishbowlUom.trim()) {
    return { finalUom: null, issue: null };
  }

  const trimmed = fishbowlUom.trim().toUpperCase();

  // Already canonical.
  if (CANONICAL_UOMS.has(trimmed)) {
    return { finalUom: trimmed, issue: null };
  }

  // Try to find a conversion to a canonical UOM.
  const conversionsFromThis = conversions.get(trimmed);
  if (conversionsFromThis) {
    for (const [toUom] of Object.entries(conversionsFromThis)) {
      if (CANONICAL_UOMS.has(toUom)) {
        return { finalUom: toUom, issue: null };
      }
    }
  }

  // No conversion found — preserve and warn.
  return {
    finalUom: trimmed,
    issue: {
      severity: "WARNING",
      entity: "ITEM",
      code: "UOM_PRESERVED_VERBATIM",
      message: `Item UOM "${fishbowlUom}" has no canonical conversion; preserved as-is. Please review.`,
      field: "unit",
    },
  };
}
