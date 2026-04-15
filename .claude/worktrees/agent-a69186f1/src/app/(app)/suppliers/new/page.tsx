import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
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
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/suppliers">
            <ChevronLeft className="h-4 w-4" />
            {t.suppliers.backToList}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t.suppliers.newSupplierHeading}</h1>
        <p className="text-muted-foreground">{t.suppliers.newSupplierSubtitle}</p>
      </div>

      <SupplierForm labels={labels} mode="create" />
    </div>
  );
}
