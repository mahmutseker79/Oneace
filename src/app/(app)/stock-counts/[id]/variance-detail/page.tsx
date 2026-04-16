/**
 * Phase B6.1 — Variance Detail Page
 *
 * Read-only analytical view of count variances. Complements /reconcile
 * (which posts adjustments) with a drillable, filterable view focused
 * on *understanding* the variances before acting on them.
 *
 * Differs from reconcile in two important ways:
 *   1. No form — nothing posts from this page.
 *   2. Status breakdown + top-N variance tables per status.
 *
 * Accessible from the count detail page's "Variance detail" button once
 * the count is IN_PROGRESS or COMPLETED.
 */

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import {
  type VarianceRow,
  type VarianceStatus,
  calculateVariances,
  summarizeVariances,
} from "@/lib/stockcount/variance";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.stockCounts.varianceDetail.metaTitle} — OneAce`,
  };
}

export default async function VarianceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const count = await db.stockCount.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      snapshots: { orderBy: { createdAt: "asc" } },
      entries: {
        select: {
          itemId: true,
          warehouseId: true,
          countedQuantity: true,
        },
      },
    },
  });
  if (!count) notFound();

  // Resolve item + warehouse labels in bulk.
  const itemIds = Array.from(new Set(count.snapshots.map((s) => s.itemId)));
  const warehouseIds = Array.from(new Set(count.snapshots.map((s) => s.warehouseId)));

  const [items, warehouses] = await Promise.all([
    itemIds.length > 0
      ? db.item.findMany({
          where: { id: { in: itemIds }, organizationId: membership.organizationId },
          select: { id: true, sku: true, name: true, unit: true, costPrice: true },
        })
      : Promise.resolve([]),
    warehouseIds.length > 0
      ? db.warehouse.findMany({
          where: { id: { in: warehouseIds }, organizationId: membership.organizationId },
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve([]),
  ]);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

  // Same pure function used on reconcile + detail — identical numbers.
  const varianceRows: VarianceRow[] = calculateVariances(
    count.snapshots.map((s) => ({
      itemId: s.itemId,
      warehouseId: s.warehouseId,
      expectedQuantity: s.expectedQuantity,
    })),
    count.entries,
  );
  const summary = summarizeVariances(varianceRows);

  // ---------------- Financial impact ----------------
  //
  // Multiply each row's signed variance by the item's cost price.
  // Items without a cost price contribute 0 to the total (cleanly opt-in).
  const enriched = varianceRows.map((row) => {
    const item = itemById.get(row.itemId);
    const warehouse = warehouseById.get(row.warehouseId);
    const cost = item?.costPrice ? Number(item.costPrice) : 0;
    const impact = row.variance * cost;
    return {
      ...row,
      sku: item?.sku ?? row.itemId,
      name: item?.name ?? "",
      unit: item?.unit ?? "",
      warehouseCode: warehouse?.code ?? "",
      warehouseName: warehouse?.name ?? "",
      costPrice: cost,
      impact,
    };
  });

  const netFinancialImpact = enriched.reduce((sum, row) => sum + row.impact, 0);

  // ---------------- Top-N tables per status ----------------
  type EnrichedRow = (typeof enriched)[number];
  const byStatus = (status: VarianceStatus): EnrichedRow[] =>
    enriched
      .filter((r) => r.status === status)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 25);

  const topOver = byStatus("over");
  const topUnder = byStatus("under");
  const topWithin = byStatus("within_tolerance");

  const countLabel = count.name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.stockCounts.varianceDetail.heading}
        description={t.stockCounts.varianceDetail.subtitle}
        backHref={`/stock-counts/${count.id}`}
        breadcrumb={[
          { label: t.stockCounts.heading, href: "/stock-counts" },
          { label: countLabel },
          { label: t.stockCounts.varianceDetail.heading },
        ]}
      />

      {/* Summary tiles — six counts + financial impact */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <SummaryTile label="Total items" value={summary.totalItems} />
        <SummaryTile label="Matched" value={summary.matched} tone="neutral" />
        <SummaryTile label="Within tolerance" value={summary.withinTolerance} tone="neutral" />
        <SummaryTile label="Over" value={summary.over} tone="positive" />
        <SummaryTile label="Under" value={summary.under} tone="negative" />
        <SummaryTile
          label="Net unit variance"
          value={summary.netUnitVariance}
          tone={
            summary.netUnitVariance > 0
              ? "positive"
              : summary.netUnitVariance < 0
                ? "negative"
                : "neutral"
          }
          signed
        />
      </div>

      {/* Financial impact card */}
      <Card>
        <CardHeader>
          <CardTitle>Financial impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat
              label="Net impact"
              value={formatCurrency(netFinancialImpact)}
              tone={
                netFinancialImpact > 0 ? "positive" : netFinancialImpact < 0 ? "negative" : "neutral"
              }
            />
            <Stat label="Total |variance| units" value={String(summary.totalAbsVariance)} />
            <Stat
              label="Items tracked"
              value={`${summary.totalItems}`}
              hint={`across ${warehouses.length} warehouse${warehouses.length === 1 ? "" : "s"}`}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Impact uses each item&apos;s cost price. Items without a cost contribute 0.
          </p>
        </CardContent>
      </Card>

      {/* Top variances per status */}
      <VarianceTable
        title="Top shortages (under)"
        emptyLabel="No under-counted items."
        rows={topUnder}
        tone="destructive"
      />
      <VarianceTable
        title="Top surpluses (over)"
        emptyLabel="No over-counted items."
        rows={topOver}
        tone="positive"
      />
      <VarianceTable
        title="Within tolerance"
        emptyLabel="No items landed in the tolerance band."
        rows={topWithin}
        tone="secondary"
      />

      <div className="flex gap-2">
        <Link href={`/stock-counts/${count.id}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to count
          </Button>
        </Link>
        <Link href={`/stock-counts/${count.id}/reconcile`}>
          <Button>Go to reconcile</Button>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers — colocated to keep the page self-contained.
