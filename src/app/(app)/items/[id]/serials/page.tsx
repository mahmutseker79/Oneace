import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.items.serials.metaTitle || "Serial Numbers" };
}

export default async function SerialsPage({ params, searchParams }: PageProps) {
  const { id: itemId } = await params;
  const { status } = (await searchParams) ?? {};
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const canCreateSerial = hasCapability(membership.role, "items.serials.create");
  const canDeleteSerial = hasCapability(membership.role, "items.serials.delete");

  const item = await db.item.findFirst({
    where: { id: itemId, organizationId: membership.organizationId },
    select: {
      id: true,
      name: true,
      sku: true,
      trackSerialNumbers: true,
    },
  });

  if (!item) {
    notFound();
  }

  if (!item.trackSerialNumbers) {
    notFound();
  }

  const itemLabel = item.name;

  // Fetch serials, optionally filtered by status
  const serials = await db.serialNumber.findMany({
    where: {
      organizationId: membership.organizationId,
      itemId: item.id,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      item: { select: { id: true, name: true } },
      history: {
        orderBy: { performedAt: "desc" },
        take: 1,
        select: { action: true, performedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function statusBadge(s: string) {
    if (s === "IN_STOCK") return <Badge variant="outline">{t.serials.statusInStock || "In Stock"}</Badge>;
    if (s === "ISSUED") return <Badge variant="secondary">{t.serials.statusIssued || "Issued"}</Badge>;
    if (s === "SOLD") return <Badge>{t.serials.statusSold || "Sold"}</Badge>;
    if (s === "RETURNED") return <Badge className="bg-blue-600">{t.serials.statusReturned || "Returned"}</Badge>;
    if (s === "DISPOSED") return <Badge variant="destructive">{t.serials.statusDisposed || "Disposed"}</Badge>;
    if (s === "LOST") return <Badge variant="destructive">{t.serials.statusLost || "Lost"}</Badge>;
    return <Badge>{s}</Badge>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.serials.heading || "Serial Numbers"}
        description={t.serials.subtitle || "Track individual serial numbers"}
        backHref={`/items/${item.id}`}
        breadcrumb={[
          { label: t.nav?.items ?? "Items", href: "/items" },
          { label: itemLabel },
          { label: t.serials.heading || "Serial Numbers" },
        ]}
        actions={
          canCreateSerial ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/items/${item.id}/serials/new`}>
                  <Plus className="h-4 w-4" />
                  {t.serials.addSerial || "Add Serial"}
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/items/${item.id}/serials/bulk`}>
                  <Plus className="h-4 w-4" />
                  {t.serials.bulkGenerate || "Bulk Generate"}
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      {serials.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>{t.serials.emptyTitle || "No serial numbers"}</CardTitle>
            <CardDescription>{t.serials.emptyBody || "Create serial numbers to start tracking"}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.serials.columnSerial || "Serial Number"}</TableHead>
                  <TableHead>{t.serials.columnStatus || "Status"}</TableHead>
                  <TableHead>{t.serials.columnLocation || "Location"}</TableHead>
                  <TableHead>{t.serials.columnLastMoved || "Last Moved"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serials.map((serial) => (
                  <TableRow key={serial.id}>
                    <TableCell>
                      <Link
                        href={`/items/${item.id}/serials/${serial.id}`}
                        className="font-mono hover:underline"
                      >
                        {serial.serialNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{statusBadge(serial.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {serial.warehouseId ? `Warehouse` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {serial.lastMovedAt ? dateFormatter.format(serial.lastMovedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
