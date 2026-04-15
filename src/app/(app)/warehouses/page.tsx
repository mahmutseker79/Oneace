import { Package, Plus, Warehouse as WarehouseIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PicklistCacheSync } from "@/components/offline/picklist-cache-sync";
import { DeleteButton } from "@/components/shell/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileCard, ResponsiveTable } from "@/components/ui/responsive-table";
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
import { getMessages } from "@/lib/i18n";
import type { WarehouseSnapshotRow } from "@/lib/offline/warehouses-cache";
import { hasCapability } from "@/lib/permissions";
import { UNLIMITED, getPlanLimit } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

import { deleteWarehouseAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getMessages();
	return { title: t.warehouses.metaTitle };
}

function formatLocation(
	parts: Array<string | null | undefined>,
	fallback: string,
): string {
	const clean = parts.filter((part): part is string => !!part);
	return clean.length > 0 ? clean.join(", ") : fallback;
}

export default async function WarehousesPage() {
	const { membership, session } = await requireActiveMembership();
	const t = await getMessages();

	// P10.1 — capability flags for conditional UI rendering
	const canCreate = hasCapability(membership.role, "warehouses.create");

	// Phase 15.2 — plan-aware warehouse limit for upgrade UX
	const whPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
	const whLimit = getPlanLimit(whPlan, "warehouses");
	const canEdit = hasCapability(membership.role, "warehouses.edit");
	const canDelete = hasCapability(membership.role, "warehouses.delete");

	const warehouses = await db.warehouse.findMany({
		where: { organizationId: membership.organizationId },
		orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
	});

	// Build the serializable snapshot the picklist sync writes to
	// Dexie. Keeping this in the page itself (vs. inside a helper)
	// makes the dependency on Prisma's row shape explicit.
	const cacheScope = {
		orgId: membership.organizationId,
		userId: session.user.id,
	};
	const cacheRows: WarehouseSnapshotRow[] = warehouses.map((w) => ({
		id: w.id,
		name: w.name,
		code: w.code,
		city: w.city,
		region: w.region,
		country: w.country,
		isDefault: w.isDefault,
	}));

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t.warehouses.heading}</h1>
					<p className="text-sm text-muted-foreground">{t.warehouses.subtitle}</p>
				</div>
				{canCreate && whLimit === UNLIMITED ? (
					<Button asChild>
						<Link href="/warehouses/new">
							<Plus className="h-4 w-4" />
							{t.warehouses.newWarehouse}
						</Link>
					</Button>
				) : canCreate &&
					whLimit !== UNLIMITED &&
					warehouses.length < whLimit ? (
					<Button asChild>
						<Link href="/warehouses/new">
							<Plus className="h-4 w-4" />
							{t.warehouses.newWarehouse}
						</Link>
					</Button>
				) : null}
			</div>

			{/* Phase 15.2 — warehouse limit upgrade banner */}
			{whLimit !== UNLIMITED && warehouses.length >= whLimit ? (
				<UpgradePrompt
					reason={`Your current plan includes ${whLimit} warehouse location. Upgrade to Pro for unlimited locations.`}
					requiredPlan="PRO"
					variant="banner"
				/>
			) : null}

			{warehouses.length === 0 ? (
				<EmptyState
					icon={WarehouseIcon}
					title={t.warehouses.emptyTitle}
					description={t.warehouses.emptyBody}
					actions={[
						...(canCreate
							? [
									{
										label: t.warehouses.emptyCta,
										href: "/warehouses/new",
										icon: Plus,
									},
								]
							: []),
						{
							label: t.warehouses.emptyItemsCta,
							href: "/items",
							icon: Package,
							variant: "secondary" as const,
						},
					]}
					footer={t.warehouses.emptyHint}
				/>
			) : (
				<Card>
					<CardContent className="p-0">
						<ResponsiveTable
							cardView={
								<>
									{warehouses.map((w) => (
										<MobileCard
											key={w.id}
											href={`/warehouses/${w.id}`}
											title={w.name}
											subtitle={w.code}
											badge={w.isDefault ? <Badge variant="info">{t.common.yes}</Badge> : null}
											fields={[
												{
													label: "City",
													value: w.city || t.common.none,
												},
												{
													label: "Country",
													value: w.country || t.common.none,
												},
												{
													label: "Status",
													value: w.isDefault ? "Default" : "Secondary",
												},
											]}
										/>
									))}
								</>
							}
						>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t.warehouses.columnName}</TableHead>
										{/* Phase 5.3 — added tooltip explaining what Code is used for */}
										<TableHead title="Short identifier used in barcode labels, reports, and transfers">
											{t.warehouses.columnCode}
										</TableHead>
										<TableHead>{t.warehouses.columnLocation}</TableHead>
										{/* Default column: badge + explanation on hover */}
										<TableHead title="New movements and items default to this location">
											{t.warehouses.columnDefault}
										</TableHead>
										<TableHead className="w-36 text-right">
											{t.warehouses.columnActions}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{warehouses.map((w) => (
										<TableRow key={w.id} className="hover:bg-muted/50 transition-colors">
											<TableCell className="font-medium">{w.name}</TableCell>
											<TableCell className="font-mono text-xs">
												{w.code}
											</TableCell>
											<TableCell className="text-muted-foreground">
												{formatLocation(
													[w.city, w.region, w.country],
													t.common.none,
												)}
											</TableCell>
											<TableCell>
												{w.isDefault ? <Badge variant="info">{t.common.yes}</Badge> : null}
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
													{canEdit ? (
														<Button variant="ghost" size="sm" asChild>
															<Link href={`/warehouses/${w.id}/edit`}>
																{t.common.edit}
															</Link>
														</Button>
													) : null}
													{canDelete ? (
														<DeleteButton
															labels={{
																trigger: t.common.delete,
																title: t.warehouses.deleteConfirmTitle,
																body: t.warehouses.deleteConfirmBody,
																cancel: t.common.cancel,
																confirm: t.common.delete,
															}}
															action={deleteWarehouseAction.bind(null, w.id)}
															iconOnly
														/>
													) : null}
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</ResponsiveTable>
					</CardContent>
				</Card>
			)}

			<PicklistCacheSync
				table="warehouses"
				scope={cacheScope}
				rows={cacheRows}
			/>
		</div>
	);
}
