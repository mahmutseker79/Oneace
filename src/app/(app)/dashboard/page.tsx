import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  Lock,
  Package,
  Plus,
  ScanLine,
  ShoppingCart,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard } from "@/components/ui/chart-card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
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
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { cn, formatCurrency } from "@/lib/utils";

import { LazyCategoryValueChart, LazyLowStockTrendChart, LazyTopItemsChart } from "./lazy-charts";
import { LazyTrendChart } from "./lazy-trend-chart";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.dashboard.metaTitle };
}

// =========================
// Dashboard data helpers
// =========================

async function loadDashboardData(orgId: string) {
  // Sprint 4: Consolidated queries — replaced findMany-then-aggregate-in-JS
  // with SQL aggregation. Reduces rows transferred from ~40K to ~100.

  // Type for SQL aggregation results
  type StockValueRow = { stockValue: number; itemsWithCostPrice: number };
  type CategoryValueRow = { category: string; value: number };
  type TopItemRow = { name: string; quantity: number };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    activeItemCount,
    archivedItemCount,
    stockValueResult,
    categoryValueData,
    warehouseCount,
    openCountCount,
    inProgressCountCount,
    recentMovements,
    topItemsData,
  ] = await Promise.all([
    db.item.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    db.item.count({ where: { organizationId: orgId, status: "ARCHIVED" } }),

    // Stock value: single SQL instead of fetching all stockLevels + JS loop
    db.$queryRaw<StockValueRow[]>`
			SELECT
				COALESCE(SUM(sl.quantity * COALESCE(i."costPrice", 0)), 0)::float as "stockValue",
				COUNT(DISTINCT CASE WHEN i."costPrice" > 0 THEN sl."itemId" END)::int as "itemsWithCostPrice"
			FROM "StockLevel" sl
			JOIN "Item" i ON i.id = sl."itemId"
			WHERE sl."organizationId" = ${orgId}
		`,

    // Category value: single SQL instead of fetching all + JS Map
    db.$queryRaw<CategoryValueRow[]>`
			SELECT
				COALESCE(c.name, 'Uncategorized') as category,
				COALESCE(SUM(sl.quantity * COALESCE(i."costPrice", 0)), 0)::float as value
			FROM "StockLevel" sl
			JOIN "Item" i ON i.id = sl."itemId"
			LEFT JOIN "Category" c ON c.id = i."categoryId"
			WHERE sl."organizationId" = ${orgId}
			GROUP BY c.name
			ORDER BY value DESC
		`,

    db.warehouse.count({ where: { organizationId: orgId } }),
    db.stockCount.count({ where: { organizationId: orgId, state: "OPEN" } }),
    db.stockCount.count({ where: { organizationId: orgId, state: "IN_PROGRESS" } }),

    db.stockMovement.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),

    // Top 10 most-moved items: SQL GROUP BY instead of fetching all + JS Map
    db.$queryRaw<TopItemRow[]>`
			SELECT i.name, SUM(sm.quantity)::int as quantity
			FROM "StockMovement" sm
			JOIN "Item" i ON i.id = sm."itemId"
			WHERE sm."organizationId" = ${orgId}
				AND sm."createdAt" >= ${thirtyDaysAgo}
			GROUP BY i.name
			ORDER BY quantity DESC
			LIMIT 10
		`,
  ]);

  const stockValue = stockValueResult[0]?.stockValue ?? 0;
  const itemsWithCostPrice = stockValueResult[0]?.itemsWithCostPrice ?? 0;

  // Low-stock items = items whose total on-hand (sum across warehouses)
  // is at or below reorderPoint AND reorderPoint > 0. Items with a
  // reorderPoint of 0 opt out of this report.
  // Optimized: use database aggregation instead of JS loops
  type LowStockItemRaw = {
    id: string;
    name: string;
    sku: string;
    reorderPoint: number;
    preferredSupplierName: string | null;
    onHand: number;
  };

  const itemsWithStockData = await db.$queryRaw<LowStockItemRaw[]>`
		SELECT i.id, i.name, i.sku, i."reorderPoint", s.name as "preferredSupplierName",
		  COALESCE(SUM(sl.quantity), 0)::int as "onHand"
		FROM "Item" i
		LEFT JOIN "Supplier" s ON s.id = i."preferredSupplierId"
		LEFT JOIN "StockLevel" sl ON sl."itemId" = i.id AND sl."organizationId" = i."organizationId"
		WHERE i."organizationId" = ${orgId}
		  AND i.status = 'ACTIVE'
		  AND i."reorderPoint" > 0
		GROUP BY i.id, i.name, i.sku, i."reorderPoint", s.name
		HAVING COALESCE(SUM(sl.quantity), 0) <= i."reorderPoint"
		ORDER BY COALESCE(SUM(sl.quantity), 0) ASC
		LIMIT 20
	`;

  const lowStockItems = itemsWithStockData.map((item) => ({
    ...item,
    preferredSupplier: item.preferredSupplierName ? { name: item.preferredSupplierName } : null,
  }));

  // Movement volume per day (last 14 days) for the trend chart.
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const movementsForTrend = await db.stockMovement.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: fourteenDaysAgo },
    },
    select: { createdAt: true, type: true, quantity: true },
  });

  // Group by day
  const dayMap = new Map<string, { receipts: number; issues: number; other: number }>();
  for (const m of movementsForTrend) {
    const day = m.createdAt.toISOString().slice(0, 10);
    const bucket = dayMap.get(day) ?? { receipts: 0, issues: 0, other: 0 };
    if (m.type === "RECEIPT") bucket.receipts += m.quantity;
    else if (m.type === "ISSUE") bucket.issues += m.quantity;
    else bucket.other += m.quantity;
    dayMap.set(day, bucket);
  }
  // Fill missing days
  const trendData: Array<{
    day: string;
    receipts: number;
    issues: number;
    other: number;
  }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const bucket = dayMap.get(day) ?? { receipts: 0, issues: 0, other: 0 };
    trendData.push({ day, ...bucket });
  }

  // Sprint 4: topItemsData and categoryValueData now come directly from SQL
  // (computed in the parallel Promise.all above). No JS aggregation needed.
  // The old code fetched all 30-day movements + all stockLevels and aggregated
  // in JavaScript. Now it's 2 SQL GROUP BY queries returning ~10-20 rows each.

  // categoryValueData already comes as { category, value }[] from SQL above.

  // P0-2 remediation (audit v1.0): the dashboard previously fabricated the
  // low-stock trend by sampling the *current* low-stock count and scaling it
  // 60% → 100% across 30 days. That produced an always-rising chart that
  // lied to the user. We don't keep a daily stock-breach snapshot, so until
  // that history is captured (see follow-up: observability/snapshots ticket)
  // we return an empty array — the chart is gated on `.length > 0` so it
  // gracefully hides rather than showing made-up data.
  const lowStockTrendData: Array<{ date: string; count: number }> = [];

  // P0-2 remediation (audit v1.0): KPI weekly deltas were hard-coded as a
  // percentage of the *current* value (5% for stock value, etc.). That made
  // the trend indicator always point up and always by the same amount — a
  // fabrication. Real deltas we CAN compute honestly from existing data:
  //
  //  - Items created in the last 7 days (truth, from Item.createdAt)
  //  - Net stock-value change from the last 7 days of movements
  //    (sum of quantity * direction * costPrice)
  //
  // Low-stock week-over-week delta requires a breach snapshot we don't keep,
  // so it stays 0 (trend indicator hides) until that history exists.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  type MovementValueRow = { net: number };
  const [itemsCreatedLast7Days, stockValueDeltaResult] = await Promise.all([
    db.item.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    db.$queryRaw<MovementValueRow[]>`
      SELECT COALESCE(
        SUM(sm.quantity * sm.direction * COALESCE(i."costPrice", 0)),
        0
      )::float AS net
      FROM "StockMovement" sm
      JOIN "Item" i ON i.id = sm."itemId"
      WHERE sm."organizationId" = ${orgId}
        AND sm."createdAt" >= ${sevenDaysAgo}
    `,
  ]);

  const prevWeekItemCountChange = itemsCreatedLast7Days;
  const prevWeekStockValueChange = stockValueDeltaResult[0]?.net ?? 0;
  const prevWeekLowStockChange = 0;

  return {
    activeItemCount,
    archivedItemCount,
    stockValue,
    itemsWithCostPrice,
    warehouseCount,
    lowStockItems,
    openCountCount,
    inProgressCountCount,
    recentMovements,
    trendData,
    topItemsData,
    categoryValueData,
    lowStockTrendData,
    prevWeekItemCountChange,
    prevWeekStockValueChange,
    prevWeekLowStockChange,
  };
}

