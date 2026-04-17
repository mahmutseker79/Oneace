/**
 * Phase D — Movement Analytics Report
 *
 * Aggregated view of StockMovement activity, complementing the
 * per-row Movement History report. Shows:
 *   - Totals by movement type over the last 90 days
 *   - Daily activity chart data (as a table) for the last 30 days
 *   - Top 25 most active items by movement count
 *
 * Server component; plan-gated on `reports`. Does not paginate —
 * rows are pre-aggregated so the result set is always small.
 */

import { ArrowDown, ArrowLeftRight, ArrowUp, Minus, Package } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: `Movement Analytics — ${t.reports.metaTitle}` };
}

type MovementType =
  | "RECEIPT"
  | "ISSUE"
  | "ADJUSTMENT"
  | "TRANSFER"
  | "BIN_TRANSFER"
  | "COUNT";

const MOVEMENT_TYPES: MovementType[] = [
  "RECEIPT",
  "ISSUE",
  "ADJUSTMENT",
  "TRANSFER",
  "BIN_TRANSFER",
  "COUNT",
];

const TYPE_LABELS: Record<MovementType, string> = {
  RECEIPT: "Receipts",
  ISSUE: "Issues",
  ADJUSTMENT: "Adjustments",
  TRANSFER: "Warehouse transfers",
  BIN_TRANSFER: "Bin transfers",
  COUNT: "Count movements",
};

function dayKey(d: Date): string {
  // ISO date (YYYY-MM-DD) — stable across locales.
  return d.toISOString().slice(0, 10);
}

export default async function MovementAnalyticsReportPage() {
  const { membership } = await requireActiveMembership();
  const region = await getRegion();
  const plan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";

  if (!hasPlanCapability(plan, "reports")) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Movement Analytics"
          description="Aggregate trends across all stock movements"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Movement Analytics" }]}
        />
        <UpgradePrompt
          reason="Reports are available on Pro and Business plans."
          requiredPlan="PRO"
          variant="banner"
          description="Upgrade to access advanced reports."
        />
      </div>
    );
  }

  const now = new Date();
  const from90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const from30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ----- Query 1: 90-day counts by type -----
  const grouped = await db.stockMovement.groupBy({
    by: ["type"],
    where: {
      organizationId: membership.organizationId,
      createdAt: { gte: from90 },
    },
    _count: { _all: true },
    _sum: { quantity: true },
  });

  const typeTotals = MOVEMENT_TYPES.map((t) => {
    const row = grouped.find((g) => g.type === t);
    return {
      type: t,
      label: TYPE_LABELS[t],
      count: row?._count?._all ?? 0,
      totalQty: row?._sum?.quantity ?? 0,
    };
  });

  const totalMovements = typeTotals.reduce((s, r) => s + r.count, 0);
  const totalQty = typeTotals.reduce((s, r) => s + r.totalQty, 0);

  // ----- Query 2: last 30 days, all rows (needed for per-day split) -----
  // Capped at 5k rows because the groupBy above already gave us totals;
  // this is only for the "daily" table and 5k is plenty for a dense org.
  const recent = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      createdAt: { gte: from30 },
    },
    select: { type: true, quantity: true, createdAt: true, itemId: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const dailyMap = new Map<
    string,
    { date: string; count: number; qty: number }
  >();
  for (const m of recent) {
    const k = dayKey(m.createdAt);
    const cur = dailyMap.get(k) ?? { date: k, count: 0, qty: 0 };
    cur.count += 1;
    cur.qty += m.quantity;
    dailyMap.set(k, cur);
  }
  const dailyRows = Array.from(dailyMap.values()).sort((a, b) =>
    a.date < b.date ? 1 : -1,
  );

  // ----- Query 3: top 25 most-active items over the 90-day window -----
  const topItemsAgg = await db.stockMovement.groupBy({
    by: ["itemId"],
    where: {
      organizationId: membership.organizationId,
      createdAt: { gte: from90 },
    },
    _count: { _all: true },
    _sum: { quantity: true },
    orderBy: { _count: { itemId: "desc" } },
    take: 25,
  });

  const topItemIds = topItemsAgg.map((r) => r.itemId);
  const itemMeta = topItemIds.length
    ? await db.item.findMany({
        where: { id: { in: topItemIds } },
        select: { id: true, sku: true, name: true },
      })
    : [];
  const itemMetaById = new Map(itemMeta.map((i) => [i.id, i]));

  const topItems = topItemsAgg.map((r) => {
    const meta = itemMetaById.get(r.itemId);
    return {
      itemId: r.itemId,
      sku: meta?.sku ?? "—",
      name: meta?.name ?? "(deleted item)",
      count: r._count?._all ?? 0,
      qty: r._sum?.quantity ?? 0,
    };
  });

  if (totalMovements === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Movement Analytics"
          description="Aggregate trends across all stock movements"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Movement Analytics" }]}
        />
        <EmptyState
          icon={ArrowLeftRight}
          title="No movements yet"
          description="Movement analytics will appear here once you start receiving, issuing, or transferring stock."
        />
      </div>
    );
  }

  const receipts = typeTotals.find((t) => t.type === "RECEIPT");
  const issues = typeTotals.find((t) => t.type === "ISSUE");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movement Analytics"
        description="Aggregated trends across all stock movements for the last 90 days"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Movement Analytics" }]}
      />

      <ReportSummaryCard
        metrics={[
          {
            label: "Total movements (90d)",
            value: formatNumber(totalMovements, region.numberLocale),
            icon: ArrowLeftRight,
          },
          {
            label: "Total units moved",
            value: formatNumber(totalQty, region.numberLocale),
            icon: Package,
          },
          {
            label: "Receipts",
            value: formatNumber(receipts?.count ?? 0, region.numberLocale),
            icon: ArrowUp,
          },
          {
            label: "Issues",
            value: formatNumber(issues?.count ?? 0, region.numberLocale),
            icon: ArrowDown,
          },
        ]}
      />

      {/* Per-type breakdown */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {typeTotals.map((t) => {
          const share = totalMovements > 0 ? (t.count / totalMovements) * 100 : 0;
          return (
            <Card key={t.type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold">
                  {formatNumber(t.count, region.numberLocale)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(t.totalQty, region.numberLocale)} units
                </p>
                <p className="text-xs text-muted-foreground">{share.toFixed(1)}% of total</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Daily activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily activity (last 30 days)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Count and total quantity of movements recorded each day.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Movements</TableHead>
                <TableHead className="text-right">Units</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    No movements in the last 30 days.
                  </TableCell>
                </TableRow>
              ) : (
                dailyRows.map((r) => (
                  <TableRow key={r.date}>
                    <TableCell className="font-mono text-sm">{r.date}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(r.count, region.numberLocale)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(r.qty, region.numberLocale)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top movers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 25 most-active items (last 90 days)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Items with the highest number of movement entries — good candidates for fast-
            moving SKU tracking.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Movements</TableHead>
                <TableHead className="text-right">Total units</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    <Minus className="inline h-4 w-4 mr-1" /> No data.
                  </TableCell>
                </TableRow>
              ) : (
                topItems.map((r, i) => (
                  <TableRow key={r.itemId}>
                    <TableCell className="font-mono text-sm">
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      {r.sku}
                    </TableCell>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatNumber(r.count, region.numberLocale)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(r.qty, region.numberLocale)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
