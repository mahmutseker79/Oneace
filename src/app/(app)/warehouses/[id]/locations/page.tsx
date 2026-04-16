import { ArrowLeft, ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/shell/delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { deleteLocationLevelAction } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.locations?.metaTitle || "Locations" };
}

export default async function LocationsPage({ params }: PageProps) {
  const { id: warehouseId } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const canCreateLocation = hasCapability(membership.role, "locations.create");
  const canEditLocation = hasCapability(membership.role, "locations.edit");
  const canDeleteLocation = hasCapability(membership.role, "locations.delete");

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true, name: true, code: true },
  });

  if (!warehouse) {
    notFound();
  }

  const warehouseLabel = warehouse.name;

  const locations = await db.locationLevel.findMany({
    where: { warehouseId, organizationId: membership.organizationId },
    include: {
      children: {
        select: { id: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Build hierarchy
  const locationMap = new Map(locations.map((loc) => [loc.id, loc]));
  const rootLocations = locations.filter((loc) => !loc.parentId);

  function typeBadge(type: string) {
    const colors: Record<string, string> = {
      ZONE: "bg-blue-100 text-blue-800",
      AISLE: "bg-green-100 text-green-800",
      RACK: "bg-purple-100 text-purple-800",
      SHELF: "bg-orange-100 text-orange-800",
      BAY: "bg-pink-100 text-pink-800",
      FLOOR: "bg-slate-100 text-slate-800",
    };
    return <span className={`text-xs px-2 py-1 rounded ${colors[type] || ""}`}>{type}</span>;
  }

  function LocationTreeNode({
    location,
    depth,
  }: {
    location: (typeof locations)[0];
    depth: number;
  }) {
    const hasChildren = location.children.length > 0;

    return (
      <div key={location.id} className="border-b">
        <div className="flex items-center gap-2 px-4 py-3 hover:bg-muted/50">
          <div style={{ marginLeft: `${depth * 24}px` }}>
            {hasChildren ? <ChevronRight className="h-4 w-4" /> : <div className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-medium">{location.name}</span>
              {typeBadge(location.type)}
            </div>
            <div className="text-xs text-muted-foreground">
              {location.code}
              {location.barcodeValue && ` • ${location.barcodeValue}`}
            </div>
          </div>

          {(canEditLocation || canDeleteLocation) && (
            <div className="flex items-center gap-1">
              {canEditLocation && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/warehouses/${warehouseId}/locations/${location.id}/edit`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {canDeleteLocation && (
                <DeleteButton
                  labels={{
                    trigger: "Delete",
                    title: t.locations?.deleteConfirmTitle || "Delete location?",
                    body: t.locations?.deleteConfirmBody || "This action cannot be undone",
                    cancel: t.common.cancel,
                    confirm: t.common.delete,
                  }}
                  action={deleteLocationLevelAction.bind(null, location.id, warehouseId)}
                  iconOnly
                />
              )}
            </div>
          )}
        </div>

        {hasChildren &&
          location.children.map((child) => {
            const location_detail = locationMap.get(child.id);
            return location_detail ? (
              <LocationTreeNode
                key={location_detail.id}
                location={location_detail}
                depth={depth + 1}
              />
            ) : null;
          })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.locations?.heading || "Location Hierarchy"}
        description={t.locations?.subtitle || "Organize locations by zone, aisle, rack, and shelf"}
        backHref={`/warehouses/${warehouseId}`}
        breadcrumb={[
          { label: t.nav?.warehouses ?? "Warehouses", href: "/warehouses" },
          { label: warehouseLabel },
          { label: t.locations?.heading || "Location Hierarchy" },
        ]}
        actions={
          canCreateLocation ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/warehouses/${warehouseId}/locations/new`}>
                <Plus className="h-4 w-4" />
                {t.locations?.addLocation || "Add Location"}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {rootLocations.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>{t.locations?.emptyTitle || "No locations"}</CardTitle>
            <CardDescription>
              {t.locations?.emptyBody || "Create location levels to organize your warehouse"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div>
              {rootLocations.map((location) => (
                <LocationTreeNode key={location.id} location={location} depth={0} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
