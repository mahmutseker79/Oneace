import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { canReconcile } from "@/lib/stockcount/machine";
import {
  type VarianceStatus,
  calculateVariances,
  summarizeVariances,
} from "@/lib/stockcount/variance";

import { ReconcileForm, type ReconcileFormLabels } from "./reconcile-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CountState = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.stockCounts.reconcile.metaTitle };
}

export default async function StockCountReconcilePage({ params }: PageProps) {
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

  if (!count) {
    notFound();
  }

  const state = count.state as CountState;

  // Resolve item + warehouse labels in bulk — same approach as detail
  // page, keeps the query plan flat.
  const itemIds = Array.from(new Set(count.snapshots.map((s) => s.itemId)));
  const warehouseIds = Array.from(new Set(count.snapshots.map((s) => s.warehouseId)));

  const [items, warehouses] = await Promise.all([
    itemIds.length > 0
      ? db.item.findMany({
          where: { id: { in: itemIds }, organizationId: membership.organizationId },
          select: { id: true, sku: true, name: true, unit: true },
        })
      : Promise.resolve([]),
    warehouseIds.length > 0
      ? db.warehouse.findMany({
          where: { id: { in: warehouseIds }, organizationId: membership.organizationId },
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve([]),
  ]);

  const itemById = new Map(items.map((item) => [item.id, item]));
  const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

  // Same pure function used on the detail preview AND the server
  // complete action. This is the "preview = post" guarantee.
  const varianceRows = calculateVariances(
    count.snapshots.map((s) => ({
      itemId: s.itemId,
      warehouseId: s.warehouseId,
      expectedQuantity: s.expectedQuantity,
    })),
    count.entries,
  );
  const summary = summarizeVariances(varianceRows);

  const reconcileLabels: ReconcileFormLabels = {
    consequenceTitle: t.stockCounts.reconcile.consequenceTitle,
    consequenceBody: t.stockCounts.reconcile.consequenceBody,
    applyLabel: t.stockCounts.reconcile.applyLabel,
    applyHelp: t.stockCounts.reconcile.applyHelp,
    applyWarning: t.stockCounts.reconcile.applyWarning,
    submit: t.stockCounts.reconcile.submit,
    successTitle: t.stockCounts.reconcile.successTitle,
    successBody: (posted: number) =>
      t.stockCounts.reconcile.successBody.replace("{posted}", String(posted)),
    successBodyNone: t.stockCounts.reconcile.successBodyNone,
    viewCount: t.stockCounts.reconcile.viewCount,
    viewAll: t.stockCounts.reconcile.viewAll,
    genericError: t.stockCounts.errors.completeFailed,
  };

  function varianceBadge(status: VarianceStatus) {
    if (status === "match") return <Badge variant="outline">{t.stockCounts.variance.match}</Badge>;
    if (status === "within_tolerance")
      return <Badge variant="secondary">{t.stockCounts.variance.withinTolerance}</Badge>;
    if (status === "over")
      return <Badge className="bg-emerald-600">{t.stockCounts.variance.over}</Badge>;
    return <Badge variant="destructive">{t.stockCounts.variance.under}</Badge>;
  }

  const canRunReconcile = canReconcile(state);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/stock-counts/${count.id}`}>
            <ArrowLeft className="h-4 w-4" />
            {t.stockCounts.reconcile.backToDetail}
          </Link>
        </Button>
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-semibold">{t.stockCounts.reconcile.heading}</h1>
        <p className="text-muted-foreground">{t.stockCounts.reconcile.subtitle}</p>
        <p className="mt-2 text-sm text-muted-foreground">{count.name}</p>
      </div>

      {/* Summary tiles */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <SummaryTile label={t.stockCounts.reconcile.tileTotal} value={summary.totalItems} />
        <SummaryTile
          label={t.stockCounts.reconcile.tileMatched}
          value={summary.matched}
          tone="neutral"
        />
        <SummaryTile
          label={t.stockCounts.reconcile.tileWithin}
          value={summary.withinTolerance}
          tone="neutral"
        />
        <SummaryTile
          label={t.stockCounts.reconcile.tileOver}
          value={summary.over}
          tone="positive"
        />
        <SummaryTile
          label={t.stockCounts.reconcile.tileUnder}
          value={summary.under}
          tone="negative"
        />
        <SummaryTile
          label={t.stockCounts.reconcile.tileNet}
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

      {/* Variance detail table */}
      <Card>
        <CardHeader>
          <CardTitle>{t.stockCounts.detail.itemsTableHeading}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {varianceRows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {t.stockCounts.detail.itemsTableEmpty}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.stockCounts.detail.columnSku}</TableHead>
                  <TableHead>{t.stockCounts.detail.columnItem}</TableHead>
                  <TableHead>{t.stockCounts.detail.columnWarehouse}</TableHead>
                  <TableHead className="text-right">
                    {t.stockCounts.detail.columnExpected}
                  </TableHead>
                  <TableHead className="text-right">{t.stockCounts.detail.columnCounted}</TableHead>
                  <TableHead className="text-right">
                    {t.stockCounts.detail.columnVariance}
                  </TableHead>
                  <TableHead>{t.stockCounts.detail.columnStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {varianceRows.map((row) => {
                  const item = itemById.get(row.itemId);
                  const warehouse = warehouseById.get(row.warehouseId);
                  return (
                    <TableRow key={`${row.itemId}-${row.warehouseId}`}>
                      <TableCell className="font-mono text-xs">{item?.sku ?? "—"}</TableCell>
                      <TableCell>{item?.name ?? row.itemId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {warehouse?.name ?? row.warehouseId}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.expectedQuantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.countedQuantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={
                            row.variance > 0
                              ? "text-emerald-600"
                              : row.variance < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }
                        >
                          {row.variance > 0 ? "+" : ""}
                          {row.variance}
                        </span>
                      </TableCell>
                      <TableCell>{varianceBadge(row.status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reconcile form or disabled notice */}
      {canRunReconcile ? (
        <Card>
          <CardContent className="pt-6">
            <ReconcileForm countId={count.id} labels={reconcileLabels} />
          </CardContent>
        </Card>
      ) : (
        <output className="block rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          {t.stockCounts.reconcile.cannotReconcile}
        </output>
      )}
    </div>
  );
}

type SummaryTileProps = {
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "negative";
  signed?: boolean;
};

function SummaryTile({ label, value, tone = "neutral", signed = false }: SummaryTileProps) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  const prefix = signed && value > 0 ? "+" : "";
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
        {prefix}
        {value}
      </p>
    </div>
  );
}
