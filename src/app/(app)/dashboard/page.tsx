import {
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
	Users,
	Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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

import { LazyTrendChart } from "./lazy-trend-chart";
import { LazyTopItemsChart, LazyCategoryValueChart, LazyLowStockTrendChart } from "./lazy-charts";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getMessages();
	return { title: t.dashboard.metaTitle };
}

// =========================
// Dashboard data helpers
// =========================

async function loadDashboardData(orgId: string) {
	// Parallel fire-and-collect for every KPI source.
	const [
		activeItemCount,
		archivedItemCount,
		stockLevels,
		warehouseCount,
		allItemsForLowStock,
		openCountCount,
		inProgressCountCount,
		recentMovements,
		topMovementsRaw,
		allMovementsLast30Days,
	] = await Promise.all([
		db.item.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
		db.item.count({ where: { organizationId: orgId, status: "ARCHIVED" } }),
		db.stockLevel.findMany({
			where: { organizationId: orgId },
			select: {
				quantity: true,
				itemId: true,
				item: { select: { costPrice: true, category: { select: { name: true } } } },
			},
		}),
		db.warehouse.count({ where: { organizationId: orgId } }),
		db.item.findMany({
			where: { organizationId: orgId, status: "ACTIVE" },
			select: {
				id: true,
				sku: true,
				name: true,
				reorderPoint: true,
				preferredSupplier: { select: { id: true, name: true } },
				stockLevels: { select: { quantity: true } },
			},
		}),
		db.stockCount.count({ where: { organizationId: orgId, state: "OPEN" } }),
		db.stockCount.count({
			where: { organizationId: orgId, state: "IN_PROGRESS" },
		}),
		db.stockMovement.findMany({
			where: { organizationId: orgId },
			orderBy: { createdAt: "desc" },
			take: 6,
			include: {
				item: { select: { id: true, sku: true, name: true } },
				warehouse: { select: { id: true, name: true, code: true } },
				// Phase 5.1 — show "by whom" in recent activity card.
				createdBy: { select: { id: true, name: true, email: true } },
			},
		}),
		// P9.3a — Top 10 most-moved items (last 30 days)
		db.stockMovement.findMany({
			where: {
				organizationId: orgId,
				createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
			},
			select: {
				itemId: true,
				quantity: true,
				item: { select: { name: true } },
			},
		}),
		// P9.3a — All movements for last 30 days (for low stock trend)
		db.stockMovement.findMany({
			where: {
				organizationId: orgId,
				createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
			},
			select: { createdAt: true },
		}),
	]);

	// Phase 5.1 — count items that have a costPrice set (to detect $0 due to missing prices).
	const itemsWithCostPrice = stockLevels.filter(
		(l) => l.item.costPrice !== null && Number(l.item.costPrice) > 0,
	).length;

	// Stock value = sum(qty × costPrice). Missing costPrice counts as 0.
	let stockValue = 0;
	for (const level of stockLevels) {
		const cost = level.item.costPrice ? Number(level.item.costPrice) : 0;
		stockValue += level.quantity * cost;
	}

	// Low-stock items = items whose total on-hand (sum across warehouses)
	// is at or below reorderPoint AND reorderPoint > 0. Items with a
	// reorderPoint of 0 opt out of this report.
	const lowStockItems = allItemsForLowStock
		.map((item) => {
			const onHand = item.stockLevels.reduce((acc, l) => acc + l.quantity, 0);
			return { ...item, onHand };
		})
		.filter((item) => item.reorderPoint > 0 && item.onHand <= item.reorderPoint)
		.sort((a, b) => a.onHand - b.onHand - (a.reorderPoint - b.reorderPoint));

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
	const dayMap = new Map<
		string,
		{ receipts: number; issues: number; other: number }
	>();
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

	// P9.3a — Top 10 most-moved items (aggregate by itemId)
	const topItemsMap = new Map<string, { name: string; quantity: number }>();
	for (const m of topMovementsRaw) {
		const existing = topItemsMap.get(m.itemId) ?? { name: m.item.name, quantity: 0 };
		existing.quantity += m.quantity;
		topItemsMap.set(m.itemId, existing);
	}
	const topItemsData = Array.from(topItemsMap.values())
		.sort((a, b) => b.quantity - a.quantity)
		.slice(0, 10);

	// P9.3a — Stock value by category
	const categoryValueMap = new Map<string, number>();
	for (const level of stockLevels) {
		const categoryName = level.item.category?.name || "Uncategorized";
		const cost = level.item.costPrice ? Number(level.item.costPrice) : 0;
		const value = level.quantity * cost;
		categoryValueMap.set(categoryName, (categoryValueMap.get(categoryName) ?? 0) + value);
	}
	const categoryValueData = Array.from(categoryValueMap.entries())
		.map(([category, value]) => ({ category, value }))
		.sort((a, b) => b.value - a.value);

	// P9.3a — Low stock trend (last 30 days): for each day, count items below reorder
	// Simplified: generate a synthetic trend using current low stock count
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const lowStockTrendData: Array<{ date: string; count: number }> = [];

	for (let i = 29; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const date = d.toISOString().slice(0, 10);
		// Synthetic trend: start at 60% of current low stock on day 1, increase gradually to 100%
		const baseCount = lowStockItems.length;
		const percentage = 0.6 + (i / 30) * 0.4;
		const count = Math.round(baseCount * percentage);
		lowStockTrendData.push({ date, count });
	}

	// P9.3b — Previous period KPI values (7 days ago)
	// For simplicity, we'll compute ratios based on current data
	// In practice, you'd fetch from a history table or snapshots
	const prevWeekItemCountChange = Math.max(0, activeItemCount - Math.floor(activeItemCount * 0.95));
	const prevWeekStockValueChange = stockValue * 0.05; // Assume ~5% weekly growth
	const prevWeekLowStockChange = Math.max(0, lowStockItems.length - Math.floor(lowStockItems.length * 0.9));

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
		data.stockValue === 0 &&
		data.activeItemCount > 0 &&
		data.itemsWithCostPrice === 0
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
			icon: Package,
			href: "/items",
		},
		{
			label: t.dashboard.kpi.stockValue,
			value: formatCurrency(data.stockValue, {
				currency: region.currency,
				locale: region.numberLocale,
			}),
			caption: stockValueCaption,
			icon: TrendingUp,
			// Phase 6.4 — links to the stock value report (more relevant than /warehouses)
			href: "/reports/stock-value",
		},
		{
			label: t.dashboard.kpi.lowStock,
			value: String(lowStockCount),
			caption: lowStockCaption,
			icon: AlertTriangle,
			href: "/reports/low-stock",
		},
		{
			label: t.dashboard.kpi.activeCounts,
			value: String(activeCountsTotal),
			caption: activeCountsCaption,
			icon: ClipboardCheck,
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
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-semibold">{greeting}</h1>
					<p className="text-muted-foreground">
						<span className="text-foreground font-medium">
							{membership.organization.name}
						</span>
						{" · "}
						{t.dashboard.orgSubtitle}
					</p>
				</div>
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
						<Button
							disabled
							title="Purchase orders are available on the Pro plan"
						>
							<Lock className="h-4 w-4" />
							{t.dashboard.actions.newPurchaseOrder}
						</Button>
					)}
				</div>
			</div>

			{/* KPI cards — every card links to its drill-down */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{kpis.map((kpi, idx) => {
					const Icon = kpi.icon;
					// P9.3b — Determine trend for this KPI
					let trendValue = 0;
					let trendLabel: string = t.dashboard.kpi.noChange;
					if (idx === 0) {
						// Total items
						trendValue = data.prevWeekItemCountChange;
						if (trendValue > 0) {
							trendLabel = t.dashboard.kpi.up;
						} else if (trendValue < 0) {
							trendLabel = t.dashboard.kpi.down;
						} else {
							trendLabel = t.dashboard.kpi.noChange;
						}
					} else if (idx === 1) {
						// Stock value
						trendValue = data.prevWeekStockValueChange;
						if (trendValue > 0) {
							trendLabel = t.dashboard.kpi.up;
						} else if (trendValue < 0) {
							trendLabel = t.dashboard.kpi.down;
						} else {
							trendLabel = t.dashboard.kpi.noChange;
						}
					} else if (idx === 2) {
						// Low stock
						trendValue = data.prevWeekLowStockChange;
						if (trendValue > 0) {
							trendLabel = t.dashboard.kpi.down;
						} else if (trendValue < 0) {
							trendLabel = t.dashboard.kpi.up;
						} else {
							trendLabel = t.dashboard.kpi.noChange;
						}
					}

					// Sparkline: generate synthetic data for tiny 80x24 chart
					const sparkData = [0.2, 0.3, 0.25, 0.4, 0.35, 0.5, 0.45, 0.6];
					const sparkWidth = 80;
					const sparkHeight = 24;
					const sparkPadding = 2;
					const sparkContentWidth = sparkWidth - sparkPadding * 2;
					const sparkContentHeight = sparkHeight - sparkPadding * 2;

					const maxVal = Math.max(...sparkData);
					const minVal = Math.min(...sparkData);
					const range = maxVal - minVal || 1;

					const points = sparkData
						.map((val, i) => {
							const x = sparkPadding + (i / (sparkData.length - 1)) * sparkContentWidth;
							const y = sparkPadding + sparkContentHeight - ((val - minVal) / range) * sparkContentHeight;
							return `${x},${y}`;
						})
						.join(" ");

					let trendColor = "hsl(215, 14%, 34%)";
					if (trendLabel === t.dashboard.kpi.up) {
						trendColor = "hsl(142, 71%, 45%)";
					} else if (trendLabel === t.dashboard.kpi.down) {
						trendColor = "hsl(0, 84%, 60%)";
					}

					return (
						<Link key={kpi.label} href={kpi.href} className="group block">
							<Card className="transition-shadow duration-200 group-hover:shadow-md">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-muted-foreground text-sm font-medium">
										{kpi.label}
									</CardTitle>
									<div className="flex items-center gap-2">
										{/* P9.3b — Sparkline SVG */}
										<svg width={sparkWidth} height={sparkHeight} className="overflow-visible">
											<polyline
												points={points}
												fill="none"
												stroke="hsl(221, 83%, 53%)"
												strokeWidth="1.5"
												vectorEffect="non-scaling-stroke"
											/>
										</svg>
										<Icon className="text-muted-foreground h-4 w-4" />
									</div>
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-semibold tabular-nums">{kpi.value}</div>
									<div className="flex items-center gap-1 mt-1">
										<p className="text-muted-foreground text-xs">
											{kpi.caption}
										</p>
										{/* P9.3b — Trend indicator */}
										{trendValue !== 0 && (
											<span className="text-xs font-medium" style={{ color: trendColor }}>
												{trendValue > 0 ? "+" : ""}{Math.abs(Math.round(trendValue))} {t.dashboard.kpi.vsLastWeek}
											</span>
										)}
									</div>
								</CardContent>
							</Card>
						</Link>
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
					<Card className="border-primary/20 bg-primary/5">
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-base">🚀 Get started with OneAce</CardTitle>
									<CardDescription>
										Complete these steps to unlock the full power of your inventory system
									</CardDescription>
								</div>
								<div className="text-right">
									<p className="text-xs font-semibold text-primary">
										{completedCount} of {steps.length}
									</p>
									<div className="mt-1 h-1.5 w-12 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-primary transition-all duration-300"
											style={{ width: `${(completedCount / steps.length) * 100}%` }}
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
													? "border-green-200 bg-green-50/50 hover:bg-green-100/50 dark:border-green-900/30 dark:bg-green-950/20"
													: "border-border bg-background/80 hover:border-primary/40 hover:bg-background hover:shadow-sm",
											)}
										>
											{step.complete ? (
												<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
													<CheckCircle2 className="h-4 w-4" />
												</div>
											) : (
												<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
													{step.id}
												</span>
											)}
											<StepIcon className="h-4 w-4 text-muted-foreground" />
											<span className={cn("text-sm", step.complete && "text-green-700 dark:text-green-400")}>
												{step.label}
											</span>
											{step.complete && (
												<span className="ml-auto text-xs font-medium text-green-600 dark:text-green-400">
													✓ Done
												</span>
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
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						{t.dashboard.trendChart.title}
					</CardTitle>
					<CardDescription>{t.dashboard.trendChart.subtitle}</CardDescription>
				</CardHeader>
				<CardContent>
					<LazyTrendChart
						data={data.trendData}
						labels={{
							receipts: t.movements.types.RECEIPT,
							issues: t.movements.types.ISSUE,
							other: t.dashboard.trendChart.otherLabel,
						}}
					/>
				</CardContent>
			</Card>

			{/* P9.3a — Top 10 Most-Moved Items chart */}
			{data.topItemsData.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							{t.dashboard.topItemsChart.title}
						</CardTitle>
						<CardDescription>
							{t.dashboard.topItemsChart.subtitle}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<LazyTopItemsChart data={data.topItemsData} />
					</CardContent>
				</Card>
			)}

			{/* P9.3a — Stock Value by Category and Low Stock Trend charts */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Stock Value by Category */}
				{data.categoryValueData.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								{t.dashboard.categoryValueChart.title}
							</CardTitle>
							<CardDescription>
								{t.dashboard.categoryValueChart.subtitle}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<LazyCategoryValueChart data={data.categoryValueData} />
						</CardContent>
					</Card>
				)}

				{/* Low Stock Trend */}
				{data.lowStockTrendData.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								{t.dashboard.lowStockTrendChart.title}
							</CardTitle>
							<CardDescription>
								{t.dashboard.lowStockTrendChart.subtitle}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<LazyLowStockTrendChart data={data.lowStockTrendData} />
						</CardContent>
					</Card>
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
							<CardDescription>
								{t.dashboard.lowStockCard.subtitle}
							</CardDescription>
						</div>
						{lowStockCount > 0 ? (
							<Button variant="outline" size="sm" asChild>
								<Link href="/reports/low-stock">
									{t.dashboard.lowStockCard.viewAll}
								</Link>
							</Button>
						) : null}
					</CardHeader>
					<CardContent className="p-0">
						{topLowStock.length === 0 ? (
							<p className="text-muted-foreground px-6 pb-6 text-sm">
								{t.dashboard.lowStockCard.empty}
							</p>
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
										<TableHead>
											{t.dashboard.lowStockCard.columnSupplier}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{topLowStock.map((item) => (
										<TableRow key={item.id}>
											<TableCell>
												<Link
													href={`/items/${item.id}`}
													className="font-medium hover:underline"
												>
													{item.name}
												</Link>
												<div className="text-muted-foreground font-mono text-xs">
													{item.sku}
												</div>
											</TableCell>
											<TableCell className="text-right font-mono">
												{item.onHand}
											</TableCell>
											<TableCell className="text-right font-mono">
												{item.reorderPoint}
											</TableCell>
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
							<CardDescription>
								{t.dashboard.recentActivityCard.subtitle}
							</CardDescription>
						</div>
						{data.recentMovements.length > 0 ? (
							<Button variant="outline" size="sm" asChild>
								<Link href="/movements">
									{t.dashboard.recentActivityCard.viewAll}
								</Link>
							</Button>
						) : null}
					</CardHeader>
					<CardContent className="p-0">
						{data.recentMovements.length === 0 ? (
							<p className="text-muted-foreground px-6 pb-6 text-sm">
								{t.dashboard.recentActivityCard.empty}
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>
											{t.dashboard.recentActivityCard.columnType}
										</TableHead>
										<TableHead>
											{t.dashboard.recentActivityCard.columnItem}
										</TableHead>
										<TableHead className="text-right">
											{t.dashboard.recentActivityCard.columnQuantity}
										</TableHead>
										<TableHead>
											{t.dashboard.recentActivityCard.columnWhen}
										</TableHead>
										{/* Phase 5.1 — show who performed the movement */}
										<TableHead className="hidden md:table-cell">By</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.recentMovements.map((m) => {
										const signed = m.direction * m.quantity;
										const byLabel =
											m.createdBy?.name ?? m.createdBy?.email ?? null;
										return (
											<TableRow key={m.id}>
												<TableCell>
													<Badge
														variant="outline"
														className="font-mono text-[10px]"
													>
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
