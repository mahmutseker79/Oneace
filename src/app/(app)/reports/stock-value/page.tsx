import { ChevronLeft, DollarSign, Download, PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { format, getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Stock-value report — totals the at-cost value of all on-hand inventory,
 * rolls it up by warehouse, and shows a flat per-item breakdown at the
 * bottom.
 *
 * Why "at cost" instead of "at sale price": matching the accounting book
 * value is what finance people expect when they ask "what's my inventory
 * worth right now?" — valuing at sale price would double-count the
 * margin that hasn't been earned yet. Items with no cost price default
 * to zero and are called out as warnings in a summary line so the user
 * knows their total is a lower bound.
 *
 * Currency handling: we use the *organization's* region currency for the
 * aggregate totals (it's the only one that makes sense for a mixed bag
 * of items), but each item row still shows its own currency in the per-
 * item breakdown. Mixed-currency orgs are rare in MVP scope but we don't
 * want to silently coerce a EUR item into USD.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.reports.stockValue.metaTitle} — ${t.reports.metaTitle}`,
  };
}

type ItemRow = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currency: string;
  costPrice: number | null;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  onHand: number;
  valueAtCost: number | null;
};

type WarehouseGroup = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  items: ItemRow[];
  totalValue: number;
  totalUnits: number;
};

export default async function StockValueReportPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId, status: "ACTIVE" },
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      currency: true,
      costPrice: true,
      stockLevels: {
        where: { quantity: { gt: 0 } },
        select: {
          warehouseId: true,
          quantity: true,
          warehouse: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  const rows: ItemRow[] = [];
  for (const item of items) {
    const costNum = item.costPrice ? Number(item.costPrice.toString()) : null;
    for (const level of item.stockLevels) {
      const valueAtCost = costNum == null ? null : costNum * level.quantity;
      rows.push({
        id: item.id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        currency: item.currency,
        costPrice: costNum,
        warehouseId: level.warehouse.id,
        warehouseName: level.warehouse.name,
        warehouseCode: level.warehouse.code,
        onHand: level.quantity,
        valueAtCost,
      });
    }
  }

  const itemsMissingCost = new Set(rows.filter((r) => r.costPrice == null).map((r) => r.id)).size;

  const byWarehouse = new Map<string, WarehouseGroup>();
  for (const row of rows) {
    let group = byWarehouse.get(row.warehouseId);
    if (!group) {
      group = {
        warehouseId: row.warehouseId,
        warehouseName: row.warehouseName,
        warehouseCode: row.warehouseCode,
        items: [],
        totalValue: 0,
        totalUnits: 0,
      };
      byWarehouse.set(row.warehouseId, group);
    }
    group.items.push(row);
    group.totalUnits += row.onHand;
    group.totalValue += row.valueAtCost ?? 0;
  }

  const groups = Array.from(byWarehouse.values()).sort((a, b) =>
    a.warehouseName.localeCompare(b.warehouseName),
  );

  const grandTotalValue = groups.reduce((acc, g) => acc + g.totalValue, 0);
  const grandTotalUnits = groups.reduce((acc, g) => acc + g.totalUnits, 0);
  const distinctItems = new Set(rows.map((r) => r.id)).size;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/reports">
            <ChevronLeft className="h-4 w-4" />
            {t.reports.stockValue.backToReports}
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <DollarSign className="text-muted-foreground mt-1 h-5 w-5" />
            <div>
              <h1 className="text-2xl font-semibold">{t.reports.stockValue.heading}</h1>
              <p className="text-muted-foreground">{t.reports.stockValue.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/reports/stock-value/export-xlsx">
                <Download className="h-4 w-4" />
                {t.common.exportExcel}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports/stock-value/export">
                <Download className="h-4 w-4" />
                {t.common.exportCsv}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="bg-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <PackageOpen className="text-muted-foreground h-6 w-6" />
            </div>
            <CardTitle>{t.reports.stockValue.emptyTitle}</CardTitle>
            <CardDescription>{t.reports.stockValue.emptyBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>{t.reports.stockValue.totalValueLabel}</CardDescription>
                <CardTitle className="text-3xl font-mono">
                  {formatCurrency(grandTotalValue, {
                    currency: region.currency,
                    locale: region.numberLocale,
                  })}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{t.reports.stockValue.totalUnitsLabel}</CardDescription>
                <CardTitle className="text-3xl font-mono">
                  {formatNumber(grandTotalUnits, region.numberLocale)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{t.reports.stockValue.distinctItemsLabel}</CardDescription>
                <CardTitle className="text-3xl font-mono">
                  {formatNumber(distinctItems, region.numberLocale)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {itemsMissingCost > 0 ? (
            <p className="text-muted-foreground text-sm">
              {format(t.reports.stockValue.missingCostWarning, {
                count: String(itemsMissingCost),
              })}
            </p>
          ) : null}

          {groups.map((group) => (
            <Card key={group.warehouseId}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    {group.warehouseName}
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      · {group.warehouseCode}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {format(t.reports.stockValue.warehouseSubtitle, {
                      items: String(group.items.length),
                      units: formatNumber(group.totalUnits, region.numberLocale),
                    })}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">
                    {t.reports.stockValue.warehouseTotalLabel}
                  </p>
                  <p className="font-mono text-lg font-semibold">
                    {formatCurrency(group.totalValue, {
                      currency: region.currency,
                      locale: region.numberLocale,
                    })}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.reports.stockValue.columnItem}</TableHead>
                      <TableHead>{t.reports.stockValue.columnSku}</TableHead>
                      <TableHead className="text-right">
                        {t.reports.stockValue.columnOnHand}
                      </TableHead>
                      <TableHead className="text-right">
                        {t.reports.stockValue.columnCostPrice}
                      </TableHead>
                      <TableHead className="text-right">
                        {t.reports.stockValue.columnValue}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items
                      .slice()
                      .sort((a, b) => (b.valueAtCost ?? 0) - (a.valueAtCost ?? 0))
                      .map((item) => (
                        <TableRow key={`${item.id}-${item.warehouseId}`}>
                          <TableCell>
                            <Link
                              href={`/items/${item.id}`}
                              className="font-medium hover:underline"
                            >
                              {item.name}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(item.onHand, region.numberLocale)} {item.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.costPrice == null
                              ? "—"
                              : formatCurrency(item.costPrice, {
                                  currency: item.currency,
                                  locale: region.numberLocale,
                                })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.valueAtCost == null
                              ? "—"
                              : formatCurrency(item.valueAtCost, {
                                  currency: item.currency,
                                  locale: region.numberLocale,
                                })}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