// =========================
// Dashboard page
// =========================

export default async function DashboardPage() {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const data = await loadDashboardData(membership.organizationId);

  // Phase 2 — plan-gated action buttons on the dashboard.
  // We show all buttons regardless of plan (for discoverability) but disable
  // and explain the restriction for features the current plan doesn't unlock.
  const orgPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  const canUsePOs = hasPlanCapability(orgPlan, "purchaseOrders");

  const lowStockCount = data.lowStockItems.length;

  const totalItemsCaption =
    data.activeItemCount === 0 && data.archivedItemCount === 0
      ? t.dashboard.kpi.totalItemsNone
      : format(t.dashboard.kpi.totalItemsAll, {
          count: String(data.activeItemCount),
          archived: String(data.archivedItemCount),
        });

  // Phase 5.1 — distinguish "$0 because no items" from "$0 because no cost prices".
  const stockValueCaption =
    data.stockValue === 0 && data.activeItemCount > 0 && data.itemsWithCostPrice === 0
      ? "Add cost prices to items to see stock value"
      : data.stockValue === 0
        ? t.dashboard.kpi.stockValueNone
        : format(t.dashboard.kpi.stockValueAcross, {
            warehouses: String(data.warehouseCount),
          });

  const lowStockCaption =
    lowStockCount === 0
      ? t.dashboard.kpi.lowStockNone
      : format(t.dashboard.kpi.lowStockCount, { count: String(lowStockCount) });

  const activeCountsTotal = data.openCountCount + data.inProgressCountCount;
  const activeCountsCaption =
    activeCountsTotal === 0
      ? t.dashboard.kpi.activeCountsNone
      : format(t.dashboard.kpi.activeCountsLabel, {
          open: String(data.openCountCount),
          inProgress: String(data.inProgressCountCount),
        });

  const kpis = [
    {
      label: t.dashboard.kpi.totalItems,
      value: String(data.activeItemCount),
      caption: totalItemsCaption,
      icon: <Package className="h-4.5 w-4.5" />,
      href: "/items",
    },
    {
      label: t.dashboard.kpi.stockValue,
      value: formatCurrency(data.stockValue, {
        currency: region.currency,
        locale: region.numberLocale,
      }),
      caption: stockValueCaption,
      icon: <TrendingUp className="h-4.5 w-4.5" />,
      // Phase 6.4 — links to the stock value report (more relevant than /warehouses)
      href: "/reports/stock-value",
    },
    {
      label: t.dashboard.kpi.lowStock,
      value: String(lowStockCount),
      caption: lowStockCaption,
      icon: <AlertTriangle className="h-4.5 w-4.5" />,
      href: "/reports/low-stock",
    },
    {
      label: t.dashboard.kpi.activeCounts,
      value: String(activeCountsTotal),
      caption: activeCountsCaption,
      icon: <ClipboardCheck className="h-4.5 w-4.5" />,
      href: "/stock-counts",
    },
  ];

  const greeting = session.user.name
    ? format(t.dashboard.greeting, { name: session.user.name })
    : t.dashboard.greetingFallback;

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "short",
    timeStyle: "short",
  });

  const topLowStock = data.lowStockItems.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Sprint 1 PR #7 (UX/UI audit Apr-25 §B-6): migrate the inline
          dashboard header to the canonical PageHeader primitive. The
          gradient title accent is preserved via the new
          `titleClassName` prop so the visual identity does not
          regress. Actions stay identical. */}
      <PageHeader
        title={greeting}
        titleClassName="text-gradient-primary"
        description={`${membership.organization.name} · ${t.dashboard.orgSubtitle}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/scan">
                <ScanLine className="h-4 w-4" />
                {t.dashboard.actions.scan}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/stock-counts/new">
                <ClipboardCheck className="h-4 w-4" />
                {t.dashboard.actions.startCount}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/items/new">
                <Plus className="h-4 w-4" />
                {t.dashboard.actions.newItem}
              </Link>
            </Button>
            {canUsePOs ? (
              <Button asChild>
                <Link href="/purchase-orders/new">
                  <ShoppingCart className="h-4 w-4" />
                  {t.dashboard.actions.newPurchaseOrder}
                </Link>
              </Button>
            ) : (
              <Button disabled title="Purchase orders are available on the Pro plan">
                <Lock className="h-4 w-4" />
                {t.dashboard.actions.newPurchaseOrder}
              </Button>
            )}
          </div>
        }
      />

      {/* KPI cards — premium design with KpiCard component */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, idx) => {
          // P9.3b — Determine trend for this KPI
          let trendValue = 0;
          if (idx === 0) {
            // Total items
            trendValue = data.prevWeekItemCountChange;
          } else if (idx === 1) {
            // Stock value
            trendValue = data.prevWeekStockValueChange;
          } else if (idx === 2) {
            // Low stock
            trendValue = data.prevWeekLowStockChange;
          }

          return (
            <KpiCard
              key={kpi.label}
              title={kpi.label}
              value={kpi.value}
              description={kpi.caption}
              icon={kpi.icon}
              href={kpi.href}
              trend={
                trendValue !== 0
                  ? {
                      value: Math.round(trendValue),
                      label: `${t.dashboard.kpi.vsLastWeek}`,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Gap B1 — Activation tips card (data-driven with checkmarks, shown until all 5 steps complete) */}
      {(() => {
        // Determine completion status for each step
        const steps = [
          {
            id: 1,
            label: "Add first item",
            href: "/items/new",
            icon: Package,
            complete: data.activeItemCount > 0,
          },
          {
            id: 2,
            label: "Add a warehouse",
            href: "/warehouses",
            icon: Warehouse,
            complete: data.warehouseCount > 0,
          },
          {
            id: 3,
            label: "Log a movement",
            href: "/movements",
            icon: ArrowLeftRight,
            complete: data.recentMovements.length > 0,
          },
          {
            id: 4,
            label: "Run a stock count",
            href: "/stock-counts",
            icon: ClipboardCheck,
            complete: data.openCountCount > 0 || data.inProgressCountCount > 0,
          },
        ];

        const allComplete = steps.every((s) => s.complete);
        if (allComplete) return null;

        const completedCount = steps.filter((s) => s.complete).length;

        return (
          <Card className="border-primary/20 overflow-hidden">
            {/* Premium gradient top border */}
            <div className="h-1 w-full" style={{ background: "var(--gradient-primary)" }} />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-semibold">Get started with OneAce</CardTitle>
                  <CardDescription>
                    {completedCount === 0
                      ? "Complete these steps to set up your inventory"
                      : `${completedCount} of ${steps.length} steps complete`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold text-primary tabular-nums">
                    {Math.round((completedCount / steps.length) * 100)}%
                  </span>
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(completedCount / steps.length) * 100}%`,
                        background: "var(--gradient-primary)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {steps.map((step) => {
                  const StepIcon = step.icon;
                  return (
                    <Link
                      key={step.id}
                      href={step.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors cursor-pointer",
                        step.complete
                          ? "border-success bg-success-light hover:bg-success-light/70"
                          : "border-border bg-background/80 hover:border-primary/40 hover:bg-background hover:shadow-sm",
                      )}
                    >
                      {step.complete ? (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          {step.id}
                        </span>
                      )}
                      <StepIcon className="h-4 w-4 text-muted-foreground" />
                      <span className={cn("text-sm", step.complete && "text-success")}>
                        {step.label}
                      </span>
                      {step.complete && (
                        <span className="ml-auto text-xs font-medium text-success">✓ Done</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Movement trend chart — last 14 days */}
      <ChartCard title={t.dashboard.trendChart.title} description={t.dashboard.trendChart.subtitle}>
        <LazyTrendChart
          data={data.trendData}
          labels={{
            receipts: t.movements.types.RECEIPT,
            issues: t.movements.types.ISSUE,
            other: t.dashboard.trendChart.otherLabel,
          }}
        />
      </ChartCard>

      {/* P9.3a — Top 10 Most-Moved Items chart */}
      {data.topItemsData.length > 0 && (
        <ChartCard
          title={t.dashboard.topItemsChart.title}
          description={t.dashboard.topItemsChart.subtitle}
        >
          <LazyTopItemsChart data={data.topItemsData} />
        </ChartCard>
      )}

      {/* P9.3a — Stock Value by Category and Low Stock Trend charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stock Value by Category */}
        {data.categoryValueData.length > 0 && (
          <ChartCard
            title={t.dashboard.categoryValueChart.title}
            description={t.dashboard.categoryValueChart.subtitle}
          >
            <LazyCategoryValueChart data={data.categoryValueData} />
          </ChartCard>
        )}

        {/* Low Stock Trend */}
        {data.lowStockTrendData.length > 0 && (
          <ChartCard
            title={t.dashboard.lowStockTrendChart.title}
            description={t.dashboard.lowStockTrendChart.subtitle}
          >
            <LazyLowStockTrendChart data={data.lowStockTrendData} />
          </ChartCard>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low stock card */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="text-muted-foreground h-4 w-4" />
                {t.dashboard.lowStockCard.title}
              </CardTitle>
              <CardDescription>{t.dashboard.lowStockCard.subtitle}</CardDescription>
            </div>
            {lowStockCount > 0 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/reports/low-stock">{t.dashboard.lowStockCard.viewAll}</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {topLowStock.length === 0 ? (
              // Sprint 17 PR #1 (UX/UI audit Apr-25 §B-7): inline ternary empty → EmptyState (bare).
              <EmptyState
                icon={CheckCircle2}
                title={t.dashboard.lowStockCard.empty}
                variant="completed"
                bare
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.dashboard.lowStockCard.columnItem}</TableHead>
                    <TableHead className="text-right">
                      {t.dashboard.lowStockCard.columnOnHand}
                    </TableHead>
                    <TableHead className="text-right">
                      {t.dashboard.lowStockCard.columnReorderAt}
                    </TableHead>
                    <TableHead>{t.dashboard.lowStockCard.columnSupplier}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLowStock.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                          {item.name}
                        </Link>
                        <div className="text-muted-foreground font-mono text-xs">{item.sku}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.onHand}</TableCell>
                      <TableCell className="text-right font-mono">{item.reorderPoint}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.preferredSupplier?.name ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent activity card */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="text-muted-foreground h-4 w-4" />
                {t.dashboard.recentActivityCard.title}
              </CardTitle>
              <CardDescription>{t.dashboard.recentActivityCard.subtitle}</CardDescription>
            </div>
            {data.recentMovements.length > 0 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/movements">{t.dashboard.recentActivityCard.viewAll}</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {data.recentMovements.length === 0 ? (
              // Sprint 17 PR #1 (UX/UI audit Apr-25 §B-7): inline ternary empty → EmptyState (bare).
              <EmptyState icon={Activity} title={t.dashboard.recentActivityCard.empty} bare />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.dashboard.recentActivityCard.columnType}</TableHead>
                    <TableHead>{t.dashboard.recentActivityCard.columnItem}</TableHead>
                    <TableHead className="text-right">
                      {t.dashboard.recentActivityCard.columnQuantity}
                    </TableHead>
                    <TableHead>{t.dashboard.recentActivityCard.columnWhen}</TableHead>
                    {/* Phase 5.1 — show who performed the movement */}
                    <TableHead className="hidden md:table-cell">By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentMovements.map((m) => {
                    const signed = m.direction * m.quantity;
                    const byLabel = m.createdBy?.name ?? m.createdBy?.email ?? null;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {m.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{m.item.name}</div>
                          <div className="text-muted-foreground font-mono text-xs">
                            {m.item.sku}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {signed > 0 ? `+${signed}` : signed}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {dateFormatter.format(m.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden truncate max-w-[100px] text-xs md:table-cell">
                          {byLabel ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary actions row */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.actions.heading}</CardTitle>
          <CardDescription>{t.dashboard.actions.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/reports/low-stock">
              <FileBarChart className="h-4 w-4" />
              {t.dashboard.actions.lowStockReport}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/purchase-orders">
              <ShoppingCart className="h-4 w-4" />
              {t.dashboard.actions.receiveStock}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
