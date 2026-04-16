import { Tag } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
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
import { format, getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `Reason Code Summary Report — ${t.reports.metaTitle}`,
  };
}

type ReasonCodeRow = {
  reasonCodeId: string;
  code: string;
  category: string;
  occurrenceCount: number;
  totalQtyImpact: number;
  totalValueImpact: number;
  percentOfTotal: number;
};

type ChartData = {
  code: string;
  occurrences: number;
};

export default async function ReasonCodeSummaryReportPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  // Fetch all movements with reason codes
  const movements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      reasonCodeId: { not: null },
    },
    select: {
      id: true,
      quantity: true,
      reasonCodeId: true,
      reasonCode: {
        select: {
          id: true,
          code: true,
          category: true,
        },
      },
      item: {
        select: {
          costPrice: true,
        },
      },
    },
  });

  if (movements.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Reason Code Summary"
          description="Track inventory adjustments by reason code"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Reason Code Summary" }]}
        />
        <EmptyState
          icon={Tag}
          title="No reason codes recorded"
          description="Reason codes will appear here once movements are tagged."
        />
      </div>
    );
  }

  // Aggregate by reason code
  const reasonCodeMap = new Map<string, ReasonCodeRow>();
  let totalImpact = 0;

  for (const m of movements) {
    if (!m.reasonCode) continue;

    const key = m.reasonCode.id;
    const costNum = m.item.costPrice ? Number(m.item.costPrice.toString()) : 0;
    const valueImpact = m.quantity * costNum;

    if (!reasonCodeMap.has(key)) {
      reasonCodeMap.set(key, {
        reasonCodeId: key,
        code: m.reasonCode.code,
        category: m.reasonCode.category,
        occurrenceCount: 0,
        totalQtyImpact: 0,
        totalValueImpact: 0,
        percentOfTotal: 0,
      });
    }

    const row = reasonCodeMap.get(key)!;
    row.occurrenceCount += 1;
    row.totalQtyImpact += m.quantity;
    row.totalValueImpact += valueImpact;
    totalImpact += Math.abs(valueImpact);
  }

  const rows = Array.from(reasonCodeMap.values())
    .map((row) => ({
      ...row,
      percentOfTotal: totalImpact > 0 ? (Math.abs(row.totalValueImpact) / totalImpact) * 100 : 0,
    }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);

  const chartData: ChartData[] = rows.map((row) => ({
    code: row.code,
    occurrences: row.occurrenceCount,
  }));

  const totalOccurrences = rows.reduce((s, r) => s + r.occurrenceCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reason Code Summary"
        description="Track inventory adjustments by reason code"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Reason Code Summary" }]}
        actions={<ExportButton href="/reports/reason-code-summary/export">Export CSV</ExportButton>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Total Reason Codes Used</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(rows.length, region.numberLocale)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Occurrences</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumber(totalOccurrences, region.numberLocale)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Occurrences by Reason Code</CardTitle>
          </CardHeader>
          <CardContent>{/* Chart removed for server component compatibility */}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reason Code Details</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Occurrences</TableHead>
                <TableHead className="text-right">Total Qty Impact</TableHead>
                <TableHead className="text-right">Total Value Impact</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.reasonCodeId}>
                  <TableCell className="font-mono text-sm font-medium">{row.code}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.category}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.occurrenceCount, region.numberLocale)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.totalQtyImpact, region.numberLocale)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(row.totalValueImpact, region.numberLocale)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatNumber(row.percentOfTotal, region.numberLocale)}%
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
