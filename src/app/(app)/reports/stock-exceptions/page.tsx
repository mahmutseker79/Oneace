import { AlertTriangle, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `Stock Exceptions Report — ${t.reports.metaTitle}`,
  };
}

type ExceptionRow = {
  stockLevelId: string;
  sku: string;
  itemName: string;
  warehouseName: string;
  currentQty: number;
  lastMovementDate: Date | null;
  status: "negative" | "zero";
};

export default async function StockExceptionsReportPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  // Fetch stock levels with quantity <= 0
  const stockLevels = await db.stockLevel.findMany({
    where: {
      organizationId: membership.organizationId,
      quantity: { lte: 0 },
    },
    select: {
      id: true,
      quantity: true,
      item: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: [{ quantity: "asc" }],
  });

  if (stockLevels.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/reports">
              <ChevronLeft className="h-4 w-4" />
              Back to Reports
            </Link>
          </Button>
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-muted-foreground mt-1 h-5 w-5" />
            <div>
              <h1 className="text-2xl font-semibold">Stock Exceptions</h1>
              <p className="text-muted-foreground">Negative and zero stock inventory issues</p>
            </div>
          </div>
        </div>
        <EmptyState
          icon={AlertTriangle}
          title="No stock exceptions"
          description="All inventory levels are positive. Your stock is healthy."
        />
      </div>
    );
  }

  // Get last movement date for each item
  const itemIds = stockLevels.map((sl) => sl.item.id);
  const lastMovements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      itemId: { in: itemIds },
    },
    select: {
      itemId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    distinct: ["itemId"],
  });

  const lastMovementMap = new Map<string, Date>();
  for (const m of lastMovements) {
    lastMovementMap.set(m.itemId, m.createdAt);
  }

  const rows: ExceptionRow[] = stockLevels.map((sl) => ({
    stockLevelId: sl.id,
    sku: sl.item.sku,
    itemName: sl.item.name,
    warehouseName: sl.warehouse.name,
    currentQty: sl.quantity,
    lastMovementDate: lastMovementMap.get(sl.item.id) ?? null,
    status: sl.quantity < 0 ? "negative" : "zero",
  }));

  const negativeStock = rows.filter((r) => r.status === "negative");
  const zeroStock = rows.filter((r) => r.status === "zero");

  const totalNegativeQty = negativeStock.reduce((s, r) => s + Math.abs(r.currentQty), 0);
  const totalZeroQty = zeroStock.length;

  const dateFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/reports">
            <ChevronLeft className="h-4 w-4" />
            Back to Reports
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-muted-foreground mt-1 h-5 w-5" />
            <div>
              <h1 className="text-2xl font-semibold">Stock Exceptions</h1>
              <p className="text-muted-foreground">Negative and zero stock inventory issues</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton href="/reports/stock-exceptions/export">
              Export CSV
            </ExportButton>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Negative Stock Items</CardDescription>
            <CardTitle className="text-3xl text-red-600">{formatNumber(negativeStock.length, region.numberLocale)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Total: {formatNumber(totalNegativeQty, region.numberLocale)} units
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Zero Stock Items</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{formatNumber(zeroStock.length, region.numberLocale)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Potential dead stock
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Exceptions</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(rows.length, region.numberLocale)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {negativeStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Negative Stock (Data Quality Issue)</CardTitle>
            <CardDescription>
              These items have negative quantities, indicating a data integrity issue that requires investigation.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Current Qty</TableHead>
                  <TableHead>Last Movement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negativeStock.map((row) => (
                  <TableRow key={row.stockLevelId} className="bg-red-50">
                    <TableCell className="font-mono text-sm">{row.sku}</TableCell>
                    <TableCell className="text-sm">{row.itemName}</TableCell>
                    <TableCell className="text-sm">{row.warehouseName}</TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold text-red-600">
                      {formatNumber(row.currentQty, region.numberLocale)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.lastMovementDate ? dateFmt.format(row.lastMovementDate) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {zeroStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zero Stock (Potential Dead Stock)</CardTitle>
            <CardDescription>
              These items have zero quantities and may represent obsolete or discontinued products.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Current Qty</TableHead>
                  <TableHead>Last Movement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zeroStock.map((row) => (
                  <TableRow key={row.stockLevelId} className="bg-amber-50">
                    <TableCell className="font-mono text-sm">{row.sku}</TableCell>
                    <TableCell className="text-sm">{row.itemName}</TableCell>
                    <TableCell className="text-sm">{row.warehouseName}</TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {formatNumber(row.currentQty, region.numberLocale)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.lastMovementDate ? dateFmt.format(row.lastMovementDate) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
