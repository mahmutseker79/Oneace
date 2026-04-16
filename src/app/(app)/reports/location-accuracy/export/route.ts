import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { serializeCsv, csvResponse, todayIsoDate } from "@/lib/csv";
import type { CsvColumn } from "@/lib/csv";

type ExportRow = {
  location: string;
  countedLines: string;
  accurateLines: string;
  accuracyPercent: string;
  totalVarianceValue: string;
};

export async function GET() {
  const { membership } = await requireActiveMembership();

  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({ error: "Exports are available on Pro and Business plans." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const stockCounts = await db.stockCount.findMany({
    where: {
      organizationId: membership.organizationId,
      state: "COMPLETED",
    },
    select: {
      id: true,
      warehouseId: true,
      warehouse: { select: { id: true, name: true } },
    },
  });

  if (stockCounts.length === 0) {
    const columns: CsvColumn<ExportRow>[] = [
      { header: "Location", value: (r) => r.location },
      { header: "Counted Lines", value: (r) => r.countedLines },
      { header: "Accurate Lines", value: (r) => r.accurateLines },
      { header: "Accuracy %", value: (r) => r.accuracyPercent },
      { header: "Total Variance Value", value: (r) => r.totalVarianceValue },
    ];
    const csv = serializeCsv([], columns);
    const filename = `location-accuracy-${todayIsoDate()}.csv`;
    return csvResponse(filename, csv);
  }

  const countIds = stockCounts.map((c) => c.id);

  const snapshots = await db.countSnapshot.findMany({
    where: { countId: { in: countIds } },
    select: {
      countId: true,
      itemId: true,
      expectedQuantity: true,
    },
  });

  const entries = await db.countEntry.findMany({
    where: { countId: { in: countIds } },
    select: {
      countId: true,
      itemId: true,
      countedQuantity: true,
    },
  });

  const snapshotsByCount = new Map<string, typeof snapshots>();
  const entriesByCount = new Map<string, typeof entries>();

  for (const snap of snapshots) {
    if (!snapshotsByCount.has(snap.countId)) {
      snapshotsByCount.set(snap.countId, []);
    }
    snapshotsByCount.get(snap.countId)!.push(snap);
  }

  for (const entry of entries) {
    if (!entriesByCount.has(entry.countId)) {
      entriesByCount.set(entry.countId, []);
    }
    entriesByCount.get(entry.countId)!.push(entry);
  }

  const accuracyByWarehouse = new Map<string, { warehouseId: string; warehouseName: string; countedLines: number; accurateLines: number; totalVarianceValue: number }>();

  for (const countId of countIds) {
    const countSnaps = snapshotsByCount.get(countId) ?? [];
    const countEnts = entriesByCount.get(countId) ?? [];

    const countMap = stockCounts.find((c) => c.id === countId);
    const warehouseId = countMap?.warehouseId || "unknown";
    const warehouseName = countMap?.warehouse?.name || "Unknown";

    if (!accuracyByWarehouse.has(warehouseId)) {
      accuracyByWarehouse.set(warehouseId, {
        warehouseId,
        warehouseName,
        countedLines: 0,
        accurateLines: 0,
        totalVarianceValue: 0,
      });
    }

    const wh = accuracyByWarehouse.get(warehouseId)!;
    wh.countedLines += countSnaps.length;

    for (const snap of countSnaps) {
      const entry = countEnts.find((e) => e.itemId === snap.itemId);
      const countedQty = entry?.countedQuantity ?? 0;
      const variance = countedQty - snap.expectedQuantity;

      if (variance === 0) {
        wh.accurateLines += 1;
      } else {
        wh.totalVarianceValue += Math.abs(variance);
      }
    }
  }

  const rows: ExportRow[] = Array.from(accuracyByWarehouse.values()).map((row) => {
    const accuracy = row.countedLines > 0 ? (row.accurateLines / row.countedLines) * 100 : 0;
    const accuracyPercent = Math.round(accuracy * 10) / 10;
    return {
      location: row.warehouseName,
      countedLines: String(row.countedLines),
      accurateLines: String(row.accurateLines),
      accuracyPercent: String(accuracyPercent),
      totalVarianceValue: String(row.totalVarianceValue),
    };
  });

  const columns: CsvColumn<ExportRow>[] = [
    { header: "Location", value: (r) => r.location },
    { header: "Counted Lines", value: (r) => r.countedLines },
    { header: "Accurate Lines", value: (r) => r.accurateLines },
    { header: "Accuracy %", value: (r) => r.accuracyPercent },
    { header: "Total Variance Value", value: (r) => r.totalVarianceValue },
  ];

  const csv = serializeCsv(rows, columns);
  const filename = `location-accuracy-${todayIsoDate()}.csv`;

  return csvResponse(filename, csv);
}
