import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { notFound } from "next/navigation";

import { PalletLabelForm } from "../pallet-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: "Create Pallet Label" };
}

export default async function CreatePalletPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "assets.create")) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Pallet Label"
        description="Create a new pallet barcode label for tracking inventory pallets"
      />

      <PalletLabelForm />
    </div>
  );
}
