import { Truck } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
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
import { getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `Transfer History Report — ${t.reports.metaTitle}`,
  };
}

type TransferRow = {
  id: string;
  transferNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  status: string;
  totalItems: number;
  shippedQty: number;
  receivedQty: number;
  discrepancy: number;
  shippedDate: Date | null;
  receivedDate: Date | null;
};

type ChartData = {
  month: string;
  transfers: number;
};

export default async function TransferHistoryReportPage() {
  const { membership } = await requireActiveMembership();
  const region = await getRegion();

  const transfers = await db.stockTransfer.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      lines: {
        select: {
          shippedQty: true,
          receivedQty: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (transfers.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Transfer History"
          description="Track inter-warehouse transfers"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Transfer History" }]}
        />
        <EmptyState
          icon={Truck}
          title="No transfers recorded"
          description="Transfer history will appear here once transfers are created."
        />
      </div>
    );
  }

  const rows: TransferRow[] = transfers.map((t) => {
    const totalItems = t.lines.length;
    const shippedQty = t.lines.reduce((s, l) => s + (l.shippedQty ?? 0), 0);
    const receivedQty = t.lines.reduce((s, l) => s + (l.receivedQty ?? 0), 0);
    const discrepancy = receivedQty - shippedQty;

    return {
      id: t.id,
      transferNumber: t.transferNumber,
      fromWarehouse: t.fromWarehouse.name,
      toWarehouse: t.toWarehouse.name,
      status: t.status,
      totalItems,
      shippedQty,
      receivedQty,
      discrepancy,
      shippedDate: t.shippedAt,
      receivedDate: t.receivedAt,
    };
  });

  // Aggregate by month for chart
  const monthMap = new Map<string, number>();
  for (const row of rows) {
    const date = row.shippedDate || new Date();
    const monthKey = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short" }).format(
      date,
    );
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + 1);
  }

  const chartData: ChartData[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, transfers]) => ({
      month,
      transfers,
    }));

  // Calculate discrepancy summary
  const transfersWithDiscrepancy = rows.filter((r) => r.discrepancy !== 0);
  const totalDiscrepancyValue = transfersWithDiscrepancy.reduce(
    (s, r) => s + Math.abs(r.discrepancy),
    0,
  );

  const dateFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-gray-100 text-gray-800";
      case "SHIPPED":
        return "bg-blue-100 text-blue-800";
      case "RECEIVED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfer History"
        description="Track inter-warehouse transfers"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Transfer History" }]}
        actions={<ExportButton href="/reports/transfer-history/export">Export CSV</ExportButton>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Transfers</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(rows.length, region.numberLocale)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Transfers with Discrepancy</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {formatNumber(transfersWithDiscrepancy.length, region.numberLocale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {formatNumber(totalDiscrepancyValue, region.numberLocale)} units
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Avg Items per Transfer</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(
                Math.round((rows.reduce((s, r) => s + r.totalItems, 0) / rows.length) * 10) / 10,
                region.numberLocale,
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transfer Volume by Month</CardTitle>
          </CardHeader>
          <CardContent>{/* Chart removed for server component compatibility */}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transfer Details</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer #</TableHead>
                <TableHead>From Warehouse</TableHead>
                <TableHead>To Warehouse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Items</TableHead>
                <TableHead className="text-right">Shipped Qty</TableHead>
                <TableHead className="text-right">Received Qty</TableHead>
                <TableHead className="text-right">Discrepancy</TableHead>
                <TableHead>Shipped Date</TableHead>
                <TableHead>Received Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className={row.discrepancy !== 0 ? "bg-orange-50" : ""}>
                  <TableCell className="font-mono text-sm font-medium">
                    {row.transferNumber}
                  </TableCell>
                  <TableCell className="text-sm">{row.fromWarehouse}</TableCell>
                  <TableCell className="text-sm">{row.toWarehouse}</TableCell>
                  <TableCell className="text-sm">
                    <div
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(row.status)}`}
                    >
                      {row.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.totalItems, region.numberLocale)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.shippedQty, region.numberLocale)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.receivedQty, region.numberLocale)}
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm font-mono font-bold ${row.discrepancy !== 0 ? "text-orange-600" : ""}`}
                  >
                    {row.discrepancy !== 0
                      ? formatNumber(row.discrepancy, region.numberLocale)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {row.shippedDate ? dateFmt.format(row.shippedDate) : "—"}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {row.receivedDate ? dateFmt.format(row.receivedDate) : "—"}
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
