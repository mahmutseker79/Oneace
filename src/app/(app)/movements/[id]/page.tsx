import { ArrowLeft, ArrowLeftRight, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

type MovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER" | "BIN_TRANSFER" | "COUNT";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.movements.detail.metaTitle };
}

export default async function MovementDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const movement = await db.stockMovement.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      item: { select: { id: true, sku: true, name: true, unit: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!movement) {
    notFound();
  }

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const type = movement.type as MovementType;
  const signedQty = movement.direction < 0 ? -movement.quantity : movement.quantity;
  const qtyPrefix = signedQty >= 0 ? t.movements.directionIn : t.movements.directionOut;
  const absQty = Math.abs(signedQty);
  const userLabel =
    movement.createdBy?.name ?? movement.createdBy?.email ?? t.movements.unknownUser;

  function typeBadge(t: MovementType, label: string) {
    if (t === "RECEIPT") return <Badge className="bg-emerald-600">{label}</Badge>;
    if (t === "ISSUE") return <Badge variant="destructive">{label}</Badge>;
    if (t === "ADJUSTMENT") return <Badge variant="secondary">{label}</Badge>;
    return <Badge variant="outline">{label}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/movements">
            <ArrowLeft className="h-4 w-4" />
            {t.movements.detail.backToList}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{t.movements.detail.summaryHeading}</h1>
            {typeBadge(type, t.movements.types[type])}
          </div>
          <p className="text-sm text-muted-foreground">
            {dateFormatter.format(movement.createdAt)}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.movements.detail.metaWhen}</span>
            <span className="whitespace-nowrap">{dateFormatter.format(movement.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.movements.detail.metaType}</span>
            <span>{t.movements.types[type]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.movements.detail.metaQuantity}</span>
            <span
              className={`font-mono tabular-nums ${
                signedQty >= 0 ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {qtyPrefix}
              {absQty} {movement.item.unit}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.movements.detail.metaUser}</span>
            <span>{userLabel}</span>
          </div>
          <div className="flex justify-between md:col-span-2">
            <span className="text-muted-foreground">{t.movements.detail.metaReference}</span>
            <span className="max-w-[70%] text-right font-mono text-xs">
              {movement.reference ?? "—"}
            </span>
          </div>
          {movement.note ? (
            <div className="flex justify-between md:col-span-2">
              <span className="text-muted-foreground">{t.movements.detail.metaNote}</span>
              <span className="max-w-[70%] text-right">{movement.note}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            {t.movements.detail.itemHeading}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xl font-semibold">{movement.item.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{movement.item.sku}</p>
          <div className="pt-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/items/${movement.item.id}`}>
                <Package className="h-4 w-4" />
                {t.movements.detail.viewItem}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4" />
            {t.movements.detail.warehouseHeading}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            {type === "TRANSFER" && movement.toWarehouse ? (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t.movements.detail.sourceWarehouse}
              </p>
            ) : null}
            <Link
              href={`/warehouses/${movement.warehouse.id}`}
              className="font-medium hover:underline"
            >
              {movement.warehouse.name}
            </Link>
            <p className="font-mono text-xs text-muted-foreground">{movement.warehouse.code}</p>
          </div>
          {type === "TRANSFER" && movement.toWarehouse ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t.movements.detail.destinationWarehouse}
              </p>
              <Link
                href={`/warehouses/${movement.toWarehouse.id}`}
                className="font-medium hover:underline"
              >
                {movement.toWarehouse.name}
              </Link>
              <p className="font-mono text-xs text-muted-foreground">{movement.toWarehouse.code}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