// ---------------------------------------------------------------------------

type Tone = "neutral" | "positive" | "negative";

function SummaryTile({
  label,
  value,
  tone = "neutral",
  signed = false,
}: {
  label: string;
  value: number;
  tone?: Tone;
  signed?: boolean;
}) {
  const display = signed && value > 0 ? `+${value}` : String(value);
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{display}</div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  tone?: Tone;
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function VarianceTable({
  title,
  emptyLabel,
  rows,
  tone,
}: {
  title: string;
  emptyLabel: string;
  rows: ReadonlyArray<{
    sku: string;
    name: string;
    unit: string;
    warehouseCode: string;
    expectedQuantity: number;
    countedQuantity: number;
    variance: number;
    variancePercent: number | null;
    impact: number;
  }>;
  tone: "destructive" | "positive" | "secondary";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>WH</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Counted</TableHead>
                <TableHead className="text-right">Δ units</TableHead>
                <TableHead className="text-right">Δ %</TableHead>
                <TableHead className="text-right">Impact</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.sku}::${row.warehouseCode}`}>
                  <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.warehouseCode}</TableCell>
                  <TableCell className="text-right">{row.expectedQuantity}</TableCell>
                  <TableCell className="text-right">{row.countedQuantity}</TableCell>
                  <TableCell className="text-right">
                    {row.variance > 0 ? `+${row.variance}` : row.variance}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.variancePercent === null ? "—" : `${row.variancePercent.toFixed(1)}%`}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(row.impact)}</TableCell>
                  <TableCell>
                    {tone === "destructive" ? (
                      <Badge variant="destructive">Under</Badge>
                    ) : tone === "positive" ? (
                      <Badge className="bg-emerald-600">Over</Badge>
                    ) : (
                      <Badge variant="secondary">Within</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toFixed(2)}`;
}
