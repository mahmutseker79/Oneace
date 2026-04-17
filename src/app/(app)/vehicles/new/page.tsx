import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { hasCapability } from "@/lib/permissions";
import { redirect } from "next/navigation";

import VehicleForm from "../vehicle-form";

export const metadata: Metadata = {
  title: "New Vehicle",
};

export default async function NewVehiclePage() {
  const t = await getMessages();
  const { membership } = await requireActiveMembership();

  if (!hasCapability(membership.role, "assets.create")) {
    redirect("/vehicles");
  }

  return (
    <VehicleForm
      labels={{
        newVehicleHeading: t.vehicles.newVehicleHeading,
        editVehicle: t.vehicles.editVehicle,
        columnName: t.vehicles.columnName,
        columnLicensePlate: t.vehicles.columnLicensePlate,
        columnDescription: t.vehicles.columnDescription,
        backToList: t.vehicles.backToList,
        created: t.vehicles.created,
        updated: t.vehicles.updated,
        errors: t.vehicles.errors,
      }}
    />
  );
}
