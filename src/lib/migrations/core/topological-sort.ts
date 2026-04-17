/**
 * Phase MIG-S2 — Topological sorting for category hierarchies.
 *
 * Categories may have parent-child relationships. Before writing to the
 * database, we must sort them so parents come before children.
 * Detects cycles and returns an error so the importer can fail gracefully.
 */

import type { RawCategory } from "@/lib/migrations/core/types";
import type { ValidationIssue } from "@/lib/migrations/core/types";

export interface SortResult {
  sorted: RawCategory[];
  issues: ValidationIssue[];
  /** If true, cycles were detected and the sorted array is a best-effort subset. */
  hasCycles: boolean;
  /** External IDs of categories that form cycles (if any). */
  cycleNodeIds: string[];
}

/**
 * Sort categories topologically by parent-child relationships.
 * Returns sorted array + any cycle-detection errors.
 *
 * Phase S6 behavior: If cycles are detected, records ERROR issues and
 * returns a best-effort sorted subset (acyclic nodes only).
 * The importer should record these ERRORs but can proceed with acyclic categories.
 */
export function sortCategoriesByParent(categories: RawCategory[]): SortResult {
  const issues: ValidationIssue[] = [];
  const cycleNodeIds: string[] = [];

  // Build a map of external ID → category.
  const byId = new Map(categories.map((c) => [c.externalId, c]));

  // Detect cycles using DFS.
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycleDetected = new Set<string>();

  for (const cat of categories) {
    if (!visited.has(cat.externalId)) {
      const cycle = detectCycleDfsS6(cat.externalId, byId, visited, recursionStack, cycleDetected);
      if (cycle && cycle.length > 0) {
        issues.push({
          severity: "ERROR",
          entity: "CATEGORY",
          code: "CATEGORY_CYCLE",
          message: `Category cycle detected: ${cycle.join(" → ")}`,
          externalId: cycle[0] ?? undefined,
        });
        cycle.forEach((id) => cycleDetected.add(id));
      }
    }
  }

  const hasCycles = cycleDetected.size > 0;
  cycleNodeIds.push(...cycleDetected);

  // Filter out cyclic categories for best-effort sort.
  const acyclicCategories = categories.filter((c) => !cycleDetected.has(c.externalId));

  // Perform topological sort using Kahn's algorithm on acyclic subset.
  const inDegree = new Map<string, number>();
  const dependsOn = new Map<string, string[]>();

  for (const cat of acyclicCategories) {
    inDegree.set(cat.externalId, 0);
    dependsOn.set(cat.externalId, []);
  }

  for (const cat of acyclicCategories) {
    if (cat.parentExternalId && byId.has(cat.parentExternalId)) {
      // Only add dependency if parent is also acyclic.
      if (!cycleDetected.has(cat.parentExternalId)) {
        inDegree.set(cat.externalId, (inDegree.get(cat.externalId) ?? 0) + 1);
        const parents = dependsOn.get(cat.parentExternalId) ?? [];
        parents.push(cat.externalId);
        dependsOn.set(cat.parentExternalId, parents);
      }
    }
  }

  const queue = Array.from(acyclicCategories)
    .filter((c) => inDegree.get(c.externalId) === 0)
    .map((c) => c.externalId);

  const sorted: RawCategory[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const cat = byId.get(id)!;
    sorted.push(cat);

    for (const childId of dependsOn.get(id) ?? []) {
      const degree = inDegree.get(childId) ?? 0;
      inDegree.set(childId, degree - 1);
      if (inDegree.get(childId) === 0) {
        queue.push(childId);
      }
    }
  }

  return { sorted, issues, hasCycles, cycleNodeIds };
}

/**
 * DFS cycle detection (Phase S6 variant).
 * Returns the cycle path if found, empty array otherwise.
 * Marks all nodes in the cycle in the cycleDetected set.
 */
function detectCycleDfsS6(
  nodeId: string,
  byId: Map<string, RawCategory>,
  visited: Set<string>,
  recursionStack: Set<string>,
  cycleDetected: Set<string>,
): string[] {
  visited.add(nodeId);
  recursionStack.add(nodeId);

  const cat = byId.get(nodeId);
  if (!cat || !cat.parentExternalId) {
    recursionStack.delete(nodeId);
    return [];
  }

  const parentId = cat.parentExternalId;
  if (!byId.has(parentId)) {
    // Parent not in snapshot — orphan, not a cycle.
    recursionStack.delete(nodeId);
    return [];
  }

  if (!visited.has(parentId)) {
    const cycle = detectCycleDfsS6(parentId, byId, visited, recursionStack, cycleDetected);
    if (cycle.length > 0) {
      return cycle;
    }
  } else if (recursionStack.has(parentId)) {
    // Found a cycle: from parentId back to itself via nodeId.
    return [parentId, nodeId];
  }

  recursionStack.delete(nodeId);
  return [];
}
