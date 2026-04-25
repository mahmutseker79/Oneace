import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { SupplierForm, type SupplierFormLabels } from "../../supplier-form";

type EditSupplierPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: `${t.suppliers.editSupplier} — ${t.suppliers.metaTitle}` };
}

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const supplier = await db.supplier.findUnique({
    where: { id, organizationId: membership.organizationId },
  });

  if (!supplier) {
    notFound();
  }

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
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href="/suppliers">
          <ChevronLeft className="h-4 w-4" />
          {t.suppliers.backToList}
        </Link>
      </Button>
      <PageHeader
        title={t.suppliers.editSupplier}
        description={
          supplier.code
            ? `${supplier.name} · ${supplier.code}`
            : supplier.name
        }
      />

      <SupplierForm labels={labels} mode="edit" initial={supplier} />
    </div>
  );
}
