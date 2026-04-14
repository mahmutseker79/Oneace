import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { UNLIMITED, getPlanLimit } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

import { ItemForm, type ItemFormLabels } from "../item-form";

type SearchParams = Promise<{ barcode?: string }>;

export async function generateMetadata(): Promise<Metadata> {
	const t = await getMessages();
	return { title: `${t.items.newItem} — ${t.items.metaTitle}` };
}

export default async function NewItemPage({
	searchParams,
}: {
	searchParams?: SearchParams;
}) {
	const { membership } = await requireActiveMembership();
	const t = await getMessages();
	const params = (await searchParams) ?? {};
	const defaultBarcode = params.barcode?.trim();

	// Phase 6.3 — plan gate: if the org is at the item limit, show an upgrade
	// prompt instead of the create form. Prevents navigating here via URL and
	// hitting a server-action failure with a confusing error.
	const orgPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
	const itemLimit = getPlanLimit(orgPlan, "items");
	if (itemLimit !== UNLIMITED) {
		const currentCount = await db.item.count({
			where: { organizationId: membership.organizationId },
		});
		if (currentCount >= itemLimit) {
			return (
				<div className="space-y-6">
					<div className="space-y-1">
						<Button variant="ghost" size="sm" asChild className="-ml-2">
							<Link href="/items">
								<ChevronLeft className="h-4 w-4" />
								{t.items.backToList}
							</Link>
						</Button>
						<h1 className="text-2xl font-semibold">{t.items.newItemHeading}</h1>
					</div>
					<UpgradePrompt
						reason={`You've reached the ${itemLimit}-item limit on the Free plan. You currently have ${currentCount} items.`}
						requiredPlan="PRO"
						variant="card"
						description="Upgrade to Pro for unlimited items, bin-level tracking, purchase orders, and exports."
					/>
				</div>
			);
		}
	}

	const [categories, suppliers] = await Promise.all([
		db.category.findMany({
			where: { organizationId: membership.organizationId },
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		}),
		db.supplier.findMany({
			where: { organizationId: membership.organizationId, isActive: true },
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		}),
	]);

	const labels: ItemFormLabels = {
		fields: t.items.fields,
		common: {
			save: t.common.save,
			saveChanges: t.common.saveChanges,
			cancel: t.common.cancel,
			optional: t.common.optional,
			active: t.common.active,
			archived: t.common.archived,
			draft: t.common.draft,
			none: t.common.none,
		},
		errors: t.items.errors,
		backHref: "/items",
		backLabel: t.items.backToList,
	};

	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<Button variant="ghost" size="sm" asChild className="-ml-2">
					<Link href="/items">
						<ChevronLeft className="h-4 w-4" />
						{t.items.backToList}
					</Link>
				</Button>
				<h1 className="text-2xl font-semibold">{t.items.newItemHeading}</h1>
				<p className="text-muted-foreground">{t.items.newItemSubtitle}</p>
			</div>

			<ItemForm
				labels={labels}
				categories={categories}
				suppliers={suppliers}
				mode="create"
				defaultBarcode={defaultBarcode || undefined}
			/>
		</div>
	);
}
