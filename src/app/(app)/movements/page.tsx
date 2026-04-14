import { ArrowLeftRight, ArrowRightLeft, Download, Plus } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
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
	hasAnyFilter,
	parseMovementFilter,
} from "./filter";
import { MovementsFilterBar } from "./movements-filter-bar";

type MovementType =
	| "RECEIPT"
	| "ISSUE"
	| "ADJUSTMENT"
	| "TRANSFER"
	| "BIN_TRANSFER"
	| "COUNT";

// Result cap. Unfiltered view shows the most recent 200 (unchanged
// from Sprint 2); filtered view raises to 500 so a date range can
// actually surface older history. Anyone who needs more can use the
// CSV export at /movements/export, which carries the same filters.
const UNFILTERED_LIMIT = 200;
const FILTERED_LIMIT = 500;

export async function generateMetadata(): Promise<Metadata> {
	const t = await getMessages();
	return { title: t.movements.metaTitle };
}

type MovementsPageProps = {
	searchParams: Promise<MovementSearchParams>;
};

function buildExportHref(filter: {
	rawFrom: string;
	rawTo: string;
	rawType: string;
	rawWarehouse: string;
	rawQ: string;
}): string {
	const params = new URLSearchParams();
	if (filter.rawFrom) params.set("from", filter.rawFrom);
	if (filter.rawTo) params.set("to", filter.rawTo);
	if (filter.rawType) params.set("type", filter.rawType);
	if (filter.rawWarehouse) params.set("warehouse", filter.rawWarehouse);
	if (filter.rawQ) params.set("q", filter.rawQ);
	const qs = params.toString();
	return qs ? `/movements/export?${qs}` : "/movements/export";
}

