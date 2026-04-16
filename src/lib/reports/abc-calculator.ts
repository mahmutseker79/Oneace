/**
 * Phase D — ABC Inventory Classification Calculator
 *
 * Implements the Pareto principle (80/20 rule) for SKU value analysis:
 *   A: Top 20% of SKUs representing 80% of value (most critical)
 *   B: Next 30% of SKUs representing 15% of value (moderate)
 *   C: Bottom 50% of SKUs representing 5% of value (least critical)
 *
 * Supports both fixed thresholds and custom thresholds for organizations
 * with unique inventory compositions.
 */

import type { Item } from "@/generated/prisma";

export type ABCClass = "A" | "B" | "C";

export interface ABCResult {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  costPrice: number;
  totalValue: number;
  classification: ABCClass;
  percentageOfTotalValue: number;
  cumulativePercentage: number;
}

export interface ABCThresholds {
  aMinValue?: number; // Custom: items >= this value become A class
  bMinValue?: number; // Custom: items >= this value become B class
  aPercentageThreshold?: number; // Pareto: top N% of SKUs = 80% (default 20)
  bPercentageThreshold?: number; // Pareto: top N% of SKUs = 95% (default 50)
}

/**
 * Pareto-based default thresholds (80/20 rule)
 */
const DEFAULT_THRESHOLDS = {
  aPercentageThreshold: 0.2, // Top 20% of SKUs
  bPercentageThreshold: 0.5, // Top 50% of SKUs
};

/**
 * Calculate ABC classification for a list of items.
 *
 * Algorithm:
 * 1. Calculate total value (qty × costPrice) for each item
 * 2. Sort by value descending
 * 3. Calculate cumulative percentage of total value
 * 4. Assign class based on thresholds
 *
 * If custom value thresholds are provided, they take precedence over
 * Pareto percentages. This allows organizations to override based on
 * strategic business logic.
 */
export function calculateABC(
  items: Array<Pick<Item, "id" | "sku" | "name" | "costPrice"> & { quantity: number }>,
  thresholds: ABCThresholds = {},
): ABCResult[] {
  if (items.length === 0) return [];

  // Merge with defaults
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // Calculate total values
  const withValues = items.map((item) => {
    const costPrice = item.costPrice ? Number(item.costPrice) : 0;
    const totalValue = item.quantity * costPrice;
    return {
      ...item,
      costPrice,
      totalValue,
    };
  });

  // Sort by value descending
  const sorted = withValues.sort((a, b) => b.totalValue - a.totalValue);

  // Calculate grand total
  const grandTotal = sorted.reduce((sum, item) => sum + item.totalValue, 0);

  if (grandTotal === 0) {
    // All items are zero-value; classify as C
    return sorted.map((item) => ({
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      costPrice: item.costPrice,
      totalValue: item.totalValue,
      classification: "C",
      percentageOfTotalValue: 0,
      cumulativePercentage: 0,
    }));
  }

  // Build classification with cumulative percentages
  let cumulativeValue = 0;
  const results: ABCResult[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;
    cumulativeValue += item.totalValue;
    const cumulativePercentage = (cumulativeValue / grandTotal) * 100;
    const percentageOfTotalValue = (item.totalValue / grandTotal) * 100;

    // Determine classification
    let classification: ABCClass = "C";

    // Custom value thresholds take precedence
    if (config.aMinValue !== undefined && item.totalValue >= config.aMinValue) {
      classification = "A";
    } else if (config.bMinValue !== undefined && item.totalValue >= config.bMinValue) {
      classification = "B";
    } else {
      // Fall back to Pareto percentages
      const percentileRank = (i + 1) / sorted.length;
      if (percentileRank <= config.aPercentageThreshold! && cumulativePercentage <= 80) {
        classification = "A";
      } else if (percentileRank <= config.bPercentageThreshold! && cumulativePercentage <= 95) {
        classification = "B";
      } else {
        classification = "C";
      }
    }

    results.push({
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      costPrice: item.costPrice,
      totalValue: item.totalValue,
      classification,
      percentageOfTotalValue,
      cumulativePercentage,
    });
  }

  return results;
}

/**
 * Summary statistics for ABC classification results.
 * Useful for showing overview cards in the UI.
 */
export interface ABCSummary {
  totalItems: number;
  totalValue: number;
  classA: {
    count: number;
    value: number;
    percentage: number;
  };
  classB: {
    count: number;
    value: number;
    percentage: number;
  };
  classC: {
    count: number;
    value: number;
    percentage: number;
  };
}

export function summarizeABC(results: ABCResult[]): ABCSummary {
  const summary: ABCSummary = {
    totalItems: results.length,
    totalValue: results.reduce((sum, r) => sum + r.totalValue, 0),
    classA: { count: 0, value: 0, percentage: 0 },
    classB: { count: 0, value: 0, percentage: 0 },
    classC: { count: 0, value: 0, percentage: 0 },
  };

  for (const result of results) {
    const bucket = summary[`class${result.classification}`];
    bucket.count += 1;
    bucket.value += result.totalValue;
  }

  // Calculate percentages
  if (summary.totalValue > 0) {
    summary.classA.percentage = (summary.classA.value / summary.totalValue) * 100;
    summary.classB.percentage = (summary.classB.value / summary.totalValue) * 100;
    summary.classC.percentage = (summary.classC.value / summary.totalValue) * 100;
  }

  return summary;
}
