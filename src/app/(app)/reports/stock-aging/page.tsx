/**
 * Phase D — Stock Aging Report
 *
 * Buckets every item in the org by how long ago its most recent
 * stock movement happened (falling back to `createdAt` for items
 * that have never moved). The goal is to surface "dead" inventory
 * — stock that's tying up working capital without rotating.
 *
 * Buckets: 0-30d, 31-60d, 61-90d, 91-180d, 181-365d, 365d+.
 *
 * Server component. Plan-gated on `reports` and requires an active
 * membership; no rate-limit because there's no PDF/XLSX emission
 * here (just a page render — exports live in a separate route).
 */

import { AlertTriangle, Clock, DollarSign, Package } from "lucide-react";
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
import { formatCurrency, formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: `Stock Aging — ${t.reports.metaTitle}` };
}

type Bucket = {
  key: string;
  label: string;
  minDays: number;
  maxDays: number | null; // null = open-ended
};

const BUCKETS: Bucket[] = [
  { key: "fresh", label: "0-30 days", minDays: 0, maxDays: 30 },
  { key: "recent", label: "31-60 days", minDays: 31, maxDays: 60 },
  { key: "aging", label: "61-90 days", minDays: 61, maxDays: 90 },
  { key: "stale", label: "91-180 days", minDays: 91, maxDays: 180 },
  { key: "old", label: "181-365 days", minDays: 181, maxDays: 365 },
  { key: "dead", label: "365+ days", minDays: 366, maxDays: null },
];

interface AgingRow {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  costPrice: number;
  value: number;
  lastActivity: Date;
  daysSinceActivity: number;
  bucketKey: string;
  bucketLabel: string;
  source: "movement" | "creation";
}

function bucketFor(days: number): Bucket {
  for (const b of BUCKETS) {
    if (days >= b.minDays && (b.maxDays === null || days <= b.maxDays)) return b;
  }
  // Fallback — should never happen because the last bucket is open-ended.
  return BUCKETS[BUCKETS.length - 1]!;
}

export default async function StockAgingReportPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();
  const plan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";

  if (!hasPlanCapability(plan, "reports")) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Stock Aging"
          description="Identify slow-moving and dead stock"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Stock Aging" }]}
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

  // 1) Items + their aggregate on-hand (summed across warehouses/bins)
  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId, status: "ACTIVE" },
    select: {
      id: true,
      sku: true,
      name: true,
      costPrice: true,
      createdAt: true,
      stockLevels: { select: { quantity: true } },
    },
  });

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Stock Aging"
          description="Identify slow-moving and dead stock"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Stock Aging" }]}
        />
        <EmptyState
          icon={Package}
          title="No items yet"
          description="Add items to see aging analysis."
        />
      </div>
    );
  }

  // 2) Most-recent movement per item — one query, grouped.
  const recentMovements = await db.stockMovement.groupBy({
    by: ["itemId"],
    where: {
      organizationId: membership.organizationId,
      itemId: { in: items.map((i) => i.id) },
    },
    _max: { createdAt: true },
  });
  const lastMoveByItem = new Map<string, Date>();
  for (const row of recentMovements) {
    if (row._max.createdAt) lastMoveByItem.set(row.itemId, row._max.createdAt);
  }

  // 3) Build aging rows. Items with no on-hand stock are excluded from
  // the table (they'd clutter it with zero-value rows) but still counted
  // toward bucket totals if the user wants a purely temporal view —
  // we opted to exclude them entirely for signal-to-noise.
  const rows: AgingRow[] = [];
  for (const item of items) {
    const quantity = item.stockLevels.reduce((s, l) => s + l.quantity, 0);
    if (quantity <= 0) continue;

    const lastMove = lastMoveByItem.get(item.id);
    const lastActivity = lastMove ?? item.createdAt;
    const source: "movement" | "creation" = lastMove ? "movement" : "creation";
    const daysSinceActivity = Math.max(
      0,
      Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const bucket = bucketFor(daysSinceActivity);
    const costPrice = item.costPrice ? Number(item.costPrice.toString()) : 0;
    const value = costPrice * quantity;

    rows.push({
      itemId: item.id,
      sku: item.sku,
      name: item.name,
      quantity,
      costPrice,
      value,
      lastActivity,
      daysSinceActivity,
      bucketKey: bucket.key,
      bucketLabel: bucket.label,
      source,
    });
  }

  // 4) Summaries per bucket.
  const bucketSummaries = BUCKETS.map((b) => {
    const itemsInBucket = rows.filter((r) => r.bucketKey === b.key);
    const qty = itemsInBucket.reduce((s, r) => s + r.quantity, 0);
    const value = itemsInBucket.reduce((s, r) => s + r.value, 0);
    return { ...b, itemCount: itemsInBucket.length, qty, value };
  });

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const deadValue = rows
    .filter((r) => r.bucketKey === "dead" || r.bucketKey === "old")
    .reduce((s, r) => s + r.value, 0);
  const deadShare = totalValue > 0 ? (deadValue / totalValue) * 100 : 0;

  // Top 100 oldest items for the table (most useful signal).
  const tableRows = [...rows]
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
    .slice(0, 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Aging"
        description="Identify slow-moving and dead stock by days since last activity"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Stock Aging" }]}
      />

      <ReportSummaryCard
        metrics={[
          {
            label: "Items on hand",
            value: formatNumber(rows.length, region.numberLocale),
            icon: Package,
          },
          {
            label: "Total inventory value",
            value: formatCurrency(totalValue, {
              currency: region.currency,
              locale: region.numberLocale,
            }),
            icon: DollarSign,
          },
          {
            label: "Dead / old (>180d)",
            value: formatCurrency(deadValue, {
              currency: region.currency,
              locale: region.numberLocale,
            }),
            icon: AlertTriangle,
          },
          {
            label: "Dead share",
            value: `${deadShare.toFixed(1)}%`,
            icon: Clock,
          },
        ]}
      />

      {/* Bucket cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {bucketSummaries.map((b) => {
          const share = totalValue > 0 ? (b.value / totalValue) * 100 : 0;
          return (
            <Card key={b.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {b.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold">{b.itemCount}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(b.qty, region.numberLocale)} units
                </p>
                <p className="text-sm font-medium">
                  {formatCurrency(b.value, {
                    currency: region.currency,
                    locale: region.numberLocale,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">{share.toFixed(1)}% of total</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail table — top 100 oldest */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Oldest on-hand items</CardTitle>
          <p className="text-sm text-muted-foreground">
            Top 100 items by days since last activity. Items that never moved fall back to
            their creation date.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Days inactive</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead>Signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((r) => (
                <TableRow key={r.itemId}>
                  <TableCell className="font-mono text-sm">{r.sku}</TableCell>
                  <TableCell className="text-sm">{r.name}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(r.quantity, region.numberLocale)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(r.costPrice, {
                      currency: region.currency,
                      locale: region.numberLocale,
                    })}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(r.value, {
                      currency: region.currency,
                      locale: region.numberLocale,
                    })}
                  </TableCell>
                  <TableCell className="text-right text-sm">{r.daysSinceActivity}</TableCell>
                  <TableCell className="text-sm">{r.bucketLabel}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.source === "movement" ? "last movement" : "created (no moves)"}
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