export default async function MovementsPage({
	searchParams,
}: MovementsPageProps) {
	const { membership } = await requireActiveMembership();
	const t = await getMessages();
	const region = await getRegion();

	// P10.1 — capability flags for conditional UI rendering
	const canCreate = hasCapability(membership.role, "movements.create");
	const canExport = hasCapability(membership.role, "reports.export");

	const filter = await parseMovementFilter(searchParams);
	const filterActive = hasAnyFilter(filter);
	const limit = filterActive ? FILTERED_LIMIT : UNFILTERED_LIMIT;

	// Load the org's warehouses for the filter dropdown in parallel
	// with the ledger query. Independent of the active filter so a
	// warehouse you've already selected doesn't disappear from the
	// dropdown if a different filter narrows the ledger — otherwise
	// you'd lose the ability to broaden. Warehouse counts per org are
	// bounded for SMBs, so loading them all is cheap.
	const [movements, warehouses] = await Promise.all([
		db.stockMovement.findMany({
			where: {
				organizationId: membership.organizationId,
				...buildMovementWhere(filter),
			},
			include: {
				item: { select: { id: true, sku: true, name: true, unit: true } },
				warehouse: { select: { id: true, name: true, code: true } },
				toWarehouse: { select: { id: true, name: true, code: true } },
				createdBy: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
			take: limit,
		}),
		db.warehouse.findMany({
			where: { organizationId: membership.organizationId, isArchived: false },
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		}),
	]);

	const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	function typeBadge(type: MovementType) {
		const label = t.movements.types[type];
		if (type === "RECEIPT")
			return <Badge className="bg-emerald-600">{label}</Badge>;
		if (type === "ISSUE") return <Badge variant="destructive">{label}</Badge>;
		if (type === "ADJUSTMENT")
			return <Badge variant="secondary">{label}</Badge>;
		if (type === "TRANSFER") return <Badge variant="outline">{label}</Badge>;
		return <Badge variant="outline">{label}</Badge>;
	}

	const typeOptions = (
		["RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER", "COUNT"] as const
	).map((type) => ({
		value: type,
		label: t.movements.types[type],
	}));

	const countLine = filterActive
		? format(t.movements.filter.resultCount, { count: movements.length })
		: format(t.movements.filter.resultCountUnfiltered, {
				count: movements.length,
			});

	const truncated = movements.length === limit;

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-semibold">{t.movements.heading}</h1>
					<p className="text-muted-foreground">{t.movements.subtitle}</p>
				</div>
				<div className="flex items-center gap-2">
					{canExport ? (
						<Button asChild variant="outline">
							<Link href={buildExportHref(filter)}>
								<Download className="h-4 w-4" />
								{t.common.exportCsv}
							</Link>
						</Button>
					) : null}
					{canCreate ? (
						<Button asChild variant="outline">
							<Link href="/movements/transfers/new">
								<ArrowRightLeft className="h-4 w-4" />
								{t.movements.transfers.heading}
							</Link>
						</Button>
					) : null}
					{canCreate ? (
						<Button asChild>
							<Link href="/movements/new">
								<Plus className="h-4 w-4" />
								{t.movements.newMovement}
							</Link>
						</Button>
					) : null}
				</div>
			</div>

			<MovementsFilterBar
				initialFrom={filter.rawFrom}
				initialTo={filter.rawTo}
				initialType={filter.rawType}
				initialWarehouse={filter.rawWarehouse}
				initialQ={filter.rawQ}
				typeOptions={typeOptions}
				warehouseOptions={warehouses}
				labels={{
					heading: t.movements.filter.heading,
					fromLabel: t.movements.filter.fromLabel,
					toLabel: t.movements.filter.toLabel,
					typeLabel: t.movements.filter.typeLabel,
					typeAll: t.movements.filter.typeAll,
					warehouseLabel: t.movements.filter.warehouseLabel,
					warehouseAll: t.movements.filter.warehouseAll,
					itemLabel: t.movements.filter.itemLabel,
					itemPlaceholder: t.movements.filter.itemPlaceholder,
					apply: t.movements.filter.apply,
					clear: t.movements.filter.clear,
					invalidRange: t.movements.filter.invalidRange,
				}}
			/>

			{movements.length === 0 ? (
				<EmptyState
					icon={ArrowLeftRight}
					title={
						filterActive
							? t.movements.filter.emptyFilteredTitle
							: t.movements.emptyTitle
					}
					description={
						filterActive
							? t.movements.filter.emptyFilteredBody
							: t.movements.emptyBody
					}
					variant={filterActive ? "filtered" : "empty"}
					actions={
						!filterActive && canCreate
							? [
									{
										label: t.movements.emptyCta,
										href: "/movements/new",
										icon: Plus,
									},
								]
							: undefined
					}
				/>
			) : (
				<>
					<div className="text-muted-foreground flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
						<span>{countLine}</span>
						{truncated ? (
							<span className="italic">
								{format(t.movements.filter.truncatedNotice, { limit })}
							</span>
						) : null}
					</div>
					<Card>
						<CardContent className="p-0">
							{/* Phase 4.2 — Mobile card view (hidden md+) */}
							<div className="divide-y md:hidden">
								{movements.map((m) => {
									const signedQty = m.direction < 0 ? -m.quantity : m.quantity;
									const qtyPrefix =
										signedQty > 0
											? t.movements.directionIn
											: t.movements.directionOut;
									const absQty = Math.abs(signedQty);
									const warehouseCell =
										m.type === "TRANSFER" && m.toWarehouse
											? `${m.warehouse.name} → ${m.toWarehouse.name}`
											: m.warehouse.name;
									return (
										<div
											key={m.id}
											className="flex items-start justify-between gap-3 px-4 py-3"
										>
											<div className="min-w-0 flex-1 space-y-1">
												<Link
													href={`/items/${m.item.id}`}
													className="block truncate font-medium hover:underline"
												>
													{m.item.name}
												</Link>
												<div className="flex flex-wrap items-center gap-2">
													{typeBadge(m.type as MovementType)}
													<span className="text-xs text-muted-foreground">
														{warehouseCell}
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
													{dateFormatter.format(m.createdAt)}
												</p>
											</div>
											<span
												className={`shrink-0 font-mono font-medium tabular-nums ${signedQty >= 0 ? "text-emerald-600" : "text-destructive"}`}
											>
												{qtyPrefix}
												{absQty}
											</span>
										</div>
									);
								})}
							</div>

							{/* Desktop table (hidden below md) */}
							<div className="hidden overflow-x-auto md:block">
								<Table className="min-w-[640px]">
									<TableHeader>
										<TableRow>
											<TableHead>{t.movements.columnDate}</TableHead>
											<TableHead>{t.movements.columnItem}</TableHead>
											<TableHead>{t.movements.columnType}</TableHead>
											<TableHead>{t.movements.columnWarehouse}</TableHead>
											<TableHead className="text-right">
												{t.movements.columnQuantity}
											</TableHead>
											<TableHead>{t.movements.columnReference}</TableHead>
											<TableHead>{t.movements.columnUser}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{movements.map((m) => {
											const signedQty =
												m.direction < 0 ? -m.quantity : m.quantity;
											const qtyPrefix =
												signedQty > 0
													? t.movements.directionIn
													: t.movements.directionOut;
											const absQty = Math.abs(signedQty);
											const warehouseCell =
												m.type === "TRANSFER" && m.toWarehouse
													? `${m.warehouse.name} ${t.movements.transferLabel} ${m.toWarehouse.name}`
													: m.warehouse.name;
											const userLabel =
												m.createdBy?.name ??
												m.createdBy?.email ??
												t.movements.unknownUser;
											return (
												<TableRow key={m.id}>
													<TableCell className="text-muted-foreground whitespace-nowrap text-xs">
														{dateFormatter.format(m.createdAt)}
													</TableCell>
													<TableCell>
														<Link
															href={`/items/${m.item.id}`}
															className="font-medium hover:underline"
														>
															{m.item.name}
														</Link>
														<div className="text-muted-foreground font-mono text-xs">
															{m.item.sku}
														</div>
													</TableCell>
													<TableCell>
														{typeBadge(m.type as MovementType)}
													</TableCell>
													<TableCell className="text-sm">
														{warehouseCell}
													</TableCell>
													<TableCell className="text-right tabular-nums">
														<span
															className={
																signedQty >= 0
																	? "text-emerald-600"
																	: "text-destructive"
															}
														>
															{qtyPrefix}
															{absQty} {m.item.unit}
														</span>
													</TableCell>
													<TableCell className="text-muted-foreground text-xs">
														{m.reference ?? "—"}
													</TableCell>
													<TableCell className="text-muted-foreground text-xs">
														{userLabel}
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>
				</>
			)}
		</div>
	);
}
