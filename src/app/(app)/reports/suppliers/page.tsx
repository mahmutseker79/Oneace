import { ChevronLeft, Download, Truck, TruckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
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
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Supplier performance report — per-supplier roll-up of purchase order
 * activity with the five metrics finance and procurement teams actually
 * care about when they pick up the phone to call a supplier.
 *
 * Metrics computed per supplier (active only, archived suppliers excluded):
 *
 *   1. Total PO count (all statuses)
 *   2. Open POs         (SENT + PARTIALLY_RECEIVED — still outstanding)
 *   3. Received value   (sum of receivedQty × unitCost across ALL lines)
 *   4. On-time rate     (% of RECEIVED POs where receivedAt <= expectedAt)
 *   5. Avg lead time    (days from orderedAt to receivedAt, RECEIVED only)
 *
 * Why these five and not, say, "lowest unit cost": price is per-item,
 * per-line — it doesn't aggregate cleanly to a supplier-level metric
 * without weighting by volume, and the user can already see per-item
 * pricing on a PO. Performance is about *reliability* (did they deliver
 * what we asked, when we asked) and *throughput* (how much business are
 * we doing with them), which is exactly what these five capture.
 *
 * Scope boundaries:
 *
 *   - CANCELLED POs count toward "total" (you may still care that
 *     supplier X cancels a lot) but are excluded from lead time and
 *     on-time rate (they never shipped).
 *   - DRAFT POs count toward "total" but are excluded from "open"
 *     because you haven't actually committed to them.
 *   - Lead time uses calendar days (Math.round) — partial days are
 *     noise in the MVP. Finance cares about "6 vs 14 days", not "6.3".
 *   - `expectedAt` is optional on the PO model; POs without an expected
 *     date contribute to volume but not to on-time rate.
 *   - Currency totals use the region currency because POs are
 *     per-supplier but the roll-up is per-organization. Mixed-currency
 *     orgs see a lower-bound caveat in the UI.
 */

export async function generateMetadata(): Promise<Metadata> {
	const t = await getMessages();
	return {
		title: `${t.reports.supplierPerformance.metaTitle} — ${t.reports.metaTitle}`,
	};
}

type SupplierRow = {
	id: string;
	name: string;
	code: string | null;
	totalPos: number;
	openPos: number;
	receivedValue: number;
	onTimeEligible: number;
	onTimeCount: number;
	leadTimeSampleDays: number[];
	currencyMix: Set<string>;
};

function avg(xs: number[]): number | null {
	if (xs.length === 0) return null;
	const sum = xs.reduce((a, b) => a + b, 0);
	return sum / xs.length;
}

export default async function SupplierPerformancePage() {
	const { membership } = await requireActiveMembership();
	const t = await getMessages();
	const region = await getRegion();

	const suppliers = await db.supplier.findMany({
		where: { organizationId: membership.organizationId },
		select: {
			id: true,
			name: true,
			code: true,
			purchaseOrders: {
				select: {
					status: true,
					orderedAt: true,
					expectedAt: true,
					receivedAt: true,
					currency: true,
					lines: {
						select: {
							receivedQty: true,
							unitCost: true,
						},
					},
				},
			},
		},
		orderBy: { name: "asc" },
	});

	const rows: SupplierRow[] = suppliers.map((s) => {
		const row: SupplierRow = {
			id: s.id,
			name: s.name,
			code: s.code,
			totalPos: s.purchaseOrders.length,
			openPos: 0,
			receivedValue: 0,
			onTimeEligible: 0,
			onTimeCount: 0,
			leadTimeSampleDays: [],
			currencyMix: new Set(),
		};

		for (const po of s.purchaseOrders) {
			row.currencyMix.add(po.currency);

			if (po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") {
				row.openPos += 1;
			}

			// Received-value rolls up every line's shipped quantity × unit cost
			// regardless of PO status, so PARTIALLY_RECEIVED POs contribute
			// their shipped-so-far value.
			for (const line of po.lines) {
				const unit = Number(line.unitCost.toString());
				row.receivedValue += line.receivedQty * unit;
			}

			if (po.status === "RECEIVED" && po.receivedAt) {
				const orderedMs = po.orderedAt.getTime();
				const receivedMs = po.receivedAt.getTime();
				const leadDays = Math.round(
					(receivedMs - orderedMs) / (1000 * 60 * 60 * 24),
				);
				if (leadDays >= 0) {
					row.leadTimeSampleDays.push(leadDays);
				}

				if (po.expectedAt) {
					row.onTimeEligible += 1;
					if (receivedMs <= po.expectedAt.getTime()) {
						row.onTimeCount += 1;
					}
				}
			}
		}

		return row;
	});

	// Sort by received value descending: most-valuable suppliers first.
	rows.sort((a, b) => b.receivedValue - a.receivedValue);

	// Aggregate KPIs.
	const totalPos = rows.reduce((a, r) => a + r.totalPos, 0);
	const totalOpen = rows.reduce((a, r) => a + r.openPos, 0);
	const totalReceivedValue = rows.reduce((a, r) => a + r.receivedValue, 0);
	const suppliersWithActivity = rows.filter(
		(r) => r.totalPos > 0 || r.receivedValue > 0,
	).length;

	const hasMixedCurrency = rows.some((r) => r.currencyMix.size > 1);
	const hasNonRegionCurrency = rows.some((r) =>
		Array.from(r.currencyMix).some((c) => c !== region.currency),
	);
	const showCurrencyCaveat = hasMixedCurrency || hasNonRegionCurrency;

	const hasAnyData = rows.some((r) => r.totalPos > 0);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-start gap-3">
					<Truck className="text-muted-foreground mt-1 h-5 w-5" />
					<div>
						<h1 className="text-2xl font-semibold">
							{t.reports.supplierPerformance.heading}
						</h1>
						<p className="text-muted-foreground">
							{t.reports.supplierPerformance.subtitle}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button asChild variant="ghost">
						<Link href="/reports">
							<ChevronLeft className="h-4 w-4" />
							{t.reports.supplierPerformance.backToReports}
						</Link>
					</Button>
					<ExportButton href="/reports/suppliers/export">
						{t.common.exportCsv}
					</ExportButton>
				</div>
			</div>

			{!hasAnyData ? (
				<EmptyState
					icon={TruckIcon}
					title={t.reports.supplierPerformance.emptyTitle}
					description={t.reports.supplierPerformance.emptyBody}
				/>
			) : (
				<>
					<div className="grid gap-4 md:grid-cols-3">
						<Card>
							<CardHeader className="pb-2">
								<CardDescription>
									{t.reports.supplierPerformance.kpiTotalReceivedLabel}
								</CardDescription>
								<CardTitle className="text-2xl">
									{formatCurrency(totalReceivedValue, {
										currency: region.currency,
									})}
								</CardTitle>
							</CardHeader>
							<CardContent className="text-muted-foreground text-xs">
								{format(t.reports.supplierPerformance.kpiAcrossSuppliers, {
									count: String(suppliersWithActivity),
								})}
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardDescription>
									{t.reports.supplierPerformance.kpiTotalPosLabel}
								</CardDescription>
								<CardTitle className="text-2xl">
									{formatNumber(totalPos)}
								</CardTitle>
							</CardHeader>
							<CardContent className="text-muted-foreground text-xs">
								{format(t.reports.supplierPerformance.kpiOpenLine, {
									count: String(totalOpen),
								})}
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardDescription>
									{t.reports.supplierPerformance.kpiSuppliersLabel}
								</CardDescription>
								<CardTitle className="text-2xl">
									{formatNumber(rows.length)}
								</CardTitle>
							</CardHeader>
							<CardContent className="text-muted-foreground text-xs">
								{t.reports.supplierPerformance.kpiSuppliersBody}
							</CardContent>
						</Card>
					</div>

					{showCurrencyCaveat ? (
						<p className="text-muted-foreground text-xs italic">
							{format(t.reports.supplierPerformance.mixedCurrencyCaveat, {
								currency: region.currency,
							})}
						</p>
					) : null}

					<Card>
						<CardHeader>
							<CardTitle className="text-base">
								{t.reports.supplierPerformance.detailHeading}
							</CardTitle>
							<CardDescription>
								{t.reports.supplierPerformance.detailSubtitle}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>
											{t.reports.supplierPerformance.colSupplier}
										</TableHead>
										<TableHead className="text-right">
											{t.reports.supplierPerformance.colTotalPos}
										</TableHead>
										<TableHead className="text-right">
											{t.reports.supplierPerformance.colOpenPos}
										</TableHead>
										<TableHead className="text-right">
											{t.reports.supplierPerformance.colReceivedValue}
										</TableHead>
										<TableHead className="text-right">
											{t.reports.supplierPerformance.colOnTime}
										</TableHead>
										<TableHead className="text-right">
											{t.reports.supplierPerformance.colAvgLeadTime}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((r) => {
										const onTimeRate =
											r.onTimeEligible === 0
												? null
												: (r.onTimeCount / r.onTimeEligible) * 100;
										const avgLead = avg(r.leadTimeSampleDays);
										return (
											<TableRow key={r.id}>
												<TableCell>
													<div className="font-medium">
														<Link
															href={`/suppliers/${r.id}`}
															className="hover:underline"
														>
															{r.name}
														</Link>
													</div>
													{r.code ? (
														<div className="text-muted-foreground font-mono text-xs">
															{r.code}
														</div>
													) : null}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatNumber(r.totalPos)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatNumber(r.openPos)}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{formatCurrency(r.receivedValue, {
														currency: region.currency,
													})}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{onTimeRate == null
														? t.reports.supplierPerformance.notAvailable
														: `${onTimeRate.toFixed(0)}%`}
												</TableCell>
												<TableCell className="text-right tabular-nums">
													{avgLead == null
														? t.reports.supplierPerformance.notAvailable
														: format(t.reports.supplierPerformance.daysSuffix, {
																days: avgLead.toFixed(1),
															})}
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
