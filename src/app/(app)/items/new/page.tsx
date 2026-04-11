import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { ItemForm, type ItemFormLabels } from "../item-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: `${t.items.newItem} — ${t.items.metaTitle}` };
}

export default async function NewItemPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

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

      <ItemForm labels={labels} categories={categories} suppliers={suppliers} mode="create" />
    </div>
  );
}
