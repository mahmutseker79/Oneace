/**
 * Phase E: Conflict resolution strategies.
 *
 * Handles merge conflicts when both local and external systems have
 * different versions of the same entity. Supports multiple strategies:
 * - Last-write-wins (LWW)
 * - Local-preferred
 * - External-preferred
 * - Manual review queue
 * - Field-level merging
 */

import { logger } from "@/lib/logger";

export type ConflictStrategy =
  | "LAST_WRITE_WINS"
  | "LOCAL_PREFERRED"
  | "EXTERNAL_PREFERRED"
  | "MANUAL_REVIEW"
  | "FIELD_MERGE";

export interface ConflictInfo {
  entityId: string;
  externalId?: string;
  localVersion: Record<string, unknown>;
  externalVersion: Record<string, unknown>;
  localModifiedAt: Date;
  externalModifiedAt: Date;
  divergentFields: string[];
}

export interface ResolvedConflict {
  entityId: string;
  strategy: ConflictStrategy;
  resolvedVersion: Record<string, unknown>;
  merged: boolean;
  fieldsResolved: string[];
  fieldsUnresolved: string[];
}

/**
 * Conflict resolver with multiple strategies.
 */
export class ConflictResolver {
  /**
   * Resolve a conflict using the specified strategy.
   */
  resolve(
    conflict: ConflictInfo,
    strategy: ConflictStrategy = "LAST_WRITE_WINS",
  ): ResolvedConflict {
    switch (strategy) {
      case "LAST_WRITE_WINS":
        return this.lastWriteWins(conflict);
      case "LOCAL_PREFERRED":
        return this.localPreferred(conflict);
      case "EXTERNAL_PREFERRED":
        return this.externalPreferred(conflict);
      case "FIELD_MERGE":
        return this.fieldMerge(conflict);
      case "MANUAL_REVIEW":
        return this.manualReview(conflict);
      default:
        throw new Error(`Unknown conflict strategy: ${strategy}`);
    }
  }

  /**
   * Last-write-wins: use the version with the latest modification time.
   */
  private lastWriteWins(conflict: ConflictInfo): ResolvedConflict {
    const useLocal = conflict.localModifiedAt >= conflict.externalModifiedAt;

    return {
      entityId: conflict.entityId,
      strategy: "LAST_WRITE_WINS",
      resolvedVersion: useLocal ? conflict.localVersion : conflict.externalVersion,
      merged: false,
      fieldsResolved: Object.keys(useLocal ? conflict.localVersion : conflict.externalVersion),
      fieldsUnresolved: [],
    };
  }

  /**
   * Local-preferred: always use local version, log the conflict.
   */
  private localPreferred(conflict: ConflictInfo): ResolvedConflict {
    logger.warn("Conflict resolved with local-preferred strategy", {
      entityId: conflict.entityId,
      externalId: conflict.externalId,
      divergentFields: conflict.divergentFields,
    });

    return {
      entityId: conflict.entityId,
      strategy: "LOCAL_PREFERRED",
      resolvedVersion: conflict.localVersion,
      merged: false,
      fieldsResolved: Object.keys(conflict.localVersion),
      fieldsUnresolved: [],
    };
  }

  /**
   * External-preferred: always use external version, log the conflict.
   */
  private externalPreferred(conflict: ConflictInfo): ResolvedConflict {
    logger.warn("Conflict resolved with external-preferred strategy", {
      entityId: conflict.entityId,
      externalId: conflict.externalId,
      divergentFields: conflict.divergentFields,
    });

    return {
      entityId: conflict.entityId,
      strategy: "EXTERNAL_PREFERRED",
      resolvedVersion: conflict.externalVersion,
      merged: false,
      fieldsResolved: Object.keys(conflict.externalVersion),
      fieldsUnresolved: [],
    };
  }

  /**
   * Field-level merge: combine compatible changes at field level.
   */
  private fieldMerge(conflict: ConflictInfo): ResolvedConflict {
    const merged: Record<string, unknown> = {};
    const fieldsResolved: string[] = [];
    const fieldsUnresolved: string[] = [];

    const allFields = new Set([
      ...Object.keys(conflict.localVersion),
      ...Object.keys(conflict.externalVersion),
    ]);

    for (const field of allFields) {
      const localValue = conflict.localVersion[field];
      const externalValue = conflict.externalVersion[field];

      // If values are identical, include it
      if (JSON.stringify(localValue) === JSON.stringify(externalValue)) {
        merged[field] = localValue;
        fieldsResolved.push(field);
        continue;
      }

      // If one side is undefined, use the other
      if (localValue === undefined) {
        merged[field] = externalValue;
        fieldsResolved.push(field);
        continue;
      }

      if (externalValue === undefined) {
        merged[field] = localValue;
        fieldsResolved.push(field);
        continue;
      }

      // For arrays, try to merge
      if (Array.isArray(localValue) && Array.isArray(externalValue)) {
        const merged_array = this.mergeArrays(localValue, externalValue);
        merged[field] = merged_array;
        fieldsResolved.push(field);
        continue;
      }

      // For objects, recursively merge
      if (typeof localValue === "object" && typeof externalValue === "object") {
        merged[field] = { ...localValue, ...externalValue };
        fieldsResolved.push(field);
        continue;
      }

      // Conflicting primitive values - use last-write-wins for this field
      if (conflict.localModifiedAt >= conflict.externalModifiedAt) {
        merged[field] = localValue;
      } else {
        merged[field] = externalValue;
      }

      fieldsResolved.push(field);
    }

    return {
      entityId: conflict.entityId,
      strategy: "FIELD_MERGE",
      resolvedVersion: merged,
      merged: fieldsUnresolved.length === 0,
      fieldsResolved,
      fieldsUnresolved,
    };
  }

  /**
   * Manual review: mark for human intervention.
   */
  private manualReview(conflict: ConflictInfo): ResolvedConflict {
    logger.warn("Conflict marked for manual review", {
      entityId: conflict.entityId,
      externalId: conflict.externalId,
      divergentFields: conflict.divergentFields,
    });

    return {
      entityId: conflict.entityId,
      strategy: "MANUAL_REVIEW",
      resolvedVersion: conflict.localVersion,
      merged: false,
      fieldsResolved: [],
      fieldsUnresolved: Object.keys(conflict.divergentFields || []),
    };
  }

  /**
   * Simple array merge: combine unique elements.
   */
  private mergeArrays(local: unknown[], external: unknown[]): unknown[] {
    const seen = new Set<string>();
    const merged: unknown[] = [];

    for (const item of [...local, ...external]) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    return merged;
  }

  /**
   * Detect which fields differ between versions.
   */
  static detectDivergentFields(
    local: Record<string, unknown>,
    external: Record<string, unknown>,
  ): string[] {
    const divergent: string[] = [];
    const allFields = new Set([...Object.keys(local), ...Object.keys(external)]);

    for (const field of allFields) {
      if (JSON.stringify(local[field]) !== JSON.stringify(external[field])) {
        divergent.push(field);
      }
    }

    return divergent;
  }
}

export default ConflictResolver;
