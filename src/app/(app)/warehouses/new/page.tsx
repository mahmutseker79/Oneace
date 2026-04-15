import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { WarehouseForm, type WarehouseFormLabels } from "../warehouse-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.warehouses.newWarehouse} — ${t.warehouses.metaTitle}`,
  };
}

export default async function NewWarehousePage() {
  await requireActiveMembership();
  const t = await getMessages();

  const labels: WarehouseFormLabels = {
    fields: t.warehouses.fields,
    common: {
      save: t.common.save,
      saveChanges: t.common.saveChanges,
      cancel: t.common.cancel,
      optional: t.common.optional,
    },
    errors: t.warehouses.errors,
    backHref: "/warehouses",
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/warehouses">
            <ChevronLeft className="h-4 w-4" />
            {t.warehouses.backToList}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t.warehouses.newWarehouseHeading}</h1>
        <p className="text-muted-foreground">{t.warehouses.newWarehouseSubtitle}</p>
      </div>

      <WarehouseForm labels={labels} mode="create" />
    </div>
  );
}
