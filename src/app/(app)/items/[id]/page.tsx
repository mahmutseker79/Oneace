import { ArrowLeft, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

type MovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER" | "COUNT";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.itemDetail.metaTitle };
}

export default async function ItemDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const item = await db.item.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      category: { select: { id: true, name: true } },
      stockLevels: {
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: { warehouse: { name: "asc" } },
      },
    },
  });

  if (!item) {
    notFound();
  }

  const movements = await db.stockMovement.findMany({
    where: { organizationId: membership.organizationId, itemId: item.id },
    include: {
      warehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalOnHand = item.stockLevels.reduce((sum, lvl) => sum + lvl.quantity, 0);
  const totalReserved = item.stockLevels.reduce((sum, lvl) => sum + lvl.reservedQty, 0);
  const totalAvailable = totalOnHand - totalReserved;

  const salePrice = item.salePrice
    ? formatCurrency(Number(item.salePrice), {
        currency: item.currency,
        locale: region.numberLocale,
      })
    : null;
  const costPrice = item.costPrice
    ? formatCurrency(Number(item.costPrice), {
        currency: item.currency,
        locale: region.numberLocale,
      })
    : null;

  function statusBadge(status: "ACTIVE" | "ARCHIVED" | "DRAFT") {
    if (status === "ACTIVE") return <Badge>{t.common.active}</Badge>;
    if (status === "DRAFT") return <Badge variant="outline">{t.common.draft}</Badge>;
    return <Badge variant="secondary">{t.common.archived}</Badge>;
  }

  function typeBadge(type: MovementType) {
    const label = t.movements.types[type];
    if (type === "RECEIPT") return <Badge className="bg-emerald-600">{label}</Badge>;
    if (type === "ISSUE") return <Badge variant="destructive">{label}</Badge>;
    if (type === "ADJUSTMENT") return <Badge variant="secondary">{label}</Badge>;
    return <Badge variant="outline">{label}</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/items">
            <ArrowLeft className="h-4 w-4" />
            {t.itemDetail.backToItems}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{item.name}</h1>
            {statusBadge(item.status)}
          </div>
          <p className="font-mono text-sm text-muted-foreground">{item.sku}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/movements/new?itemId=${item.id}`}>
              <Plus className="h-4 w-4" />
              {t.itemDetail.recordMovement}
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/items/${item.id}/edit`}>
              <Pencil className="h-4 w-4" />
              {t.itemDetail.editItem}
            </Link>
          </Button>
        </div>
      </div>

      {/* Overview + Pricing */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.itemDetail.overviewHeading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.itemDetail.skuLabel}</span>
              <span className="font-mono">{item.sku}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.itemDetail.barcodeLabel}</span>
              <span className="font-mono">{item.barcode ?? t.itemDetail.noBarcode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.itemDetail.categoryLabel}</span>
              <span>{item.category?.name ?? t.itemDetail.noCategory}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.itemDetail.unitLabel}</span>
              <span>{item.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.itemDetail.reorderPointLabel}</span>
              <span className="tabular-nums">
                {item.reorderPoint} {item.unit}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.itemDetail.reorderQtyLabel}</span>
              <span className="tabular-nums">
                {item.reorderQty} {item.unit}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.itemDetail.pricingHeading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.itemDetail.costPriceLabel}</span>
              <span className="tabular-nums">{costPrice ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.itemDetail.salePriceLabel}</span>
              <span className="tabular-nums">{salePrice ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t.items.fields.currency}</span>
              <span>{item.currency}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {item.description ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.itemDetail.descriptionHeading}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{item.description}</CardContent>
        </Card>
      ) : null}

      {/* Stock on hand */}
      <Card>
        <CardHeader>
          <CardTitle>{t.itemDetail.stockHeading}</CardTitle>
          <CardDescription>
            {totalOnHand} {item.unit} · {totalAvailable} {t.itemDetail.stockColumnAvailable}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {item.stockLevels.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">{t.itemDetail.stockEmpty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.itemDetail.stockColumnWarehouse}</TableHead>
                  <TableHead className="text-right">{t.itemDetail.stockColumnQuantity}</TableHead>
                  <TableHead className="text-right">{t.itemDetail.stockColumnReserved}</TableHead>
                  <TableHead className="text-right">{t.itemDetail.stockColumnAvailable}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.stockLevels.map((lvl) => (
                  <TableRow key={lvl.id}>
                    <TableCell>
                      <Link href={`/warehouses/${lvl.warehouse.id}`} className="hover:underline">
                        {lvl.warehouse.name}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">
                        {lvl.warehouse.code}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {lvl.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {lvl.reservedQty} {item.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {lvl.quantity - lvl.reservedQty} {item.unit}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2">
                  <TableCell className="font-semibold">{t.itemDetail.totalRow}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {totalOnHand} {item.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {totalReserved} {item.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {totalAvailable} {item.unit}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent movements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t.movements.recentHeading}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/movements">{t.movements.viewAll}</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">{t.movements.recentEmpty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.movements.columnDate}</TableHead>
                  <TableHead>{t.movements.columnType}</TableHead>
                  <TableHead>{t.movements.columnWarehouse}</TableHead>
                  <TableHead className="text-right">{t.movements.columnQuantity}</TableHead>
                  <TableHead>{t.movements.columnUser}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => {
                  const signedQty = m.direction < 0 ? -m.quantity : m.quantity;
                  const absQty = Math.abs(signedQty);
                  const prefix = signedQty > 0 ? t.movements.directionIn : t.movements.directionOut;
                  const isTransfer = m.type === "TRANSFER" && m.toWarehouse;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        <Link href={`/movements/${m.id}`} className="hover:underline">
                          {dateFormatter.format(m.createdAt)}
                        </Link>
                      </TableCell>
                      <TableCell>{typeBadge(m.type as MovementType)}</TableCell>
                      <TableCell className="text-sm">
                        {isTransfer && m.toWarehouse ? (
                          <>
                            <Link
                              href={`/warehouses/${m.warehouse.id}`}
                              className="hover:underline"
                            >
                              {m.warehouse.name}
                            </Link>{" "}
                            {t.movements.transferLabel}{" "}
                            <Link
                              href={`/warehouses/${m.toWarehouse.id}`}
                              className="hover:underline"
                            >
                              {m.toWarehouse.name}
                            </Link>
                          </>
                        ) : (
                          <Link href={`/warehouses/${m.warehouse.id}`} className="hover:underline">
                            {m.warehouse.name}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={signedQty >= 0 ? "text-emerald-600" : "text-destructive"}>
                          {prefix}
                          {absQty} {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.createdBy?.name ?? m.createdBy?.email ?? t.movements.unknownUser}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
