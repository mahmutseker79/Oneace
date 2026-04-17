import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader
        title={t.warehouses.newWarehouseHeading}
        description={t.warehouses.newWarehouseSubtitle}
        breadcrumb={[
          { label: t.warehouses.metaTitle, href: "/warehouses" },
          { label: t.warehouses.newWarehouse },
        ]}
        backHref="/warehouses"
      />

      <WarehouseForm labels={labels} mode="create" />
    </div>
  );
}
