import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { ZoneForm } from "../zone-form";

interface PageProps {
  params: Promise<{ id: string; zoneId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.countZones.formHeading };
}

export default async function EditZonePage({ params }: PageProps) {
  const { id: countId, zoneId } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Fetch the zone
  const zone = await db.countZone.findFirst({
    where: {
      id: zoneId,
      countId,
      organizationId: membership.organizationId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      barcodeValue: true,
      barcodeFormat: true,
      parentZoneId: true,
      promoteToBin: true,
    },
  });

  if (!zone) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t.common.notFound}</h1>
        <p className="text-muted-foreground">{t.countZones.errors.notFound}</p>
      </div>
    );
  }

  return (
    <ZoneForm
      countId={countId}
      zoneId={zoneId}
      initialData={{
        name: zone.name,
        description: zone.description,
        color: zone.color,
        barcodeValue: zone.barcodeValue,
        barcodeFormat: zone.barcodeFormat,
        parentZoneId: zone.parentZoneId,
        promoteToBin: zone.promoteToBin,
      }}
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
