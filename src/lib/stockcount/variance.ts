// Pure variance calculation for stock counts.
//
// This module has NO dependencies on Prisma, React, or Next — it is
// deliberately a plain TS file so the exact same code runs:
//   1. On the server when reconcile posts adjustments to the ledger.
//   2. On the client during the live preview on /stock-counts/[id] and
//      the summary tiles on /stock-counts/[id]/reconcile.
//
// Keeping these two paths running the same pure function is the
// cheapest way to guarantee that "what I see in the preview is exactly
// what will be posted". No drift, no re-implementation gap.

export type VarianceStatus = "match" | "within_tolerance" | "over" | "under";

export type SnapshotLike = {
  itemId: string;
  warehouseId: string;
  expectedQuantity: number;
};

export type EntryLike = {
  itemId: string;
  warehouseId: string;
  countedQuantity: number;
};

export type VarianceRow = {
  itemId: string;
  warehouseId: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number; // signed: counted - expected
  variancePercent: number | null; // null when expected = 0
  status: VarianceStatus;
};

export type VarianceOptions = {
  /** Variance <= this absolute value is "within_tolerance". Default 0. */
  absoluteTolerance?: number;
  /** |variance| / expected <= this percent (0..100) is "within_tolerance". Default 0. */
  percentageTolerance?: number;
};

export type VarianceSummary = {
  totalItems: number;
  matched: number;
  withinTolerance: number;
  over: number;
  under: number;
  netUnitVariance: number; // sum of signed variances
  totalAbsVariance: number; // sum of abs variances
};

/**
 * Key shape used by `aggregateEntries` and `calculateVariances` to
 * collate rows per (item, warehouse) pair. Encoded as a single string so
 * we can use a plain Map.
 */
function rowKey(itemId: string, warehouseId: string): string {
  return `${itemId}::${warehouseId}`;
}

/**
 * Sum counted quantities per (item, warehouse). Entries are append-only
 * so a single (item, warehouse) pair may have multiple entries — this
 * collapses them into a single total.
 */
export function aggregateEntries(entries: readonly EntryLike[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const key = rowKey(entry.itemId, entry.warehouseId);
    totals.set(key, (totals.get(key) ?? 0) + entry.countedQuantity);
  }
  return totals;
}

/**
 * Classify a single variance row. The rule:
 *   1. variance = 0                       → "match"
 *   2. within absolute OR percentage band → "within_tolerance"
 *   3. counted > expected                 → "over"
 *   4. otherwise                          → "under"
 *
 * Percentage tolerance is ignored when expected = 0 (division by zero
 * would otherwise give Infinity and skew the band).
 */
export function classifyVariance(
  expected: number,
  counted: number,
  options?: VarianceOptions,
): { variance: number; variancePercent: number | null; status: VarianceStatus } {
  const variance = counted - expected;
  const variancePercent = expected === 0 ? null : (variance / expected) * 100;
  const absoluteTolerance = options?.absoluteTolerance ?? 0;
  const percentageTolerance = options?.percentageTolerance ?? 0;

  if (variance === 0) {
    return { variance, variancePercent, status: "match" };
  }
  const withinAbsolute = Math.abs(variance) <= absoluteTolerance;
  const withinPercent =
    variancePercent !== null && Math.abs(variancePercent) <= percentageTolerance;
  if (withinAbsolute || withinPercent) {
    return { variance, variancePercent, status: "within_tolerance" };
  }
  if (counted > expected) {
    return { variance, variancePercent, status: "over" };
  }
  return { variance, variancePercent, status: "under" };
}

/**
 * Produce a variance row for every snapshot, aggregating all entries
 * for the same (item, warehouse) pair. Rows are returned in the same
 * order as the input snapshots.
 *
 * Missing entries default to a counted quantity of 0 — this lets the
 * reconcile screen show "counted nothing, expected 5" as an under
 * variance of -5 instead of silently dropping uncounted items.
 */
export function calculateVariances(
  snapshots: readonly SnapshotLike[],
  entries: readonly EntryLike[],
  options?: VarianceOptions,
): VarianceRow[] {
  const totals = aggregateEntries(entries);
  return snapshots.map((snapshot) => {
    const counted = totals.get(rowKey(snapshot.itemId, snapshot.warehouseId)) ?? 0;
    const { variance, variancePercent, status } = classifyVariance(
      snapshot.expectedQuantity,
      counted,
      options,
    );
    return {
      itemId: snapshot.itemId,
      warehouseId: snapshot.warehouseId,
      expectedQuantity: snapshot.expectedQuantity,
      countedQuantity: counted,
      variance,
      variancePercent,
      status,
    };
  });
}

/**
 * Roll variance rows up into the 6 summary tiles shown on the reconcile
 * screen: total / matched / within tolerance / over / under / net.
 */
export function summarizeVariances(rows: readonly VarianceRow[]): VarianceSummary {
  const summary: VarianceSummary = {
    totalItems: rows.length,
    matched: 0,
    withinTolerance: 0,
    over: 0,
    under: 0,
    netUnitVariance: 0,
    totalAbsVariance: 0,
  };
  for (const row of rows) {
    summary.netUnitVariance += row.variance;
    summary.totalAbsVariance += Math.abs(row.variance);
    if (row.status === "match") summary.matched += 1;
    else if (row.status === "within_tolerance") summary.withinTolerance += 1;
    else if (row.status === "over") summary.over += 1;
    else summary.under += 1;
  }
  return summary;
}
