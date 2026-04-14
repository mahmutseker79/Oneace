import {
	AlertTriangle,
	ClipboardCheck,
	FileBarChart,
	Lock,
	Package,
	Plus,
	ScanLine,
	ShoppingCart,
	TrendingUp,
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
import { formatCurrency } from "@/lib/utils";

import { LazyTrendChart } from "./lazy-trend-chart";

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
	] = await Promise.all([
		db.item.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
		db.item.count({ where: { organizationId: orgId, status: "ARCHIVED" } }),
		db.stockLevel.findMany({
			where: { organizationId: orgId },
			select: {
				quantity: true,
				itemId: true,
				item: { select: { costPrice: true } },
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
				{kpis.map((kpi) => {
					const Icon = kpi.icon;
					return (
						<Link key={kpi.label} href={kpi.href} className="group block">
							<Card className="transition-colors group-hover:border-foreground/20">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-muted-foreground text-sm font-medium">
										{kpi.label}
									</CardTitle>
									<Icon className="text-muted-foreground h-4 w-4" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-semibold">{kpi.value}</div>
									<p className="text-muted-foreground mt-1 text-xs">
										{kpi.caption}
									</p>
								</CardContent>
							</Card>
						</Link>
					);
				})}
			</div>

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
