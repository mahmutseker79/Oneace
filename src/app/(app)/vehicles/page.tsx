import type { Metadata } from "next";
import Link from "next/link";

import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { listVehiclesAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.vehicles.metaTitle };
}

export default async function VehiclesPage() {
  const t = await getMessages();
  const { membership } = await requireActiveMembership();
  const canManage = hasCapability(membership.role, "assets.create");
  const result = await listVehiclesAction();
  const vehicles = result.ok ? (result.data ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.vehicles.heading}</h1>
          <p className="text-muted-foreground text-sm">{t.vehicles.subtitle}</p>
        </div>
        {canManage && (
          <Link
            href="/vehicles/new"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
          >
            {t.vehicles.newVehicle}
          </Link>
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="border-border bg-card rounded-lg border p-12 text-center">
          <h3 className="text-lg font-medium">{t.vehicles.emptyTitle}</h3>
          <p className="text-muted-foreground mt-1 text-sm">{t.vehicles.emptyBody}</p>
          {canManage && (
            <Link
              href="/vehicles/new"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
            >
              {t.vehicles.emptyCta}
            </Link>
          )}
        </div>
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-border border-b">
              <tr className="text-muted-foreground text-left">
                <th className="px-4 py-3 font-medium">{t.vehicles.columnName}</th>
                <th className="px-4 py-3 font-medium">{t.vehicles.columnLicensePlate}</th>
                <th className="px-4 py-3 font-medium">{t.vehicles.columnStatus}</th>
                <th className="px-4 py-3 font-medium">{t.vehicles.columnCreated}</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/vehicles/${v.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {v.name}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{v.licensePlate ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium">
                      {v.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
