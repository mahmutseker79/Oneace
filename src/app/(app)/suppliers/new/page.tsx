import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { SupplierForm, type SupplierFormLabels } from "../supplier-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: `${t.suppliers.newSupplier} — ${t.suppliers.metaTitle}` };
}

export default async function NewSupplierPage() {
  await requireActiveMembership();
  const t = await getMessages();

  const labels: SupplierFormLabels = {
    fields: t.suppliers.fields,
    common: {
      save: t.common.save,
      saveChanges: t.common.saveChanges,
      cancel: t.common.cancel,
      optional: t.common.optional,
    },
    errors: {
      createFailed: t.suppliers.errors.createFailed,
      updateFailed: t.suppliers.errors.updateFailed,
    },
    backHref: "/suppliers",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.suppliers.newSupplierHeading}
        description={t.suppliers.newSupplierSubtitle}
        breadcrumb={[
          { label: t.suppliers.metaTitle, href: "/suppliers" },
          { label: t.suppliers.newSupplier },
        ]}
        backHref="/suppliers"
      />

      <SupplierForm labels={labels} mode="create" />
    </div>
  );
}
