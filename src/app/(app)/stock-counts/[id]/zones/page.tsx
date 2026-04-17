import { Edit2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MobileCard, ResponsiveTable } from "@/components/ui/responsive-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { ZoneDeleteDialog } from "./zone-delete-dialog";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.countZones.heading };
}

export default async function CountZonesPage({ params }: PageProps) {
  const { id: countId } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const canManage = hasCapability(membership.role, "stockCounts.create");

  // Verify the stock count exists and belongs to this organization
  const count = await db.stockCount.findFirst({
    where: { id: countId, organizationId: membership.organizationId },
    select: { id: true, name: true },
  });

  if (!count) {
    return (
      <div className="space-y-6">
        <PageHeader title={t.countZones.heading} />
        <EmptyState icon={undefined as any} title={t.common.notFound} />
      </div>
    );
  }

  // Fetch all zones for this count
  const zones = await db.countZone.findMany({
    where: { countId, organizationId: membership.organizationId, isArchived: false },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      barcodeValue: true,
      barcodeFormat: true,
      parentZoneId: true,
      promoteToBin: true,
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const hasZones = zones.length > 0;

  function barcodeStatusBadge(barcodeValue: string | null) {
    if (barcodeValue) {
      return <Badge variant="success">{t.countZones.barcodeStatusGenerated}</Badge>;
    }
    return <Badge variant="secondary">{t.countZones.barcodeStatusMissing}</Badge>;
  }

  const cardView = zones.map((zone) => (
    <MobileCard
      key={zone.id}
      title={zone.name}
      subtitle={zone.description || undefined}
      fields={[
        {
          label: t.countZones.columnColor,
          value: zone.color ? (
            <div
              className="w-6 h-6 rounded border border-gray-300"
              style={{ backgroundColor: zone.color }}
              title={zone.color}
            />
          ) : (
            "—"
          ),
        },
        {
          label: t.countZones.columnBarcodeStatus,
          value: barcodeStatusBadge(zone.barcodeValue),
        },
        {
          label: t.countZones.columnBarcode,
          value: zone.barcodeValue || "—",
        },
        {
          label: t.countZones.columnEntries,
          value: zone._count.entries,
        },
      ]}
      actions={
        canManage ? (
          <div className="flex gap-2">
            <Link
              href={`/stock-counts/${countId}/zones/${zone.id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              {t.common.edit}
            </Link>
            <ZoneDeleteDialog
              zoneId={zone.id}
              zoneName={zone.name}
              countId={countId}
              labels={{
                deleteTitle: t.common.delete,
                deleteConfirm: t.countZones.deleteConfirm,
                deleteButton: t.common.delete,
                cancelButton: t.common.cancel,
              }}
            />
          </div>
        ) : undefined
      }
    />
  ));

  const tableView = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.countZones.columnName}</TableHead>
          <TableHead>{t.countZones.columnColor}</TableHead>
          <TableHead>{t.countZones.columnBarcodeStatus}</TableHead>
          <TableHead>{t.countZones.columnBarcode}</TableHead>
          <TableHead className="text-right">{t.countZones.columnEntries}</TableHead>
          {canManage && <TableHead className="text-right">{t.countZones.columnAction}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {zones.map((zone) => (
          <TableRow key={zone.id}>
            <TableCell className="font-medium">{zone.name}</TableCell>
            <TableCell>
              {zone.color ? (
                <div
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: zone.color }}
                  title={zone.color}
                />
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>{barcodeStatusBadge(zone.barcodeValue)}</TableCell>
            <TableCell className="font-mono text-sm">{zone.barcodeValue || "—"}</TableCell>
            <TableCell className="text-right">{zone._count.entries}</TableCell>
            {canManage && (
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/stock-counts/${countId}/zones/${zone.id}`}>
                    <Button size="sm" variant="ghost">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </Link>
                  <ZoneDeleteDialog
                    zoneId={zone.id}
                    zoneName={zone.name}
                    countId={countId}
                    labels={{
                      deleteTitle: t.common.delete,
                      deleteConfirm: t.countZones.deleteConfirm,
                      deleteButton: t.common.delete,
                      cancelButton: t.common.cancel,
                    }}
                  />
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={t.countZones.heading}
          description={`${t.countZones.description} (${count.name})`}
        />
        {canManage && (
          <Button asChild>
            <Link href={`/stock-counts/${countId}/zones/new`}>
              <Plus className="mr-2 h-4 w-4" />
              {t.countZones.newZone}
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.countZones.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasZones ? (
            <div className="py-8">
              <EmptyState
                icon={undefined as any}
                title={t.countZones.emptyTitle}
                description={t.countZones.emptyBody}
              />
              {canManage && (
                <div className="flex justify-center pt-4">
                  <Button asChild>
                    <Link href={`/stock-counts/${countId}/zones/new`}>{t.countZones.emptyCta}</Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ResponsiveTable cardView={cardView} label={t.countZones.heading}>
              {tableView}
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
