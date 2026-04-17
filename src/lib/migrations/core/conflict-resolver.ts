/**
 * Phase MIG-S2 — SKU collision conflict resolution.
 *
 * When an incoming item's SKU conflicts with an existing OneAce item that
 * has a DIFFERENT externalId (not from the same migration), we apply a
 * conflict policy:
 *   - MERGE_BY_EXTERNAL_ID: merge (same externalId → update; different → error)
 *   - APPEND_SUFFIX: append "-MIG-<source>" to the incoming SKU and warn
 *   - APPEND_SOURCE_SUFFIX: append "-<abbrev>" where abbrev is source-specific (Phase S6)
 *   - SKIP: skip the incoming item entirely and warn
 *
 * Default policy is APPEND_SOURCE_SUFFIX for migrations (safe and non-destructive).
 * Phase S6 adds source abbreviations for Fishbowl, Cin7, SOS, etc.
 */

import type { MigrationSource } from "@/generated/prisma";
import type { ValidationIssue } from "@/lib/migrations/core/types";
import type { PrismaClient } from "@/generated/prisma";

export type ConflictPolicy =
  | "MERGE_BY_EXTERNAL_ID"
  | "APPEND_SUFFIX"
  | "APPEND_SOURCE_SUFFIX"
  | "SKIP";

/**
 * Map MigrationSource to a short abbreviation for SKU conflict resolution.
 * Used when APPEND_SOURCE_SUFFIX policy is active.
 *
 * @param source - MigrationSource enum value
 * @returns 3–4 character abbreviation (e.g., "FBL" for Fishbowl)
 */
export function getSourceAbbreviation(source: MigrationSource): string {
  const abbrevMap: Record<MigrationSource, string> = {
    SORTLY: "SRT",
    INFLOW: "IFL",
    FISHBOWL: "FBL",
    CIN7_CORE: "C7C",
    SOS_INVENTORY: "SOS",
  };
  return abbrevMap[source] || source.slice(0, 3).toUpperCase();
}

export interface ConflictCheckContext {
  db: PrismaClient;
  organizationId: string;
  source: MigrationSource;
  policy: ConflictPolicy;
}

/**
 * Result of SKU resolution. The returned SKU may be different from the input
 * if a conflict was detected and the policy dictates renaming.
 */
export interface SkuResolutionResult {
  /** The final SKU to use (may differ from input due to conflict resolution). */
  finalSku: string;
  /** Whether the SKU was modified. */
  wasModified: boolean;
  /** If true, the item should be skipped entirely (SKIP policy). */
  shouldSkip: boolean;
  /** Optional validation issue to record in the import report. */
  issue?: ValidationIssue | null;
}

/**
 * Check for SKU collisions. Return an array of warnings.
 * If policy is MERGE_BY_EXTERNAL_ID and conflicts are found, returns
 * errors instead (the importer must abort).
 */
export async function checkSkuCollisions(
  ctx: ConflictCheckContext,
  incomingSkus: string[],
): Promise<ValidationIssue[]> {
  if (incomingSkus.length === 0) return [];

  const issues: ValidationIssue[] = [];

  // Build a map of unique SKUs for conflict checking.
  // For APPEND_* policies, we need to check the base SKU, not the modified one.
  const baseSkus = incomingSkus.map((sku) => {
    // If the SKU already ends with our source suffix, check the base.
    const suffix = `-${getSourceAbbreviation(ctx.source)}`;
    if (sku.endsWith(suffix)) {
      return sku.slice(0, sku.length - suffix.length);
    }
    return sku;
  });

  // Find existing items with these SKUs.
  const existing = await ctx.db.item.findMany({
    where: {
      organizationId: ctx.organizationId,
      sku: { in: baseSkus },
    },
    select: {
      id: true,
      sku: true,
      externalId: true,
      externalSource: true,
    },
  });

  for (const item of existing) {
    // If the item is from the same migration source and ID, it's OK (update).
    if (item.externalSource === ctx.source && item.externalId) {
      // This will be handled by the items phase (upsert by external ID).
      continue;
    }

    // Collision with a different item (or not imported, or from different source).
    if (ctx.policy === "MERGE_BY_EXTERNAL_ID") {
      issues.push({
        severity: "ERROR",
        code: "SKU_COLLISION_MERGE",
        message: `SKU "${item.sku}" already exists (from ${item.externalSource || "native"}), cannot merge under MERGE_BY_EXTERNAL_ID policy`,
        externalId: item.id,
        field: "sku",
      });
    } else if (ctx.policy === "SKIP") {
      issues.push({
        severity: "WARNING",
        code: "SKU_COLLISION_SKIPPED",
        message: `SKU "${item.sku}" already exists; item will be skipped`,
        field: "sku",
      });
    } else {
      // APPEND_SUFFIX or APPEND_SOURCE_SUFFIX — just warn.
      const abbrev =
        ctx.policy === "APPEND_SOURCE_SUFFIX"
          ? getSourceAbbreviation(ctx.source)
          : ctx.source;
      const newSku = `${item.sku}-${abbrev}`;
      issues.push({
        severity: "WARNING",
        code: "SKU_COLLISION_APPENDED",
        message: `SKU "${item.sku}" already exists; incoming item will be renamed to "${newSku}"`,
        field: "sku",
      });
    }
  }

  return issues;
}

/**
 * Resolve a SKU collision by applying the policy.
 * Returns a SkuResolutionResult with the final SKU and metadata.
 *
 * Policies:
 *   - MERGE_BY_EXTERNAL_ID: throws if collision with different item
 *   - APPEND_SUFFIX: appends "-MIG-<source>"
 *   - APPEND_SOURCE_SUFFIX: appends "-<abbrev>" (e.g., "-FBL" for Fishbowl)
 *   - SKIP: marks for skipping
 */
export function resolveSku(
  ctx: ConflictCheckContext,
  sku: string,
  externalId: string,
  existingItem:
    | {
        externalId: string | null;
        externalSource: string | null;
      }
    | undefined,
): SkuResolutionResult {
  // No collision.
  if (!existingItem) {
    return { finalSku: sku, wasModified: false, shouldSkip: false, issue: null };
  }

  // Same source + ID — it's an update.
  if (
    existingItem.externalSource === ctx.source &&
    existingItem.externalId === externalId
  ) {
    return { finalSku: sku, wasModified: false, shouldSkip: false, issue: null };
  }

  // Different item — apply policy.
  if (ctx.policy === "MERGE_BY_EXTERNAL_ID") {
    throw new Error(
      `SKU collision: "${sku}" exists with different externalId under MERGE policy`,
    );
  }

  if (ctx.policy === "SKIP") {
    return {
      finalSku: sku,
      wasModified: false,
      shouldSkip: true,
      issue: {
        severity: "WARNING",
        entity: "ITEM",
        field: "sku",
        code: "SKU_COLLISION_SKIPPED",
        message: `Item with SKU "${sku}" skipped due to collision with existing item`,
      },
    };
  }

  // APPEND_SUFFIX or APPEND_SOURCE_SUFFIX.
  const suffix =
    ctx.policy === "APPEND_SOURCE_SUFFIX"
      ? getSourceAbbreviation(ctx.source)
      : `MIG-${ctx.source}`;
  const newSku = `${sku}-${suffix}`;

  return {
    finalSku: newSku,
    wasModified: true,
    shouldSkip: false,
    issue: {
      severity: "WARNING",
      entity: "ITEM",
      field: "sku",
      code: "SKU_COLLISION_RESOLVED",
      message: `Item SKU renamed from "${sku}" to "${newSku}" due to collision`,
    },
  };
}
