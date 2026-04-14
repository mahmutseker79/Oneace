import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import {
	MovementForm,
	type MovementFormLabels,
	type MovementFormOption,
} from "../movement-form";

type PageProps = {
	searchParams?: Promise<{ itemId?: string; warehouseId?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
	const t = await getMessages();
	return { title: t.movements.newMovementHeading };
}

export default async function NewMovementPage({ searchParams }: PageProps) {
	const { session, membership } = await requireActiveMembership();
	const t = await getMessages();
	const sp = (await searchParams) ?? {};

	const [items, warehouses] = await Promise.all([
		db.item.findMany({
			where: { organizationId: membership.organizationId, status: "ACTIVE" },
			orderBy: { name: "asc" },
			take: 500,
			// Phase 8.3 — include stock levels so we can show on-hand quantity
			// in the item combobox, helping users know what's already in stock.
			select: {
				id: true,
				sku: true,
				name: true,
				unit: true,
				stockLevels: { select: { quantity: true } },
			},
		}),
		db.warehouse.findMany({
			where: { organizationId: membership.organizationId, isArchived: false },
			orderBy: [{ isDefault: "desc" }, { name: "asc" }],
			select: { id: true, name: true, code: true },
		}),
	]);

	const labels: MovementFormLabels = {
		type: t.movements.fields.type,
		typeOptions: {
			RECEIPT: t.movements.types.RECEIPT,
			ISSUE: t.movements.types.ISSUE,
			ADJUSTMENT: t.movements.types.ADJUSTMENT,
			TRANSFER: t.movements.types.TRANSFER,
		},
		typeHelp: {
			RECEIPT: t.movements.typeHelp.RECEIPT,
			ISSUE: t.movements.typeHelp.ISSUE,
			ADJUSTMENT: t.movements.typeHelp.ADJUSTMENT,
			TRANSFER: t.movements.typeHelp.TRANSFER,
		},
		item: t.movements.fields.item,
		itemPlaceholder: t.movements.fields.itemPlaceholder,
		warehouse: t.movements.fields.warehouse,
		warehouseSource: t.movements.fields.warehouseSource,
		toWarehouse: t.movements.fields.toWarehouse,
		quantity: t.movements.fields.quantity,
		direction: t.movements.fields.direction,
		directionIn: t.movements.fields.directionIn,
		directionOut: t.movements.fields.directionOut,
		reference: t.movements.fields.reference,
		referencePlaceholder: t.movements.fields.referencePlaceholder,
		note: t.movements.fields.note,
		notePlaceholder: t.movements.fields.notePlaceholder,
		submit: t.common.save,
		submittingLabel: t.movements.offlineSubmitting,
		queuedLabel: t.movements.offlineQueued,
		error: t.movements.errors.createFailed,
		cancel: t.common.cancel,
	};

	const itemOptions: MovementFormOption[] = items.map((item) => {
		const onHand = item.stockLevels.reduce(
			(sum: number, l: { quantity: number }) => sum + l.quantity,
			0,
		);
		return {
			id: item.id,
			label: item.name,
			// Show SKU + on-hand quantity so warehouse staff can see current stock
			// before recording a movement without navigating away.
			sub: `${item.sku} · ${onHand} on hand`,
		};
	});
	const warehouseOptions: MovementFormOption[] = warehouses.map((w) => ({
		id: w.id,
		label: `${w.name} · ${w.code}`,
	}));

	// Precondition checks — we need at least one item and one warehouse
	// before a movement can make sense. Surface a friendly block rather
	// than letting the form dead-end.
	if (items.length === 0 || warehouses.length === 0) {
		return (
			<div className="space-y-6 max-w-2xl">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" asChild>
						<Link href="/movements">
							<ArrowLeft className="h-4 w-4" />
							{t.common.back}
						</Link>
					</Button>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>{t.movements.newMovementHeading}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm text-muted-foreground">
						{items.length === 0 ? (
							<p>
								{t.movements.errors.noItems}{" "}
								<Link
									href="/items/new"
									className="text-primary hover:underline"
								>
									{t.items.newItem}
								</Link>
							</p>
						) : null}
						{warehouses.length === 0 ? (
							<p>
								{t.movements.errors.noWarehouses}{" "}
								<Link
									href="/warehouses/new"
									className="text-primary hover:underline"
								>
									{t.warehouses.newWarehouse}
								</Link>
							</p>
						) : null}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6 max-w-2xl">
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="sm" asChild>
					<Link href="/movements">
						<ArrowLeft className="h-4 w-4" />
						{t.common.back}
					</Link>
				</Button>
			</div>

			<div>
				<h1 className="text-2xl font-semibold">
					{t.movements.newMovementHeading}
				</h1>
				<p className="text-muted-foreground">
					{t.movements.newMovementSubtitle}
				</p>
			</div>

			<Card>
				<CardContent className="pt-6">
					<MovementForm
						labels={labels}
						scope={{
							orgId: membership.organizationId,
							userId: session.user.id,
						}}
						items={itemOptions}
						warehouses={warehouseOptions}
						presetItemId={sp.itemId}
						presetWarehouseId={sp.warehouseId}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
