/**
 * Recount workflow logic — pure functions for evaluating recount need.
 *
 * This module contains zero database calls. All functions are deterministic
 * and use snapshots + entries to calculate variance-based recount
 * recommendations.
 */

/**
 * Snapshot row as read from the database.
 */
export type SnapshotRow = {
  itemId: string;
  warehouseId: string;
  expectedQuantity: number;
};

/**
 * Entry row as read from the database.
 */
export type EntryRow = {
  itemId: string;
  warehouseId: string;
  countedQuantity: number;
};

/**
 * Variance result row — includes both the difference and the percentage.
 */
export type VarianceResult = {
  itemId: string;
  warehouseId: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  variancePercentage: number;
};

/**
 * Evaluate whether items require a recount based on variance threshold.
 *
 * Returns the list of (itemId, warehouseId) tuples where the absolute
 * variance percentage exceeds the threshold. These rows should be flagged
 * for recount.
 *
 * Example:
 *   - Expected: 100 units, Counted: 85 units
 *   - Variance: -15, Percentage: -15%
 *   - Threshold: 5%
 *   - Result: true (included in recount list)
 *
 * @param snapshots — frozen expected quantities from count creation
 * @param entries — physical count entries
 * @param thresholdPercent — variance % threshold (default 5)
 * @returns array of (itemId, warehouseId) that exceed threshold
 */
export function evaluateRecountNeed(
  snapshots: SnapshotRow[],
  entries: EntryRow[],
  thresholdPercent: number = 5,
): Array<{ itemId: string; warehouseId: string }> {
  const variances = calculateVariances(snapshots, entries);
  const itemsExceedingThreshold: Array<{ itemId: string; warehouseId: string }> = [];

  for (const row of variances) {
    if (Math.abs(row.variancePercentage) > thresholdPercent) {
      itemsExceedingThreshold.push({
        itemId: row.itemId,
        warehouseId: row.warehouseId,
      });
    }
  }

  return itemsExceedingThreshold;
}

/**
 * Calculate variance for all (item, warehouse) pairs in a count.
 * Pure function — no database calls.
 *
 * Positive variance = counted > expected (surplus)
 * Negative variance = counted < expected (shortage)
 *
 * @param snapshots — frozen expected quantities
 * @param entries — physical count entries (may be 0..N per snapshot)
 * @returns array of variance rows with percentage
 */
export function calculateVariances(
  snapshots: SnapshotRow[],
  entries: EntryRow[],
): VarianceResult[] {
  // Aggregate entries by (itemId, warehouseId) key
  const entryMap = new Map<string, EntryRow>();
  for (const entry of entries) {
    const key = `${entry.itemId}::${entry.warehouseId}`;
    // If there are multiple entries for the same pair, sum their quantities
    const existing = entryMap.get(key);
    if (existing) {
      existing.countedQuantity += entry.countedQuantity;
    } else {
      entryMap.set(key, { ...entry });
    }
  }

  const results: VarianceResult[] = [];
  for (const snapshot of snapshots) {
    const key = `${snapshot.itemId}::${snapshot.warehouseId}`;
    const entry = entryMap.get(key);
    const countedQuantity = entry?.countedQuantity ?? 0;
    const variance = countedQuantity - snapshot.expectedQuantity;
    // Percentage: if expected is 0, variance is infinite. Cap at 999% to avoid division issues.
    const variancePercentage =
      snapshot.expectedQuantity === 0
        ? variance === 0
          ? 0
          : 999
        : (variance / snapshot.expectedQuantity) * 100;

    results.push({
      itemId: snapshot.itemId,
      warehouseId: snapshot.warehouseId,
      expectedQuantity: snapshot.expectedQuantity,
      countedQuantity,
      variance,
      variancePercentage,
    });
  }

  return results;
}
