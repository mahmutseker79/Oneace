import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
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

  const categories = await db.category.findMany({
    where: { organizationId: membership.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

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
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/items">
            <ChevronLeft className="h-4 w-4" />
            {t.items.backToList}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t.items.editItem}</h1>
        <p className="text-muted-foreground">
          {item.name} <span className="font-mono text-xs">· {item.sku}</span>
        </p>
      </div>

      <ItemForm labels={labels} categories={categories} mode="edit" initial={initial} />
    </div>
  );
}
