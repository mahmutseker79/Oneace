import {
	ArrowLeft,
	Grid3X3,
	Pencil,
	Warehouse as WarehouseIcon,
	Barcode,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

type MovementType =
	| "RECEIPT"
	| "ISSUE"
	| "ADJUSTMENT"
	| "TRANSFER"
	| "BIN_TRANSFER"
	| "COUNT";

type PageProps = {
	params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
	const t = await getMessages();
	return { title: t.warehouses.detail.metaTitle };
}

export default async function WarehouseDetailPage({ params }: PageProps) {
	const { id } = await params;
	const { membership } = await requireActiveMembership();
	// Phase 9.4 — role gate for edit button.
	const canEditWarehouse = hasCapability(membership.role, "warehouses.edit");
	const t = await getMessages();
	const region = await getRegion();

	const warehouse = await db.warehouse.findFirst({
		where: { id, organizationId: membership.organizationId },
	});

	if (!warehouse) {
		notFound();
	}

	// Two independent queries — stock levels (with item names) and
	// recent movements. Separate queries keep the plan predictable and
	// let us cap row count per section.
	const [stockLevels, movements] = await Promise.all([
		db.stockLevel.findMany({
			where: { warehouseId: id, organizationId: membership.organizationId },
			include: {
				item: { select: { id: true, sku: true, name: true, unit: true } },
				bin: { select: { id: true, code: true, label: true } },
			},
			orderBy: { item: { name: "asc" } },
			take: 200,
		}),
		db.stockMovement.findMany({
			where: {
				organizationId: membership.organizationId,
				OR: [{ warehouseId: id }, { toWarehouseId: id }],
			},
			include: {
				item: { select: { id: true, sku: true, name: true, unit: true } },
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		}),
	]);

	const hasBins = stockLevels.some((lvl) => lvl.bin != null);

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
		return <Badge variant="outline">{label}</Badge>;
	}

	return (
		<div className="space-y-6">
			{/* God-Mode Design: Breadcrumb + back button via PageHeader */}
			<PageHeader
				title={warehouse.name}
				description={warehouse.code}
				backHref="/warehouses"
				badge={
					<>
						{warehouse.isDefault ? (
							<Badge variant="outline">
								{t.warehouses.detail.defaultBadge}
							</Badge>
						) : null}
						{warehouse.isArchived ? (
							<Badge variant="secondary">
								{t.warehouses.detail.archivedBadge}
							</Badge>
						) : null}
					</>
				}
				breadcrumb={[
					{ label: t.nav?.warehouses ?? "Warehouses", href: "/warehouses" },
					{ label: warehouse.name },
				]}
			/>

			<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="sm">
						<Link href={`/warehouses/${warehouse.id}/bins`}>
							<Grid3X3 className="h-4 w-4" />
							{t.bins.heading}
						</Link>
					</Button>
					{canEditWarehouse ? (
						<Button asChild variant="outline" size="sm">
							<Link href={`/warehouses/${warehouse.id}/edit`}>
								<Pencil className="h-4 w-4" />
								{t.warehouses.detail.edit}
							</Link>
						</Button>
					) : null}
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						{t.warehouses.detail.metaHeading}
					</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 text-sm md:grid-cols-2">
					<div className="flex justify-between">
						<span className="text-muted-foreground">
							{t.warehouses.detail.metaCode}
						</span>
						<span className="font-mono">{warehouse.code}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">
							{t.warehouses.detail.metaAddress}
						</span>
						<span className="max-w-[70%] text-right">
							{warehouse.address ?? "—"}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">
							{t.warehouses.detail.metaCity}
						</span>
						<span>{warehouse.city ?? "—"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">
							{t.warehouses.detail.metaRegion}
						</span>
						<span>{warehouse.region ?? "—"}</span>
					</div>
					<div className="flex justify-between md:col-span-2">
						<span className="text-muted-foreground">
							{t.warehouses.detail.metaCountry}
						</span>
						<span>{warehouse.country ?? "—"}</span>
					</div>
					<div className="flex justify-between md:col-span-2">
						<span className="text-muted-foreground">
							{"Code"}
						</span>
						<div className="flex items-center gap-2">
							<span className="font-mono text-xs">
								{warehouse.barcodeValue ?? "—"}
							</span>
							{canEditWarehouse ? (
								<Button
									variant="ghost"
									size="sm"
									title="Assign code"
									disabled
								>
									<Barcode className="h-4 w-4" />
								</Button>
							) : null}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						{t.warehouses.detail.stockHeading}
					</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{stockLevels.length === 0 ? (
						<p className="px-6 pb-6 text-sm text-muted-foreground">
							{t.warehouses.detail.stockEmpty}
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t.warehouses.detail.stockColumnSku}</TableHead>
									<TableHead>{t.warehouses.detail.stockColumnItem}</TableHead>
									{hasBins ? <TableHead>{t.bins.heading}</TableHead> : null}
									<TableHead className="text-right">
										{t.warehouses.detail.stockColumnOnHand}
									</TableHead>
									<TableHead className="text-right">
										{t.warehouses.detail.stockColumnReserved}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{stockLevels.map((lvl) => (
									<TableRow key={lvl.id}>
										<TableCell className="font-mono text-xs">
											<Link
												href={`/items/${lvl.item.id}`}
												className="hover:underline"
											>
												{lvl.item.sku}
											</Link>
										</TableCell>
										<TableCell>
											<Link
												href={`/items/${lvl.item.id}`}
												className="hover:underline"
											>
												{lvl.item.name}
											</Link>
										</TableCell>
										{hasBins ? (
											<TableCell className="font-mono text-xs text-muted-foreground">
												{lvl.bin ? lvl.bin.code : "—"}
											</TableCell>
										) : null}
										<TableCell className="text-right tabular-nums">
											{lvl.quantity} {lvl.item.unit}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{lvl.reservedQty}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						{t.warehouses.detail.movementsHeading}
					</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{movements.length === 0 ? (
						<p className="px-6 pb-6 text-sm text-muted-foreground">
							{t.warehouses.detail.movementsEmpty}
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>
										{t.warehouses.detail.movementsColumnDate}
									</TableHead>
									<TableHead>
										{t.warehouses.detail.movementsColumnType}
									</TableHead>
									<TableHead>
										{t.warehouses.detail.movementsColumnItem}
									</TableHead>
									<TableHead className="text-right">
										{t.warehouses.detail.movementsColumnQty}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{movements.map((m) => {
									// For movements where this warehouse is the destination
									// of a transfer, flip the sign so it reads as an incoming
									// quantity rather than the source's outgoing.
									const isIncomingTransfer =
										m.type === "TRANSFER" && m.toWarehouseId === id;
									const signedQty = isIncomingTransfer
										? m.quantity
										: m.direction < 0
											? -m.quantity
											: m.quantity;
									const qtyPrefix =
										signedQty >= 0
											? t.movements.directionIn
											: t.movements.directionOut;
									const absQty = Math.abs(signedQty);
									return (
										<TableRow key={m.id}>
											<TableCell className="whitespace-nowrap text-xs text-muted-foreground">
												<Link
													href={`/movements/${m.id}`}
													className="hover:underline"
												>
													{dateFormatter.format(m.createdAt)}
												</Link>
											</TableCell>
											<TableCell>{typeBadge(m.type as MovementType)}</TableCell>
											<TableCell>
												<Link
													href={`/items/${m.item.id}`}
													className="hover:underline"
												>
													{m.item.name}
												</Link>
												<div className="font-mono text-xs text-muted-foreground">
													{m.item.sku}
												</div>
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
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
