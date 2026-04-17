import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { getVehicleAction } from "../actions";
import VehicleForm from "../vehicle-form";
import LoadShipmentButton from "./load-shipment-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.vehicles.detailMetaTitle };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getMessages();
  const { membership } = await requireActiveMembership();
  const canManage = hasCapability(membership.role, "assets.create");
  const result = await getVehicleAction(id);

  if (!result.ok || !result.data) return notFound();

  const vehicle = result.data;

  return (
    <div className="space-y-6">
      <Link href="/vehicles" className="text-muted-foreground hover:text-foreground text-sm">
        ← {t.vehicles.backToList}
      </Link>

      <VehicleForm
        vehicleId={vehicle.id}
        initialData={{
          name: vehicle.name,
          licensePlate: vehicle.licensePlate ?? "",
          description: vehicle.description ?? "",
          notes: vehicle.notes ?? "",
        }}
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

      {/* Load Shipment Section */}
      <div className="border-border bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t.vehicles.loadingHeading}</h2>
            <p className="text-muted-foreground text-sm">{t.vehicles.loadingDescription}</p>
          </div>
          {canManage && <LoadShipmentButton vehicleId={vehicle.id} labels={t.vehicles} />}
        </div>
      </div>

      {/* History Section */}
      <div className="border-border bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{t.vehicles.historyHeading}</h2>
        {vehicle.history.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">{t.vehicles.historyEmpty}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {vehicle.history.map((h) => (
              <div
                key={h.id}
                className="border-border flex items-start gap-3 border-b pb-3 last:border-0"
              >
                <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
                  {h.action}
                </span>
                <div className="flex-1">
                  <p className="text-sm">{h.note ?? "—"}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(h.performedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
