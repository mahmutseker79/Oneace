import { Wrench } from "lucide-react";import type { Metadata } from "next";

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
import { getMessages, getRegion } from "@/lib/i18n";import { requireActiveMembership } from "@/lib/session";
import { formatNumber } from "@/lib/utils";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `Adjustment Report — ${t.reports.metaTitle}`,
  };
}

type AdjustmentRow = {
  id: string;
  date: Date;
  itemSku: string;
  itemName: string;
  warehouseName: string;
  expectedQty: number | null;
  countedQty: number | null;
  variance: number;
  reasonCode: string | null;
  reasonCodeName: string | null;
  approvedBy: string | null;
  createdBy: string | null;
  quantity: number;
  direction: number;
};

type ReasonCodeSummary = {
  code: string;
  name: string;
  count: number;
};

export default async function AdjustmentReportPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  // Fetch all adjustments (type = 'ADJUSTMENT')
  const movements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      type: "ADJUSTMENT",
    },
    select: {
      id: true,
      createdAt: true,
      quantity: true,
      direction: true,
      itemId: true,
      item: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
      reasonCode: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      stockCountId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // For adjustments tied to stock counts, fetch count details
  const stockCountIds = new Set(
    movements.filter((m) => m.stockCountId).map((m) => m.stockCountId!),
  );

  const countSnapshots =
    stockCountIds.size > 0
      ? await db.countSnapshot.findMany({
          where: {
            countId: { in: Array.from(stockCountIds) },
          },
          select: {
            countId: true,
            itemId: true,
            expectedQuantity: true,
          },
        })
      : [];

  const countEntriesByCountId =
    stockCountIds.size > 0
      ? await db.countEntry.findMany({
          where: {
            count: {
              id: { in: Array.from(stockCountIds) },
            },
          },
          select: {
            countId: true,
            itemId: true,
            countedQuantity: true,
          },
        })
      : [];

  const snapshotMap = new Map<string, Map<string, number>>();
  for (const snap of countSnapshots) {
    if (!snapshotMap.has(snap.countId)) {
      snapshotMap.set(snap.countId, new Map());
    }
    snapshotMap.get(snap.countId)?.set(snap.itemId, snap.expectedQuantity);
  }

  const entryMap = new Map<string, Map<string, number>>();
  for (const entry of countEntriesByCountId) {
    if (!entryMap.has(entry.countId)) {
      entryMap.set(entry.countId, new Map());
    }
    entryMap.get(entry.countId)?.set(entry.itemId, entry.countedQuantity);
  }

  // Build adjustment rows
  const rows: AdjustmentRow[] = movements.map((m) => {
    let expectedQty: number | null = null;
    let countedQty: number | null = null;

    if (m.stockCountId) {
      const snapshots = snapshotMap.get(m.stockCountId);
      const entries = entryMap.get(m.stockCountId);
      if (snapshots) expectedQty = snapshots.get(m.itemId) ?? null;
      if (entries) countedQty = entries.get(m.itemId) ?? null;
    }

    const variance = expectedQty != null && countedQty != null ? countedQty - expectedQty : 0;

    return {
      id: m.id,
      date: m.createdAt,
      itemSku: m.item.sku,
      itemName: m.item.name,
      warehouseName: m.warehouse.name,
      expectedQty,
      countedQty,
      variance,
      reasonCode: m.reasonCode?.code ?? null,
      reasonCodeName: m.reasonCode?.name ?? null,
      approvedBy: null, // Placeholder for approval tracking
      createdBy: m.createdBy?.name ?? null,
      quantity: m.quantity,
      direction: m.direction,
    };
  });

  // Aggregate reason codes
  const reasonCodeMap = new Map<string, ReasonCodeSummary>();
  for (const row of rows) {
    if (row.reasonCode) {
      const key = row.reasonCode;
      const existing = reasonCodeMap.get(key) ?? {
        code: row.reasonCode,
        name: row.reasonCodeName ?? row.reasonCode,
        count: 0,
      };
      existing.count += 1;
      reasonCodeMap.set(key, existing);
    }
  }

  const reasonCodeData = Array.from(reasonCodeMap.values());
  const _COLORS = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
  ];

  const dateFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adjustment Report"
        description="Track inventory adjustments and reconciliation"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Adjustment Report" }]}
        actions={
          <ExportButton href="/reports/adjustments/export">{t.common.exportCsv}</ExportButton>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No adjustments recorded"
          description="Inventory adjustments will appear here once recorded."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardDescription>Total Adjustments</CardDescription>
                <CardTitle className="text-3xl">
                  {formatNumber(rows.length, region.numberLocale)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Reason Codes Used</CardDescription>
                <CardTitle className="text-3xl">
                  {formatNumber(reasonCodeData.length, region.numberLocale)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {reasonCodeData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Adjustments by Reason Code</CardTitle>
              </CardHeader>
              <CardContent>{/* Chart removed for server component compatibility */}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Adjustment Details</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item (SKU)</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Expected Qty</TableHead>
                    <TableHead className="text-right">Counted Qty</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Reason Code</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{dateFmt.format(row.date)}</TableCell>
                      <TableCell className="text-sm">
                        <div>{row.itemName}</div>
                        <div className="text-xs text-muted-foreground">{row.itemSku}</div>
                      </TableCell>
                      <TableCell className="text-sm">{row.warehouseName}</TableCell>
                      <TableCell className="text-right text-sm">
                        {row.expectedQty !== null
                          ? formatNumber(row.expectedQty, region.numberLocale)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.countedQty !== null
                          ? formatNumber(row.countedQty, region.numberLocale)
                          : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right text-sm font-medium ${row.variance !== 0 ? "text-orange-600" : ""}`}
                      >
                        {row.variance !== 0
                          ? (row.variance > 0 ? "+" : "") +
                            formatNumber(row.variance, region.numberLocale)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.reasonCodeName || row.reasonCode || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{row.createdBy || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
