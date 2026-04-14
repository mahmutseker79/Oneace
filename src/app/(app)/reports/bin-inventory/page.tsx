import { ChevronLeft, Download, Grid3X3 } from "lucide-react";
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
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.reports.binInventory.metaTitle} — ${t.reports.metaTitle}`,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BinRow = {
  binId: string;
  binCode: string;
  binLabel: string | null;
  itemId: string;
  itemSku: string;
  itemName: string;
  itemUnit: string;
  quantity: number;
};

type BinGroup = {
  binId: string;
  binCode: string;
  binLabel: string | null;
  items: BinRow[];
  totalUnits: number;
};

type WarehouseGroup = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  bins: BinGroup[];
  totalBins: number;
  totalUnits: number;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BinInventoryReportPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const canExport = hasCapability(membership.role, "reports.export");

  // Query all non-null bin stock levels with quantity > 0.
  // Joins: Bin (code, label), Item (sku, name, unit), Warehouse (name, code).
  const levels = await db.stockLevel.findMany({
    where: {
      organizationId: membership.organizationId,
      binId: { not: null },
      quantity: { gt: 0 },
    },
    select: {
      quantity: true,
      bin: { select: { id: true, code: true, label: true } },
      item: { select: { id: true, sku: true, name: true, unit: true } },
      warehouse: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ warehouse: { name: "asc" } }, { bin: { code: "asc" } }, { item: { name: "asc" } }],
  });

  // Build warehouse → bin → items hierarchy.
  const warehouseMap = new Map<string, WarehouseGroup>();

  for (const level of levels) {
    if (!level.bin || !level.item || !level.warehouse) continue;

    const whId = level.warehouse.id;
    let wh = warehouseMap.get(whId);
    if (!wh) {
      wh = {
        warehouseId: whId,
        warehouseName: level.warehouse.name,
        warehouseCode: level.warehouse.code,
        bins: [],
        totalBins: 0,
        totalUnits: 0,
      };
      warehouseMap.set(whId, wh);
    }

    let bin = wh.bins.find((b) => b.binId === level.bin!.id);
    if (!bin) {
      bin = {
        binId: level.bin.id,
        binCode: level.bin.code,
        binLabel: level.bin.label ?? null,
        items: [],
        totalUnits: 0,
      };
      wh.bins.push(bin);
    }

    const row: BinRow = {
      binId: level.bin.id,
      binCode: level.bin.code,
      binLabel: level.bin.label ?? null,
      itemId: level.item.id,
      itemSku: level.item.sku,
      itemName: level.item.name,
      itemUnit: level.item.unit,
      quantity: level.quantity,
    };
    bin.items.push(row);
    bin.totalUnits += level.quantity;
    wh.totalUnits += level.quantity;
  }

  const warehouses = Array.from(warehouseMap.values()).map((wh) => ({
    ...wh,
    totalBins: wh.bins.length,
  }));

  // Aggregate KPIs
  const totalBinsWithStock = warehouses.reduce((s, w) => s + w.totalBins, 0);
  const totalItems = levels.length;
  const totalUnits = warehouses.reduce((s, w) => s + w.totalUnits, 0);

  // Check if the org has any bins at all (to distinguish "no bins" vs "bins but empty").
  const binCount = await db.bin.count({
    where: {
      warehouseId: { in: await getOrgWarehouseIds(membership.organizationId) },
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/reports">
            <ChevronLeft className="h-4 w-4" />
            {t.reports.binInventory.backToReports}
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t.reports.binInventory.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.reports.binInventory.subtitle}</p>
          </div>
          {canExport && warehouses.length > 0 ? (
            <ExportButton href="/reports/bin-inventory/export">Export CSV</ExportButton>
          ) : null}
        </div>
      </div>

      {/* Empty states */}
      {binCount === 0 ? (
        <EmptyState
          icon={Grid3X3}
          title={t.reports.binInventory.emptyNoBins}
          description={t.reports.binInventory.emptyNoBinsBody}
          variant="unavailable"
        />
      ) : warehouses.length === 0 ? (
        <EmptyState
          icon={Grid3X3}
          title={t.reports.binInventory.emptyTitle}
          description={t.reports.binInventory.emptyBody}
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardDescription>{t.reports.binInventory.totalBins}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {totalBinsWithStock.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardDescription>{t.reports.binInventory.totalItems}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {totalItems.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4">
                <CardDescription>{t.reports.binInventory.totalUnits}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {totalUnits.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Per-warehouse sections */}
          {warehouses.map((wh) => (
            <div key={wh.warehouseId} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-semibold">{wh.warehouseName}</h2>
                <span className="font-mono text-xs text-muted-foreground">{wh.warehouseCode}</span>
                <span className="text-xs text-muted-foreground">
                  ·{" "}
                  {t.reports.binInventory.locationSubtitle.replace("{bins}", String(wh.totalBins))}
                </span>
              </div>

              {wh.bins.map((bin) => (
                <Card key={bin.binId}>
                  <CardHeader className="pb-2">
                    <div className="flex items-baseline gap-2">
                      <CardTitle className="font-mono text-base">{bin.binCode}</CardTitle>
                      {bin.binLabel ? (
                        <span className="text-sm text-muted-foreground">{bin.binLabel}</span>
                      ) : null}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t.reports.binInventory.binSubtitle.replace(
                          "{items}",
                          String(bin.items.length),
                        )}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.reports.binInventory.columnItem}</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            {t.reports.binInventory.columnSku}
                          </TableHead>
                          <TableHead className="text-right">
                            {t.reports.binInventory.columnQty}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bin.items.map((row) => (
                          <TableRow key={row.itemId}>
                            <TableCell className="font-medium">
                              <Link href={`/items/${row.itemId}`} className="hover:underline">
                                {row.itemName}
                              </Link>
                            </TableCell>
                            <TableCell className="hidden font-mono text-xs sm:table-cell">
                              {row.itemSku}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.quantity} {row.itemUnit}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper — org warehouse ids (for bin count check)
// ---------------------------------------------------------------------------

async function getOrgWarehouseIds(organizationId: string): Promise<string[]> {
  const warehouses = await db.warehouse.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return warehouses.map((w) => w.id);
}
