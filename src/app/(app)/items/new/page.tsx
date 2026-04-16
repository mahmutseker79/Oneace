import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
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
  // Phase 7.3 — pre-fill currency from org region so new items default
  // to the correct currency without manual selection.
  const region = await getRegion();
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
          <PageHeader
            title={t.items.newItemHeading}
            breadcrumb={[{ label: t.items.metaTitle, href: "/items" }, { label: t.items.newItem }]}
            backHref="/items"
          />
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
      <PageHeader
        title={t.items.newItemHeading}
        description={t.items.newItemSubtitle}
        breadcrumb={[{ label: t.items.metaTitle, href: "/items" }, { label: t.items.newItem }]}
        backHref="/items"
      />

      <ItemForm
        labels={labels}
        categories={categories}
        suppliers={suppliers}
        mode="create"
        defaultBarcode={defaultBarcode || undefined}
        defaultCurrency={region.currency}
      />
    </div>
  );
}
