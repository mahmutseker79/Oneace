import {
  ArrowLeftRight,
  ArrowUpDown,
  Download,
  ExternalLink,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
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
import { format, getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import {
  type MovementSearchParams,
  buildMovementWhere,
  parseMovementFilter,
} from "../../movements/filter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.reports.movementHistory.metaTitle} — ${t.reports.metaTitle}`,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER" | "BIN_TRANSFER" | "COUNT";

type TypeSummary = {
  type: MovementType;
  count: number;
  totalQty: number;
};

type SearchParams = Promise<MovementSearchParams>;

function buildExportHref(rawFrom: string, rawTo: string, rawType: string): string {
  const params = new URLSearchParams();
  if (rawFrom) params.set("from", rawFrom);
  if (rawTo) params.set("to", rawTo);
  if (rawType) params.set("type", rawType);
  const qs = params.toString();
  return qs ? `/reports/movements/export?${qs}` : "/reports/movements/export";
}

function buildMovementsHref(rawFrom: string, rawTo: string, rawType: string): string {
  const params = new URLSearchParams();
  if (rawFrom) params.set("from", rawFrom);
  if (rawTo) params.set("to", rawTo);
  if (rawType) params.set("type", rawType);
  const qs = params.toString();
  return qs ? `/movements?${qs}` : "/movements";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MovementHistoryReportPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const canExport = hasCapability(membership.role, "reports.export");

  const filter = await parseMovementFilter(searchParams ?? Promise.resolve({}));
  const filterActive = Boolean(filter.from || filter.to || filter.type);

  // Date formatter for the movement table
  const dateFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Load movements (capped at 2000 for summary purposes).
  // For the full ledger, users follow the link to /movements.
  const PAGE_SIZE = 2000;

  const movements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      ...buildMovementWhere(filter),
    },
    select: {
      id: true,
      type: true,
      quantity: true,
      direction: true,
      reference: true,
      createdAt: true,
      item: { select: { id: true, sku: true, name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
  });

  const truncated = movements.length > PAGE_SIZE;
  const visibleMovements = truncated ? movements.slice(0, PAGE_SIZE) : movements;

  // Aggregate by type
  const typeSummaries = new Map<MovementType, TypeSummary>();
  for (const m of visibleMovements) {
    const type = m.type as MovementType;
    const existing = typeSummaries.get(type) ?? { type, count: 0, totalQty: 0 };
    existing.count += 1;
    existing.totalQty += m.quantity;
    typeSummaries.set(type, existing);
  }
  const summaryRows: TypeSummary[] = Array.from(typeSummaries.values()).sort(
    (a, b) => b.totalQty - a.totalQty,
  );

  // Compute KPIs
  const totalMovements = visibleMovements.length;
  const receipts = visibleMovements.filter((m) => m.type === "RECEIPT");
  const issues = visibleMovements.filter((m) => m.type === "ISSUE");
  const transfers = visibleMovements.filter((m) => m.type === "TRANSFER");
  const adjustments = visibleMovements.filter((m) => m.type === "ADJUSTMENT");
  const receiptQty = receipts.reduce((s, m) => s + m.quantity, 0);
  const issueQty = issues.reduce((s, m) => s + m.quantity, 0);
  const netUnits = receiptQty - issueQty;

  // Check if org has ANY movements (to distinguish true-empty from filtered-empty)
  const hasAnyMovements = totalMovements > 0 || filterActive;
  const orgHasMovements =
    hasAnyMovements ||
    (await db.stockMovement.count({
      where: { organizationId: membership.organizationId },
    })) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t.reports.movementHistory.heading}
        description={t.reports.movementHistory.subtitle}
        backHref="/reports"
        breadcrumb={[
          { label: t.reports.heading, href: "/reports" },
          { label: t.reports.movementHistory.heading },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canExport && visibleMovements.length > 0 ? (
              <>
                <ExportButton
                  href={buildExportHref(filter.rawFrom, filter.rawTo, filter.rawType).replace(
                    "/export",
                    "/pdf",
                  )}
                >
                  {t.common.downloadPdf}
                </ExportButton>
                <ExportButton href={buildExportHref(filter.rawFrom, filter.rawTo, filter.rawType)}>
                  Export CSV
                </ExportButton>
              </>
            ) : null}
            <Button asChild variant="outline">
              <Link href={buildMovementsHref(filter.rawFrom, filter.rawTo, filter.rawType)}>
                <ExternalLink className="h-4 w-4" />
                {t.reports.movementHistory.viewFullLedger}
              </Link>
            </Button>
          </div>
        }
      />

      {/* Simple date + type filter (GET-based — same pattern as reports) */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="rpt-from" className="text-xs font-medium text-muted-foreground">
            {t.reports.movementHistory.filterFromLabel}
          </label>
          <input
            id="rpt-from"
            name="from"
            type="date"
            defaultValue={filter.rawFrom}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rpt-to" className="text-xs font-medium text-muted-foreground">
            {t.reports.movementHistory.filterToLabel}
          </label>
          <input
            id="rpt-to"
            name="to"
            type="date"
            defaultValue={filter.rawTo}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rpt-type" className="text-xs font-medium text-muted-foreground">
            {t.reports.movementHistory.filterTypeLabel}
          </label>
          <select
            id="rpt-type"
            name="type"
            defaultValue={filter.rawType}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">{t.reports.movementHistory.filterTypeAll}</option>
            {(["RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER", "BIN_TRANSFER", "COUNT"] as const).map(
              (type) => (
                <option key={type} value={type}>
                  {t.movements.types[type]}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            {t.reports.movementHistory.filterApply}
          </Button>
          {filterActive ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports/movements">{t.reports.movementHistory.filterClear}</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {/* Empty state */}
      {visibleMovements.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={
            filterActive
              ? t.reports.movementHistory.emptyTitle
              : orgHasMovements
                ? t.reports.movementHistory.emptyTitle
                : t.reports.movementHistory.emptyFirstTime
          }
          description={
            filterActive
              ? t.reports.movementHistory.emptyBody
              : t.reports.movementHistory.emptyFirstTime
          }
          variant={filterActive ? "filtered" : "empty"}
        />
      ) : (
        <>
          {/* KPI Summary Bar */}
          <ReportSummaryCard
            metrics={[
              {
                label: t.reports.movementHistory.kpiTotalMovements,
                value: totalMovements,
                icon: ArrowUpDown,
              },
              {
                label: t.reports.movementHistory.kpiReceipts,
                value: receipts.length,
                icon: TrendingUp,
              },
              {
                label: t.reports.movementHistory.kpiIssues,
                value: issues.length,
                icon: TrendingDown,
              },
              {
                label: t.reports.movementHistory.kpiNetUnits,
                value: (netUnits > 0 ? "+" : "") + netUnits.toLocaleString(),
                trend: netUnits > 0 ? "In" : "Out",
                trendDirection: netUnits > 0 ? "positive" : "negative",
              },
            ]}
          />

          {/* Summary by type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.reports.movementHistory.summaryByType}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.reports.movementHistory.summaryTypeCol}</TableHead>
                    <TableHead className="text-right">
                      {t.reports.movementHistory.summaryCountCol}
                    </TableHead>
                    <TableHead className="text-right">
                      {t.reports.movementHistory.summaryQtyCol}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryRows.map((row) => (
                    <TableRow key={row.type}>
                      <TableCell>{t.movements.types[row.type]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totalQty.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Movement detail table — most recent first */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.movements.heading}</CardTitle>
                {truncated ? (
                  <CardDescription className="text-xs">
                    {format(t.movements.filter.truncatedNotice, {
                      limit: String(PAGE_SIZE),
                    })}
                  </CardDescription>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.reports.movementHistory.columnDate}</TableHead>
                    <TableHead>{t.reports.movementHistory.columnType}</TableHead>
                    <TableHead>{t.reports.movementHistory.columnItem}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t.reports.movementHistory.columnWarehouse}
                    </TableHead>
                    <TableHead className="text-right">
                      {t.reports.movementHistory.columnQty}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t.reports.movementHistory.columnUser}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMovements.map((m) => {
                    const signed = m.direction < 0 ? -m.quantity : m.quantity;
                    const positive = signed >= 0;
                    const userLabel =
                      m.createdBy?.name ?? m.createdBy?.email ?? t.movements.unknownUser;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {dateFmt.format(m.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs">
                            {t.movements.types[m.type as MovementType]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/items/${m.item.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {m.item.name}
                          </Link>
                          <div className="font-mono text-xs text-muted-foreground">
                            {m.item.sku}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm sm:table-cell">
                          {m.warehouse.name}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums text-sm font-medium ${
                            positive ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {positive ? "+" : ""}
                          {signed.toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                          {userLabel}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
