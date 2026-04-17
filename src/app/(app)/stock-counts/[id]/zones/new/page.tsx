import type { Metadata } from "next";

import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { ZoneForm } from "../zone-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.countZones.formHeading };
}

export default async function NewZonePage({ params }: PageProps) {
  const { id: countId } = await params;
  await requireActiveMembership();
  const t = await getMessages();

  return (
    <ZoneForm
      countId={countId}
      labels={{
        heading: t.countZones.formHeading,
        nameLabel: t.countZones.formNameLabel,
        namePlaceholder: t.countZones.formNamePlaceholder,
        descriptionLabel: t.countZones.formDescriptionLabel,
        descriptionPlaceholder: t.countZones.formDescriptionPlaceholder,
        colorLabel: t.countZones.formColorLabel,
        barcodeLabel: t.countZones.formBarcodeLabel,
        barcodePlaceholder: t.countZones.formBarcodePlaceholder,
        barcodeFormatLabel: t.countZones.formBarcodeFormatLabel,
        parentZoneLabel: t.countZones.formParentZoneLabel,
        parentZonePlaceholder: t.countZones.formParentZonePlaceholder,
        promoteLabel: t.countZones.formPromoteToBinLabel,
        promoteHelp: t.countZones.formPromoteToBinHelp,
        createButton: t.countZones.formCreateButton,
        updateButton: t.countZones.formUpdateButton,
        cancelButton: t.countZones.formCancelButton,
        createSuccess: t.countZones.createSuccess,
        updateSuccess: t.countZones.updateSuccess,
        errors: {
          createFailed: t.countZones.errors.createFailed,
          updateFailed: t.countZones.errors.updateFailed,
        },
      }}
    />
  );
}
