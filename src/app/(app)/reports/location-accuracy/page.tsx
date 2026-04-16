import { CheckCircle, Gauge, MapPin } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import { PageHeader } from "@/components/ui/page-header";
import { ReportSummaryCard } from "@/components/ui/report-summary-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";import { requireActiveMembership } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `Location Accuracy Report — ${t.reports.metaTitle}`,
  };
}

type LocationAccuracyRow = {
  warehouseId: string;
  warehouseName: string;
  countedLines: number;
  accurateLines: number;
  accuracyPercent: number;
  totalVarianceValue: number;
};

type ChartData = {
  location: string;
  accuracy: number;
};

export default async function LocationAccuracyReportPage() {
  const { membership } = await requireActiveMembership();
  const _t = await getMessages();
  const region = await getRegion();

  // Fetch completed stock counts
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
    return (
      <div className="space-y-6">
        <PageHeader
          title="Location Accuracy Report"
          description="Warehouse inventory accuracy metrics"
          backHref="/reports"
          breadcrumb={[
            { label: "Reports", href: "/reports" },
            { label: "Location Accuracy Report" },
          ]}
        />
        <EmptyState
          icon={MapPin}
          title="No completed counts"
          description="Location accuracy will appear here once stock counts are completed."
        />
      </div>
    );
  }

  const countIds = stockCounts.map((c) => c.id);
  const warehouseMap = new Map<string, string>();
  for (const sc of stockCounts) {
    if (sc.warehouseId) {
      warehouseMap.set(sc.warehouseId, sc.warehouse?.name ?? "Unknown");
    }
  }

  // Fetch count snapshots and entries for accuracy calculation
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

  // Group snapshots and entries by count
  const snapshotsByCount = new Map<string, typeof snapshots>();
  const entriesByCount = new Map<string, typeof entries>();

  for (const snap of snapshots) {
    if (!snapshotsByCount.has(snap.countId)) {
      snapshotsByCount.set(snap.countId, []);
    }
    snapshotsByCount.get(snap.countId)?.push(snap);
  }

  for (const entry of entries) {
    if (!entriesByCount.has(entry.countId)) {
      entriesByCount.set(entry.countId, []);
    }
    entriesByCount.get(entry.countId)?.push(entry);
  }

  // Calculate accuracy per warehouse
  const accuracyByWarehouse = new Map<string, LocationAccuracyRow>();

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
        accuracyPercent: 0,
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

  const rows = Array.from(accuracyByWarehouse.values()).map((row) => {
    const accuracy = row.countedLines > 0 ? (row.accurateLines / row.countedLines) * 100 : 0;
    return { ...row, accuracyPercent: Math.round(accuracy * 10) / 10 };
  });

  const chartData: ChartData[] = rows.map((row) => ({
    location: row.warehouseName,
    accuracy: row.accuracyPercent,
  }));

  const avgAccuracy =
    rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.accuracyPercent, 0) / rows.length) * 10) / 10
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Location Accuracy Report"
        description="Warehouse inventory accuracy metrics"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Location Accuracy Report" }]}
        actions={<ExportButton href="/reports/location-accuracy/export">Export CSV</ExportButton>}
      />

      <ReportSummaryCard
        metrics={[
          {
            label: "Average Accuracy",
            value: `${formatNumber(avgAccuracy, region.numberLocale)}%`,
            icon: Gauge,
            trendDirection:
              avgAccuracy >= 95 ? "positive" : avgAccuracy >= 85 ? "neutral" : "negative",
          },
          {
            label: "Locations Measured",
            value: rows.length,
            icon: MapPin,
          },
          {
            label: "Accurate Lines",
            value: rows.reduce((s, r) => s + r.accurateLines, 0),
            icon: CheckCircle,
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Average Accuracy</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(avgAccuracy, region.numberLocale)}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Locations Measured</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(rows.length, region.numberLocale)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accuracy by Location</CardTitle>
          </CardHeader>
          <CardContent>{/* Chart removed for server component compatibility */}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accuracy Details by Location</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Counted Lines</TableHead>
                <TableHead className="text-right">Accurate Lines</TableHead>
                <TableHead className="text-right">Accuracy %</TableHead>
                <TableHead className="text-right">Total Variance Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.warehouseId}>
                  <TableCell className="text-sm font-medium">{row.warehouseName}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.countedLines, region.numberLocale)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.accurateLines, region.numberLocale)}
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm font-medium ${row.accuracyPercent >= 95 ? "text-green-600" : row.accuracyPercent >= 85 ? "text-orange-600" : "text-red-600"}`}
                  >
                    {formatNumber(row.accuracyPercent, region.numberLocale)}%
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.totalVarianceValue, region.numberLocale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
