import { AlertTriangle, CheckCircle2, ChevronLeft, Download, ShoppingCart } from "lucide-react";
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
import { format, getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.reports.lowStock.metaTitle} — ${t.reports.metaTitle}`,
  };
}

type LowStockItem = {
  id: string;
  sku: string;
  name: string;
  onHand: number;
  reorderPoint: number;
  reorderQty: number;
  preferredSupplier: { id: string; name: string } | null;
};

type SupplierGroup = {
  supplier: { id: string; name: string } | null;
  items: LowStockItem[];
};

function groupBySupplier(items: LowStockItem[]): SupplierGroup[] {
  const bySupplier = new Map<string, SupplierGroup>();
  // Use a sentinel key for "no supplier"
  const NO_SUPPLIER = "__no_supplier__";

  for (const item of items) {
    const key = item.preferredSupplier?.id ?? NO_SUPPLIER;
    let group = bySupplier.get(key);
    if (!group) {
      group = {
        supplier: item.preferredSupplier,
        items: [],
      };
      bySupplier.set(key, group);
    }
    group.items.push(item);
  }

  // Groups with a supplier first, alphabetical. "No supplier" last.
  return Array.from(bySupplier.values()).sort((a, b) => {
    if (!a.supplier && !b.supplier) return 0;
    if (!a.supplier) return 1;
    if (!b.supplier) return -1;
    return a.supplier.name.localeCompare(b.supplier.name);
  });
}

function buildCreatePoHref(supplierId: string, itemIds: string[]): string {
  const params = new URLSearchParams();
  params.set("supplier", supplierId);
  params.set("items", itemIds.join(","));
  return `/purchase-orders/new?${params.toString()}`;
}

export default async function LowStockReportPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId, status: "ACTIVE" },
    select: {
      id: true,
      sku: true,
      name: true,
      reorderPoint: true,
      reorderQty: true,
      preferredSupplier: { select: { id: true, name: true } },
      stockLevels: { select: { quantity: true } },
    },
  });

  const lowStockItems: LowStockItem[] = items
    .map((item) => {
      const onHand = item.stockLevels.reduce((acc, l) => acc + l.quantity, 0);
      const { stockLevels: _stockLevels, ...rest } = item;
      void _stockLevels;
      return { ...rest, onHand };
    })
    .filter((item) => item.reorderPoint > 0 && item.onHand <= item.reorderPoint)
    .sort((a, b) => {
      // Most urgent first: largest shortfall
      const shortA = a.reorderPoint - a.onHand;
      const shortB = b.reorderPoint - b.onHand;
      return shortB - shortA;
    });

  const groups = groupBySupplier(lowStockItems);
  const supplierGroups = groups.filter((g) => g.supplier !== null);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/reports">
            <ChevronLeft className="h-4 w-4" />
            {t.reports.lowStock.backToReports}
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-muted-foreground mt-1 h-5 w-5" />
            <div>
              <h1 className="text-2xl font-semibold">{t.reports.lowStock.heading}</h1>
              <p className="text-muted-foreground">{t.reports.lowStock.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/reports/low-stock/export-xlsx">
                <Download className="h-4 w-4" />
                {t.common.exportExcel}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/reports/low-stock/export">
                <Download className="h-4 w-4" />
                {t.common.exportCsv}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {lowStockItems.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="bg-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <CheckCircle2 className="text-muted-foreground h-6 w-6" />
            </div>
            <CardTitle>{t.reports.lowStock.emptyTitle}</CardTitle>
            <CardDescription>{t.reports.lowStock.emptyBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {format(t.reports.lowStock.totalItems, {
              count: String(lowStockItems.length),
            })}
            {" · "}
            {format(t.reports.lowStock.totalSuppliers, {
              count: String(supplierGroups.length),
            })}
          </p>

          {groups.map((group) => {
            const supplier = group.supplier;
            const heading = supplier
              ? format(t.reports.lowStock.groupWithSupplier, {
                  supplier: supplier.name,
                })
              : t.reports.lowStock.groupNoSupplier;
            const createPoHref = supplier
              ? buildCreatePoHref(
                  supplier.id,
                  group.items.map((i) => i.id),
                )
              : null;
            return (
              <Card key={supplier?.id ?? "__no_supplier__"}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{heading}</CardTitle>
                    {!supplier ? (
                      <CardDescription>{t.reports.lowStock.groupNoSupplierHelp}</CardDescription>
                    ) : null}
                  </div>
                  {createPoHref ? (
                    <Button asChild>
                      <Link href={createPoHref}>
                        <ShoppingCart className="h-4 w-4" />
                        {t.reports.lowStock.createPoForSupplier}
                      </Link>
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.reports.lowStock.columnItem}</TableHead>
                        <TableHead>{t.reports.lowStock.columnSku}</TableHead>
                        <TableHead className="text-right">
                          {t.reports.lowStock.columnOnHand}
                        </TableHead>
                        <TableHead className="text-right">
                          {t.reports.lowStock.columnReorderPoint}
                        </TableHead>
                        <TableHead className="text-right">
                          {t.reports.lowStock.columnShortfall}
                        </TableHead>
                        <TableHead className="text-right">
                          {t.reports.lowStock.columnReorderQty}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => {
                        const shortfall = item.reorderPoint - item.onHand;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Link
                                href={`/items/${item.id}`}
                                className="font-medium hover:underline"
                              >
                                {item.name}
                              </Link>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                            <TableCell className="text-right font-mono">{item.onHand}</TableCell>
                            <TableCell className="text-right font-mono">
                              {item.reorderPoint}
                            </TableCell>
                            <TableCell className="text-right font-mono text-destructive">
                              {shortfall}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {item.reorderQty || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
