import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { ItemForm, type ItemFormLabels } from "../../item-form";

type EditItemPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: `${t.items.editItem} — ${t.items.metaTitle}` };
}

export default async function EditItemPage({ params }: EditItemPageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const item = await db.item.findUnique({
    where: { id, organizationId: membership.organizationId },
  });

  if (!item) {
    notFound();
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

  // Decimal is not serializable to client components — convert to strings.
  const initial = {
    ...item,
    costPrice: item.costPrice ? item.costPrice.toString() : null,
    salePrice: item.salePrice ? item.salePrice.toString() : null,
  };

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
        title={t.items.editItem}
        description={`${item.name} · ${item.sku}`}
        breadcrumb={[
          { label: t.items.metaTitle, href: "/items" },
          { label: item.name, href: `/items/${item.id}` },
          { label: t.items.editItem },
        ]}
        backHref="/items"
      />

      <ItemForm
        labels={labels}
        categories={categories}
        suppliers={suppliers}
        mode="edit"
        initial={initial}
      />
    </div>
  );
}
