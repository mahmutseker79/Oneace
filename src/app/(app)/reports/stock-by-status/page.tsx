import { Boxes, DollarSign, Package } from "lucide-react";
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
import { getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency, formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `Stock by Status Report — ${t.reports.metaTitle}`,
  };
}

type StatusSummary = {
  status: string;
  totalQty: number;
  totalValue: number;
  itemCount: number;
};

type StockRow = {
  id: string;
  sku: string;
  itemName: string;
  warehouse: string;
  status: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
};

type ChartData = {
  warehouse: string;
  [key: string]: number | string;
};

const STATUS_ORDER = [
  "AVAILABLE",
  "HOLD",
  "DAMAGED",
  "QUARANTINE",
  "EXPIRED",
  "IN_TRANSIT",
  "RESERVED",
];
const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981",
  HOLD: "#f59e0b",
  DAMAGED: "#ef4444",
  QUARANTINE: "#f97316",
  EXPIRED: "#6b7280",
  IN_TRANSIT: "#3b82f6",
  RESERVED: "#8b5cf6",
};

export default async function StockByStatusReportPage() {
  const { membership } = await requireActiveMembership();
  const region = await getRegion();

  const stockLevels = await db.stockLevel.findMany({
    where: { organizationId: membership.organizationId },
    select: {
      id: true,
      quantity: true,
      stockStatus: true,
      item: { select: { sku: true, name: true, costPrice: true } },
      warehouse: { select: { name: true } },
    },
  });

  if (stockLevels.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Stock by Status"
          description="Inventory breakdown by stock status"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Stock by Status" }]}
        />
        <EmptyState
          icon={Package}
          title="No stock levels"
          description="Stock by status will appear here once items are added."
        />
      </div>
    );
  }

  // Aggregate by status
  const statusMap = new Map<string, StatusSummary>();
  const rows: StockRow[] = [];

  for (const level of stockLevels) {
    const status = level.stockStatus || "AVAILABLE";
    const costNum = level.item.costPrice ? Number(level.item.costPrice.toString()) : 0;
    const totalValue = level.quantity * costNum;

    if (!statusMap.has(status)) {
      statusMap.set(status, {
        status,
        totalQty: 0,
        totalValue: 0,
        itemCount: 0,
      });
    }

    const summary = statusMap.get(status)!;
    summary.totalQty += level.quantity;
    summary.totalValue += totalValue;
    summary.itemCount += 1;

    rows.push({
      id: level.id,
      sku: level.item.sku,
      itemName: level.item.name,
      warehouse: level.warehouse.name,
      status,
      quantity: level.quantity,
      unitCost: costNum,
      totalValue,
    });
  }

  const statusSummaries = STATUS_ORDER.filter((s) => statusMap.has(s))
    .map((s) => statusMap.get(s)!)
    .concat(Array.from(statusMap.values()).filter((s) => !STATUS_ORDER.includes(s.status)));

  const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

  // Prepare chart data grouped by warehouse
  const warehouseMap = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (!warehouseMap.has(row.warehouse)) {
      warehouseMap.set(row.warehouse, {});
    }
    const wh = warehouseMap.get(row.warehouse)!;
    wh[row.status] = (wh[row.status] ?? 0) + row.quantity;
  }

  const chartData: ChartData[] = Array.from(warehouseMap.entries()).map(
    ([warehouse, statuses]) => ({
      warehouse,
      ...statuses,
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock by Status"
        description="Inventory breakdown by stock status"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Stock by Status" }]}
        actions={<ExportButton href="/reports/stock-by-status/export">Export CSV</ExportButton>}
      />

      <ReportSummaryCard
        metrics={[
          {
            label: "Total Units",
            value: formatNumber(totalQty, region.numberLocale),
            icon: Boxes,
          },
          {
            label: "Total Value",
            value: formatCurrency(totalValue, {
              currency: region.currency,
              locale: region.numberLocale,
            }),
            icon: DollarSign,
          },
          {
            label: "Status Types",
            value: statusSummaries.length,
            icon: Package,
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(totalValue, {
                currency: region.currency,
                locale: region.numberLocale,
              })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Units</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(totalQty, region.numberLocale)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {statusSummaries.map((summary) => {
          const statusColor = STATUS_COLORS[summary.status] || "#6b7280";
          return (
            <Card key={summary.status}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: statusColor }} />
                  <CardDescription>{summary.status}</CardDescription>
                </div>
                <CardTitle className="text-2xl">
                  {formatNumber(summary.totalQty, region.numberLocale)}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {summary.itemCount} item{summary.itemCount !== 1 ? "s" : ""}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">
                  {formatCurrency(summary.totalValue, {
                    currency: region.currency,
                    locale: region.numberLocale,
                  })}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stock Distribution by Warehouse</CardTitle>
          </CardHeader>
          <CardContent>{/* Chart removed for server component compatibility */}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inventory by Status and Location</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const statusColor = STATUS_COLORS[row.status] || "#6b7280";
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.sku}</TableCell>
                    <TableCell className="text-sm">{row.itemName}</TableCell>
                    <TableCell className="text-sm">{row.warehouse}</TableCell>
                    <TableCell className="text-sm">
                      <div
                        className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: statusColor }}
                      >
                        {row.status}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(row.quantity, region.numberLocale)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(row.unitCost, {
                        currency: region.currency,
                        locale: region.numberLocale,
                      })}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(row.totalValue, {
                        currency: region.currency,
                        locale: region.numberLocale,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
