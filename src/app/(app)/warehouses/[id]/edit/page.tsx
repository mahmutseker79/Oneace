import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader
        title={t.warehouses.editWarehouse}
        description={`${warehouse.name} · ${warehouse.code}`}
        breadcrumb={[
          { label: t.warehouses.metaTitle, href: "/warehouses" },
          { label: warehouse.name, href: `/warehouses/${warehouse.id}` },
          { label: t.warehouses.editWarehouse },
        ]}
        backHref="/warehouses"
      />

      <WarehouseForm labels={labels} mode="edit" initial={warehouse} />
    </div>
  );
}
