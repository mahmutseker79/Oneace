import {
	AlertTriangle,
	ArrowLeftRight,
	ArrowRight,
	ArrowUpDown,
	BarChart3,
	Check,
	CheckCircle2,
	Circle,
	Download,
	Eye,
	FileUp,
	Info,
	Package,
	Plus,
	Search,
	Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ItemsCacheBanner } from "@/components/offline/items-cache-banner";
import { ItemsCacheSync } from "@/components/offline/items-cache-sync";
import { DeleteButton } from "@/components/shell/delete-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/format-relative";
import { getMessages, getRegion } from "@/lib/i18n";
import type { ItemSnapshotRow } from "@/lib/offline/items-cache";
import { hasCapability } from "@/lib/permissions";
import { UNLIMITED, getPlanLimit, hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

import { CompactBridge } from "@/components/bridge/compact-bridge";

import { deleteItemAction } from "./actions";
import { dismissBridgeAction } from "./dismiss-bridge-action";
import { type ItemRow, ItemsTable } from "./items-table";

// Phase 2/3 UX — extended search params: text search, column sort, pagination.
type SearchParams = Promise<{
	status?: string;
	q?: string; // text search across name, SKU, barcode
	sort?: string; // "name" | "sku" | "date"
	dir?: string; // "asc" | "desc"
	cursor?: string; // item.id — cursor for pagination
}>;

// Phase 3 — pagination constants.
// Search mode uses SEARCH_LIMIT (client-side filter needs all matching rows).
// Browse mode uses PAGE_SIZE with cursor-based load-more.
const PAGE_SIZE = 50;
const SEARCH_LIMIT = 100;

type ItemStatus = "ACTIVE" | "ARCHIVED" | "DRAFT";
type StatusFilter = "all" | ItemStatus;

function parseStatusFilter(raw: string | undefined): StatusFilter {
	if (raw === "active") return "ACTIVE";
	if (raw === "archived") return "ARCHIVED";
	if (raw === "draft") return "DRAFT";
	return "all";
}

type SortCol = "name" | "sku" | "date";
type SortDir = "asc" | "desc";

function parseSortParams(
	rawSort?: string,
	rawDir?: string,
): { col: SortCol; dir: SortDir } {
	const col: SortCol =
		rawSort === "name" ? "name" : rawSort === "sku" ? "sku" : "date";
	const dir: SortDir = rawDir === "asc" ? "asc" : "desc";
	return { col, dir };
}

function buildOrderBy(col: SortCol, dir: SortDir) {
	if (col === "name") return { name: dir };
	if (col === "sku") return { sku: dir };
	return { createdAt: dir };
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getMessages();
	return { title: t.items.metaTitle };
}

export default async function ItemsPage({
	searchParams,
}: {
	searchParams?: SearchParams;
}) {
	const { membership, session } = await requireActiveMembership();
	const t = await getMessages();
	const region = await getRegion();

	const params = (await searchParams) ?? {};
	const statusFilter = parseStatusFilter(params.status);
	const searchQuery = (params.q ?? "").trim();
	const { col: sortCol, dir: sortDir } = parseSortParams(
		params.sort,
		params.dir,
	);
	const cursor = params.cursor; // undefined = first page

	// P10.1 — capability flags for conditional UI rendering
	const canCreate = hasCapability(membership.role, "items.create");
	const canEdit = hasCapability(membership.role, "items.edit");
	const canDelete = hasCapability(membership.role, "items.delete");
	const canImport = hasCapability(membership.role, "items.import");
	const canExport = hasCapability(membership.role, "reports.export");

	// Phase 13.3 — plan-aware item limit for upgrade UX
	const orgPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
	const itemLimit = getPlanLimit(orgPlan, "items");
	const canExportByPlan = hasPlanCapability(orgPlan, "exports");

	// Phase 3 — two fetch modes:
	//   Search mode (q present): fetch up to SEARCH_LIMIT, filter client-side.
	//   Browse mode (no q):      cursor-based pages of PAGE_SIZE.
	const baseWhere = {
		organizationId: membership.organizationId,
		...(statusFilter === "all" ? {} : { status: statusFilter }),
	};
	const orderBy = buildOrderBy(sortCol, sortDir);

	const isSearchMode = searchQuery.length > 0;

	const items = await db.item.findMany({
		where: baseWhere,
		include: {
			category: { select: { id: true, name: true } },
			stockLevels: { select: { quantity: true } },
			// P8.4 — needed for low-stock → PO shortcut (indexed column, negligible cost)
			preferredSupplier: { select: { id: true, name: true } },
		},
		orderBy,
		take: isSearchMode ? SEARCH_LIMIT : PAGE_SIZE + 1,
		...(!isSearchMode && cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
	});

	// Phase 3 — determine if there's a next page (browse mode only).
	const hasNextPage = !isSearchMode && items.length > PAGE_SIZE;
	const pageItems = hasNextPage ? items.slice(0, PAGE_SIZE) : items;
	const nextCursor = hasNextPage ? pageItems[pageItems.length - 1]?.id : null;

	// Phase 2 — client-side text filter (search mode only, PAGE_SIZE or fewer rows).
	const q = searchQuery.toLowerCase();
	const displayedItems = isSearchMode
		? pageItems.filter(
				(item) =>
					item.name.toLowerCase().includes(q) ||
					item.sku.toLowerCase().includes(q) ||
					(item.barcode ?? "").toLowerCase().includes(q),
			)
		: pageItems;

	// ── P3.3 / P3.4 + P7 — setup progress & operational trust queries ───
	// Lightweight counts to drive the stateful setup checklist, forward
	// guidance banners, and P7 operational trust cues. Parallel batch.
	const [
		warehouseCount,
		completedCountCount,
		reorderConfiguredCount,
		lastCount,
		lastMovement,
	] = await Promise.all([
		db.warehouse.count({
			where: { organizationId: membership.organizationId, isArchived: false },
		}),
		db.stockCount.count({
			where: { organizationId: membership.organizationId, state: "COMPLETED" },
		}),
		// P7.1 — how many items already have a reorder point?
		// reorderPoint is Int @default(0), NOT nullable — so we check > 0
		db.item.count({
			where: {
				organizationId: membership.organizationId,
				reorderPoint: { gt: 0 },
			},
		}),
		// P7.7 — most recent completed stock count
		db.stockCount.findFirst({
			where: { organizationId: membership.organizationId, state: "COMPLETED" },
			orderBy: { updatedAt: "desc" },
			select: { id: true, name: true, updatedAt: true },
		}),
		// P7.7 — most recent stock movement
		db.stockMovement.findFirst({
			where: { organizationId: membership.organizationId },
			orderBy: { createdAt: "desc" },
			select: { id: true, createdAt: true },
		}),
	]);

	const hasItems = items.length > 0;
	const hasLocation = warehouseCount > 0;
	const hasCompletedCount = completedCountCount > 0;
	const setupComplete = hasItems && hasLocation && hasCompletedCount;

	// Offline cache must reflect the default, unfiltered inventory list so
	// switching to /items?status=archived doesn't silently shrink the
	// snapshot stored in IndexedDB. When no filter is active we reuse the
	// already-fetched rows; otherwise we run a second query with the same
	// shape and limits as the prior pre-filter snapshot behavior. See the
	// cache-contract comment in `src/components/offline/items-cache-sync.tsx`
	// — `cacheItems` is the unfiltered snapshot and is decoupled from the
	// rendered `items` variable on purpose.
	// IMPORTANT: Must be declared before `totalItems` which depends on it.
	// Phase 3 — cacheItems: only sync on first page, unfiltered.
	// On page 2+ we don't overwrite the IndexedDB cache (partial pages
	// would evict previously cached items). In search mode we also skip
	// the cache update because displayedItems is a subset of the inventory.
	const isFirstPage = !cursor;
	const cacheItems =
		isFirstPage && !isSearchMode
			? statusFilter === "all"
				? pageItems
				: await db.item.findMany({
						where: { organizationId: membership.organizationId },
						include: {
							category: { select: { id: true, name: true } },
							stockLevels: { select: { quantity: true } },
							preferredSupplier: { select: { id: true, name: true } },
						},
						orderBy: { createdAt: "desc" },
						take: PAGE_SIZE,
					})
			: []; // empty → ItemsCacheSync skips the write

	// Phase 3 — totalItems: use a real count instead of cacheItems.length
	// so the trust micro-stat and reorder copy are accurate across all pages.
	const totalItems = await db.item.count({
		where: { organizationId: membership.organizationId },
	});
	// Phase 16.6 — disable "New item" button when at plan limit.
	const atItemLimit = itemLimit !== UNLIMITED && totalItems >= itemLimit;

	// ── P8.1 — Low-stock detection (zero extra queries) ───────────────
	// Reuses the already-fetched `items` array. Same filter logic as
	// src/app/(app)/reports/low-stock/page.tsx lines 92-99.
	const lowStockItems = setupComplete
		? items.filter((item) => {
				if (item.reorderPoint <= 0) return false;
				const onHand = item.stockLevels.reduce((sum, l) => sum + l.quantity, 0);
				return onHand <= item.reorderPoint;
			})
		: [];
	const lowStockCount = lowStockItems.length;

	// ── P8.4 — Identify single dominant supplier for direct PO shortcut ─
	const lowStockSupplierIds = new Set(
		lowStockItems.map((item) => item.preferredSupplier?.id).filter(Boolean),
	);
	const singleSupplier =
		lowStockSupplierIds.size === 1
			? (lowStockItems.find((item) => item.preferredSupplier)
					?.preferredSupplier ?? null)
			: null;
	const directPoHref = singleSupplier
		? `/purchase-orders/new?supplier=${singleSupplier.id}&items=${lowStockItems.map((i) => i.id).join(",")}`
		: null;
	// ── P8.1 + P8.4 end ──────────────────────────────────────────────

	// ── P7.1 — Context-aware reorder card ──────────────────────────────
	const reorderCard = (() => {
		if (reorderConfiguredCount === 0) {
			// P8.3 — link to batch editor instead of single-item edit
			return {
				icon: AlertTriangle,
				title: t.setup.bridgeReorderTitle,
				body: t.setup.bridgeReorderBodyNone,
				cta: t.setup.bridgeReorderCtaBatch,
				href: "/items/reorder-config",
			};
		}
		if (reorderConfiguredCount < totalItems) {
			// P8.3 — link to batch editor to finish remaining items
			const remaining = totalItems - reorderConfiguredCount;
			return {
				icon: AlertTriangle,
				title: t.setup.bridgeReorderTitlePartial,
				body: t.setup.bridgeReorderBodyPartial
					.replace("{remaining}", String(remaining))
					.replace("{total}", String(totalItems)),
				cta: t.setup.bridgeReorderCtaFinish,
				href: "/items/reorder-config",
			};
		}
		// All items configured — link to low-stock report
		return {
			icon: AlertTriangle,
			title: t.setup.bridgeReorderTitleDone,
			body: t.setup.bridgeReorderBodyDone,
			cta: t.setup.bridgeReorderCtaReport,
			href: "/reports/low-stock",
		};
	})();
	// ── P7.1 end ──────────────────────────────────────────────────────

	// ── P7.2 — Adaptive bridge stage ───────────────────────────────────
	// Parse the per-member uiState to determine bridge visibility.
	// Stage: "full" (first 3 visits) → "compact" (visits 3+) → "gone" (dismissed)
	type BridgeStage = "full" | "compact" | "gone";
	const uiState = (membership.uiState as Record<string, unknown> | null) ?? {};
	const bridgeVisits =
		typeof uiState.bridgeVisits === "number" ? uiState.bridgeVisits : 0;
	const bridgeDismissed = uiState.bridgeDismissed === true;
	const successSeen = uiState.successSeen === true;
	const bridgeStage: BridgeStage = bridgeDismissed
		? "gone"
		: bridgeVisits >= 3
			? "compact"
			: "full";

	// Fire-and-forget: increment visit count when bridge is visible
	if (setupComplete && bridgeStage !== "gone") {
		void db.membership
			.update({
				where: { id: membership.id },
				data: {
					uiState: { ...uiState, bridgeVisits: bridgeVisits + 1 },
				},
			})
			.catch(() => {});
	}
	// ── P7.2 end ──────────────────────────────────────────────────────

	// ── P8.5b — Mark success banner as seen (fire-and-forget) ─────────
	// The success banner shows when completedCountCount === 1. Without
	// this flag, it re-renders on every visit during that window.
	const showSuccessBanner =
		setupComplete && completedCountCount === 1 && !successSeen;
	if (showSuccessBanner) {
		void db.membership
			.update({
				where: { id: membership.id },
				data: {
					uiState: { ...uiState, successSeen: true },
				},
			})
			.catch(() => {});
	}
	// ── P8.5b end ─────────────────────────────────────────────────────

	// Build the serializable snapshot the client passes to IndexedDB.
	// We compute onHand once here (server-side) so the cache rendered
	// offline matches what the user just saw.
	const cacheScope = {
		orgId: membership.organizationId,
		userId: session.user.id,
	};
	const cacheRows: ItemSnapshotRow[] = cacheItems.map((item) => ({
		id: item.id,
		sku: item.sku,
		barcode: item.barcode,
		name: item.name,
		unit: item.unit,
		status: item.status,
		categoryId: item.category?.id ?? null,
		categoryName: item.category?.name ?? null,
		salePrice: item.salePrice ? item.salePrice.toString() : null,
		currency: item.currency,
		onHand: item.stockLevels.reduce((sum, level) => sum + level.quantity, 0),
	}));

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold">{t.items.heading}</h1>
					<p className="text-muted-foreground">{t.items.subtitle}</p>
					<ItemsCacheBanner
						scope={cacheScope}
						locale={region.numberLocale}
						labels={{
							onlineFresh: t.offline.cacheStatus.onlineFresh,
							onlineStale: t.offline.cacheStatus.onlineStale,
							offlineCached: t.offline.cacheStatus.offlineCached,
							offlineEmpty: t.offline.cacheStatus.offlineEmpty,
							neverSynced: t.offline.cacheStatus.neverSynced,
						}}
					/>
				</div>
				<div className="flex items-center gap-2">
					{/* Phase 9.1 — gate export/import by both role AND plan.
						FREE plan users can't export; only PRO+ can use these features.
						Role check (canExport/canImport) is also required. */}
					{canExport && canExportByPlan ? (
						<Button asChild variant="outline">
							<Link href="/items/export">
								<Download className="h-4 w-4" />
								{t.common.exportCsv}
							</Link>
						</Button>
					) : null}
					{canImport && canExportByPlan ? (
						<Button asChild variant="outline">
							<Link href="/items/import">
								<FileUp className="h-4 w-4" />
								{t.items.importCta}
							</Link>
						</Button>
					) : null}
					{canCreate && !atItemLimit ? (
						<Button asChild>
							<Link href="/items/new">
								<Plus className="h-4 w-4" />
								{t.items.newItem}
							</Link>
						</Button>
					) : canCreate && atItemLimit ? (
						<Button
							disabled
							title={`Item limit reached (${itemLimit}). Upgrade to Pro for unlimited items.`}
						>
							<Plus className="h-4 w-4" />
							{t.items.newItem}
						</Button>
					) : null}
				</div>
			</div>

			{/* Phase 2 — search + status filter row */}
			<div className="flex flex-wrap items-center gap-2">
				{/* Text search */}
				<form method="GET" className="flex items-center">
					<div className="relative">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
						<Input
							name="q"
							placeholder="Search items..."
							defaultValue={searchQuery}
							className="h-9 w-44 pl-8 text-sm md:w-56"
						/>
					</div>
					{/* Preserve status and sort params across search submissions */}
					{statusFilter !== "all" && (
						<input type="hidden" name="status" value={params.status} />
					)}
					{params.sort && (
						<input type="hidden" name="sort" value={params.sort} />
					)}
					{params.dir && <input type="hidden" name="dir" value={params.dir} />}
				</form>

				<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{t.items.filter.label}:
				</span>
				{(
					[
						{ key: "all", label: t.items.filter.all, status: undefined },
						{ key: "ACTIVE", label: t.items.filter.active, status: "active" },
						{
							key: "ARCHIVED",
							label: t.items.filter.archived,
							status: "archived",
						},
						{ key: "DRAFT", label: t.items.filter.draft, status: "draft" },
					] as const
				).map((opt) => {
					// Build href preserving q + sort params
					const sp = new URLSearchParams();
					if (opt.status) sp.set("status", opt.status);
					if (searchQuery) sp.set("q", searchQuery);
					if (params.sort) sp.set("sort", params.sort);
					if (params.dir) sp.set("dir", params.dir);
					const href = `/items${sp.toString() ? `?${sp.toString()}` : ""}`;
					return (
						<Button
							key={opt.key}
							size="sm"
							variant={statusFilter === opt.key ? "default" : "outline"}
							asChild
						>
							<Link href={href}>{opt.label}</Link>
						</Button>
					);
				})}

				{/* Active search/filter indicator with clear-all */}
				{searchQuery ? (
					<span className="text-xs text-muted-foreground">
						{displayedItems.length} result
						{displayedItems.length !== 1 ? "s" : ""} for &ldquo;
						{searchQuery}&rdquo;
						{" · "}
						<Link href="/items" className="underline hover:text-foreground">
							Clear
						</Link>
					</span>
				) : null}
				{/* Phase 9.7 — sort buttons restore the sort UI removed in Phase 4.3 */}
				<div className="ml-auto flex items-center gap-1">
					<span className="text-xs text-muted-foreground">Sort:</span>
					{(
						[
							{ col: "date" as const, label: "Newest" },
							{ col: "name" as const, label: "Name" },
							{ col: "sku" as const, label: "SKU" },
						] as const
					).map(({ col, label }) => {
						const isActive = sortCol === col;
						const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";
						const sp = new URLSearchParams();
						sp.set("sort", col);
						sp.set("dir", nextDir);
						if (statusFilter !== "all") sp.set("status", params.status ?? "");
						if (searchQuery) sp.set("q", searchQuery);
						return (
							<Link
								key={col}
								href={`/items?${sp.toString()}`}
								aria-label={`Sort by ${label} ${isActive ? (sortDir === "asc" ? "descending" : "ascending") : "ascending"}`}
								className={`rounded px-2 py-1 text-xs transition-colors ${
									isActive
										? "bg-primary/10 font-medium text-primary"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								{label}
								{isActive ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
							</Link>
						);
					})}
				</div>

				{/* Phase 11.7 — show item count summary when in browse mode */}
				{!isSearchMode && totalItems > 0 ? (
					<span className="text-xs text-muted-foreground">
						{displayedItems.length < totalItems
							? `Showing ${displayedItems.length} of ${totalItems.toLocaleString()} items`
							: `${totalItems.toLocaleString()} item${totalItems !== 1 ? "s" : ""}`}
					</span>
				) : null}

				{/* Phase 8.7 — show "Clear all filters" when multiple filter dimensions are active */}
				{!searchQuery && statusFilter !== "all" && params.sort ? (
					<Link
						href="/items"
						className="text-xs text-muted-foreground underline hover:text-foreground"
					>
						Clear all filters
					</Link>
				) : null}
			</div>

			{/* ── P7.7: Trust micro-stat line (only when setup is complete) ── */}
			{setupComplete ? (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
					<span>
						{t.setup.trustSummary
							.replace("{items}", String(totalItems))
							.replace("{locations}", String(warehouseCount))}
					</span>
					{lastCount ? (
						<span>
							{t.setup.trustLastCountLabel}{" "}
							<span className="tabular-nums">
								{formatRelative(
									lastCount.updatedAt,
									undefined,
									region.numberLocale,
								)}
							</span>
						</span>
					) : null}
					{lastMovement ? (
						<span>
							{t.setup.trustLastMovementLabel}{" "}
							<span className="tabular-nums">
								{formatRelative(
									lastMovement.createdAt,
									undefined,
									region.numberLocale,
								)}
							</span>
						</span>
					) : null}
				</div>
			) : null}

			{/* ── P8.1: Low-stock alert banner ─────────────────────────────── */}
			{setupComplete && lowStockCount > 0 ? (
				<Alert className="border-amber-500/40 bg-amber-500/10">
					<AlertTriangle className="h-4 w-4 text-amber-600" />
					<AlertTitle className="text-sm">
						{t.setup.lowStockBannerTitle.replace(
							"{count}",
							String(lowStockCount),
						)}
					</AlertTitle>
					<AlertDescription className="flex flex-wrap items-center gap-2 text-xs">
						<Button
							variant="link"
							size="sm"
							className="h-auto p-0 text-xs"
							asChild
						>
							<Link href="/reports/low-stock">
								{t.setup.lowStockBannerCta}
								<ArrowRight className="ml-1 h-3 w-3" />
							</Link>
						</Button>
						{directPoHref && singleSupplier ? (
							<>
								<span className="text-muted-foreground">·</span>
								<Button
									variant="link"
									size="sm"
									className="h-auto p-0 text-xs"
									asChild
								>
									<Link href={directPoHref}>
										{t.setup.lowStockBannerCtaDirect.replace(
											"{supplier}",
											singleSupplier.name,
										)}
										<ArrowRight className="ml-1 h-3 w-3" />
									</Link>
								</Button>
							</>
						) : null}
					</AlertDescription>
				</Alert>
			) : null}

			{/* ── Phase 13.3: Plan limit banner ────────────────────────────────── */}
			{itemLimit !== UNLIMITED && totalItems >= itemLimit * 0.8 ? (
				<UpgradePrompt
					reason={
						totalItems >= itemLimit
							? `You've reached the ${itemLimit}-item limit on the Free plan.`
							: `You're approaching the ${itemLimit}-item limit (${totalItems}/${itemLimit} used).`
					}
					requiredPlan="PRO"
					variant="banner"
				/>
			) : null}

			{/* ── CASE A: No items (true empty vs filtered/searched empty) ───────── */}
			{displayedItems.length === 0 ? (
				// A1: Search or filter active but returned nothing
				statusFilter !== "all" || searchQuery ? (
					<EmptyState
						icon={Package}
						title={
							searchQuery
								? `No items match "${searchQuery}"`
								: t.items.emptyFilteredTitle
						}
						description={
							searchQuery
								? "Try a different search term or clear the filter."
								: t.items.emptyFilteredBody
						}
						variant="filtered"
						actions={[
							{
								label: t.items.emptyFilteredCta,
								href: "/items",
								variant: "secondary",
							},
						]}
					/>
				) : (
					// A2: Truly no items yet
					<EmptyState
						icon={Package}
						title={t.items.emptyTitle}
						description={t.items.emptyBody}
						actions={[
							...(canCreate
								? [{ label: t.items.emptyCta, href: "/items/new", icon: Plus }]
								: []),
							// Phase 9.1 — import also requires plan capability
							...(canImport && canExportByPlan
								? [
										{
											label: t.items.emptyImportCta,
											href: "/items/import",
											icon: FileUp,
											variant: "secondary" as const,
										},
									]
								: []),
						]}
					/>
				)
			) : (
				<>
					{/* ── CASE B: Items exist, setup incomplete — banner ───────────── */}
					{!setupComplete ? (
						<Alert>
							<Info className="h-4 w-4" />
							<AlertTitle>
								{!hasLocation
									? t.setup.bannerAddLocation
									: t.setup.bannerReadyToCount}
							</AlertTitle>
							<AlertDescription>
								<Button variant="link" className="h-auto p-0" asChild>
									<Link
										href={
											!hasLocation ? "/warehouses/new" : "/stock-counts/new"
										}
									>
										{!hasLocation
											? t.setup.bannerAddLocationCta
											: t.setup.bannerReadyToCountCta}
										<ArrowRight className="ml-1 inline h-3 w-3" />
									</Link>
								</Button>
							</AlertDescription>
						</Alert>
					) : null}

					{/* ── P7.4 + P8.5b: Success moment — shown once, then flagged ── */}
					{showSuccessBanner ? (
						<Alert className="border-emerald-500/40 bg-emerald-500/10">
							<CheckCircle2 className="h-4 w-4 text-emerald-600" />
							<AlertTitle>{t.setup.complete}</AlertTitle>
							<AlertDescription className="text-sm text-muted-foreground">
								{t.setup.completeBody}
							</AlertDescription>
						</Alert>
					) : null}

					{/* ── CASE C: Setup complete — post-setup operational bridge ──── */}
					{/* P7.2: bridge renders as full → compact → gone based on bridgeStage */}
					{setupComplete && bridgeStage === "full" ? (
						<div className="space-y-3">
							<div className="space-y-1">
								<h2 className="text-lg font-semibold">
									{t.setup.bridgeHeading}
								</h2>
								<p className="text-sm text-muted-foreground">
									{t.setup.bridgeSubtitle}
								</p>
							</div>
							{/* Desktop: full cards — hidden on mobile */}
							<div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
								{[
									reorderCard,
									{
										icon: ArrowLeftRight,
										title: t.setup.bridgeMovementTitle,
										body: t.setup.bridgeMovementBody,
										cta: t.setup.bridgeMovementCta,
										href: "/movements",
									},
									{
										icon: BarChart3,
										title: t.setup.bridgeReportsTitle,
										body: t.setup.bridgeReportsBody,
										cta: t.setup.bridgeReportsCta,
										href: "/reports",
									},
									{
										icon: Users,
										title: t.setup.bridgeTeamTitle,
										body: t.setup.bridgeTeamBody,
										cta: t.setup.bridgeTeamCta,
										href: "/users",
									},
								].map((card) => (
									<Card key={card.href} className="flex flex-col">
										<CardHeader className="flex-1 space-y-1.5 pb-3">
											<card.icon className="h-5 w-5 text-muted-foreground" />
											<CardTitle className="text-sm font-medium">
												{card.title}
											</CardTitle>
											<CardDescription className="text-xs">
												{card.body}
											</CardDescription>
										</CardHeader>
										<CardContent className="pt-0">
											<Button
												variant="outline"
												size="sm"
												className="w-full"
												asChild
											>
												<Link href={card.href}>
													{card.cta}
													<ArrowRight className="ml-1 h-3 w-3" />
												</Link>
											</Button>
										</CardContent>
									</Card>
								))}
							</div>
							{/* Mobile: compact 2×2 grid — visible only below sm */}
							<div className="grid grid-cols-2 gap-2 sm:hidden">
								{[
									reorderCard,
									{
										icon: ArrowLeftRight,
										title: t.setup.bridgeMovementTitle,
										cta: t.setup.bridgeMovementCta,
										href: "/movements",
									},
									{
										icon: BarChart3,
										title: t.setup.bridgeReportsTitle,
										cta: t.setup.bridgeReportsCta,
										href: "/reports",
									},
									{
										icon: Users,
										title: t.setup.bridgeTeamTitle,
										cta: t.setup.bridgeTeamCta,
										href: "/users",
									},
								].map((card) => (
									<Link
										key={card.href}
										href={card.href}
										className="flex flex-col items-center gap-1 rounded-md border p-3 text-center text-xs transition-colors hover:bg-accent/50"
									>
										<card.icon className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium leading-tight">
											{card.title}
										</span>
									</Link>
								))}
							</div>
						</div>
					) : null}

					{/* P7.2: Compact bridge — single row with quick-links + dismiss */}
					{setupComplete && bridgeStage === "compact" ? (
						<CompactBridge
							links={[
								{ title: reorderCard.cta, href: reorderCard.href },
								{ title: t.setup.bridgeMovementCta, href: "/movements" },
								{ title: t.setup.bridgeReportsCta, href: "/reports" },
								{ title: t.setup.bridgeTeamCta, href: "/users" },
							]}
							labels={{
								label: t.setup.bridgeCompactLabel,
								dismissLabel: t.setup.bridgeDismissLabel,
							}}
							dismissAction={dismissBridgeAction}
						/>
					) : null}

					{/* ── Items table — Phase 4.3: client component with bulk selection ── */}
					<Card>
						<CardContent className="p-0">
							<ItemsTable
								items={displayedItems.map(
									(item) =>
										({
											id: item.id,
											sku: item.sku,
											name: item.name,
											barcode: item.barcode ?? null,
											categoryName: item.category?.name ?? null,
											status: item.status as "ACTIVE" | "ARCHIVED" | "DRAFT",
											onHand: item.stockLevels.reduce(
												(sum, l) => sum + l.quantity,
												0,
											),
											unit: item.unit,
											salePrice: item.salePrice?.toString() ?? null,
											currency: item.currency,
										}) satisfies ItemRow,
								)}
								canEdit={canEdit}
								canDelete={canDelete}
								labels={{
									columnSku: t.items.columnSku,
									columnName: t.items.columnName,
									columnCategory: t.items.columnCategory,
									columnStock: t.items.columnStock,
									columnStatus: t.items.columnStatus,
									columnActions: t.items.columnActions,
									none: t.common.none,
									active: t.common.active,
									archived: t.common.archived,
									draft: t.common.draft,
									edit: t.common.edit,
									search: t.common.search,
								}}
								deleteButton={(itemId) => (
									<DeleteButton
										labels={{
											trigger: t.common.delete,
											title: t.items.deleteConfirmTitle,
											body: t.items.deleteConfirmBody,
											cancel: t.common.cancel,
											confirm: t.common.delete,
										}}
										action={deleteItemAction.bind(null, itemId)}
										iconOnly
									/>
								)}
							/>
						</CardContent>
					</Card>

					{/* ── Phase 3: Pagination load-more ─────────────────────────── */}
					{nextCursor ? (
						<div className="flex items-center justify-between border-t pt-4 text-sm">
							<span className="text-muted-foreground">
								Showing {displayedItems.length} of {totalItems} items
							</span>
							{(() => {
								const sp = new URLSearchParams();
								sp.set("cursor", nextCursor);
								if (statusFilter !== "all")
									sp.set("status", params.status ?? "");
								if (params.sort) sp.set("sort", params.sort);
								if (params.dir) sp.set("dir", params.dir);
								return (
									<Link
										href={`/items?${sp.toString()}`}
										className="font-medium text-primary hover:underline"
									>
										Load more &rarr;
									</Link>
								);
							})()}
						</div>
					) : !isSearchMode && totalItems > PAGE_SIZE ? (
						<p className="pt-2 text-center text-xs text-muted-foreground">
							All {totalItems} items loaded.
						</p>
					) : null}

					{/* ── P7.7: Activity footer — recent count + movement links ──── */}
					{setupComplete && (lastCount || lastMovement) ? (
						<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
							{lastCount ? (
								<Link
									href={`/stock-counts/${lastCount.id}`}
									className="hover:underline"
								>
									{t.setup.trustLastCountLabel}{" "}
									{lastCount.name ?? t.common.unknown}{" "}
									<span className="tabular-nums">
										(
										{formatRelative(
											lastCount.updatedAt,
											undefined,
											region.numberLocale,
										)}
										)
									</span>
								</Link>
							) : null}
							{lastMovement ? (
								<Link href="/movements" className="hover:underline">
									{t.setup.trustLastMovementLabel}{" "}
									<span className="tabular-nums">
										{formatRelative(
											lastMovement.createdAt,
											undefined,
											region.numberLocale,
										)}
									</span>
								</Link>
							) : null}
						</div>
					) : null}
				</>
			)}

			{/* ── P5.2: Persistent setup checklist (visible until setupComplete) ── */}
			{!setupComplete ? (
				<div className="mx-auto max-w-md space-y-3">
					<p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
						{t.setup.heading}
					</p>
					{[
						{
							done: hasItems,
							label: t.setup.step1,
							doneLabel: t.setup.step1Done,
							href: "/items/new",
							sublabel: undefined as string | undefined,
							sublabelHref: "/items/import" as string | undefined,
							sublabelText: t.setup.step1Import,
						},
						{
							done: hasLocation,
							label: t.setup.step2,
							doneLabel: t.setup.step2Done,
							href: "/warehouses",
							sublabel: hasLocation ? t.setup.step2Auto : undefined,
							sublabelHref: undefined as string | undefined,
							sublabelText: undefined as string | undefined,
						},
						{
							done: hasCompletedCount,
							label: t.setup.step3,
							doneLabel: t.setup.step3Done,
							href: "/stock-counts/new",
							sublabel: undefined as string | undefined,
							sublabelHref: undefined as string | undefined,
							sublabelText: undefined as string | undefined,
						},
					].map((step) => (
						<div
							key={step.href}
							className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent/50"
						>
							{step.done ? (
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
									<Check className="h-3.5 w-3.5" />
								</span>
							) : (
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40">
									<Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
								</span>
							)}
							{/* P8.5c — merged label + arrow into one link to reduce tab stops */}
							<Link
								href={step.href}
								className={`flex flex-1 items-center justify-between ${step.done ? "text-muted-foreground line-through" : "hover:underline"}`}
							>
								<span>
									{step.done ? step.doneLabel : step.label}
									{step.sublabel ? (
										<span className="block text-xs text-muted-foreground font-normal no-underline">
											{step.sublabel}
										</span>
									) : null}
								</span>
								{!step.done ? (
									<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
								) : null}
							</Link>
							{!step.done && step.sublabelHref ? (
								<Link
									href={step.sublabelHref}
									className="block text-xs text-muted-foreground hover:underline -mt-1"
								>
									{step.sublabelText}
								</Link>
							) : null}
						</div>
					))}
				</div>
			) : null}

			<ItemsCacheSync scope={cacheScope} rows={cacheRows} />
		</div>
	);
}
