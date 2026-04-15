import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { WarehouseForm, type WarehouseFormLabels } from "../../warehouse-form";

type EditWarehousePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.warehouses.editWarehouse} — ${t.warehouses.metaTitle}`,
  };
}

export default async function EditWarehousePage({ params }: EditWarehousePageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const warehouse = await db.warehouse.findUnique({
    where: { id, organizationId: membership.organizationId },
  });

  if (!warehouse) {
    notFound();
  }

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
        <h1 className="text-2xl font-semibold">{t.warehouses.editWarehouse}</h1>
        <p className="text-muted-foreground">
          {warehouse.name} <span className="font-mono text-xs">· {warehouse.code}</span>
        </p>
      </div>

      <WarehouseForm labels={labels} mode="edit" initial={warehouse} />
    </div>
  );
}
