import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeftRight, Boxes, Pencil, Plus } from "lucide-react";
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
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";

// Phase 3 — movement history pagination.
const MOVE_PAGE_SIZE = 20;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ moveCursor?: string }>;
};

type MovementType = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER" | "COUNT";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.itemDetail.metaTitle };
}

export default async function ItemDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { moveCursor } = (await searchParams) ?? {};
  const { membership } = await requireActiveMembership();
  // Phase 8.1 — role-based button visibility on item detail.
  const canEditItem = hasCapability(membership.role, "items.edit");
  const canCreateMovement = hasCapability(membership.role, "movements.create");
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

  const movementsRaw = await db.stockMovement.findMany({
    where: { organizationId: membership.organizationId, itemId: item.id },
    include: {
      warehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    // Phase 3 — fetch PAGE+1 to detect next page; cursor-based pagination.
    take: MOVE_PAGE_SIZE + 1,
    ...(moveCursor ? { cursor: { id: moveCursor }, skip: 1 } : {}),
  });

  const hasMoreMovements = movementsRaw.length > MOVE_PAGE_SIZE;
  const movements = hasMoreMovements ? movementsRaw.slice(0, MOVE_PAGE_SIZE) : movementsRaw;
  const nextMoveCursor = hasMoreMovements ? movements[movements.length - 1]?.id : null;

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
    if (type === "RECEIPT") return <Badge className="bg-success">{label}</Badge>;
    if (type === "ISSUE") return <Badge variant="destructive">{label}</Badge>;
    if (type === "ADJUSTMENT") return <Badge variant="secondary">{label}</Badge>;
    return <Badge variant="outline">{label}</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Header — God-Mode Design: PageHeader with breadcrumb + back + badge */}
      <PageHeader
        title={item.name}
        description={item.sku}
        backHref="/items"
        badge={statusBadge(item.status)}
        breadcrumb={[{ label: t.nav?.items ?? "Items", href: "/items" }, { label: item.name }]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-sm text-muted-foreground">{item.sku}</p>
            {/* Phase 18 — copy SKU shortcut */}
            <CopyButton text={item.sku} label="Copy SKU" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCreateMovement ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/movements/new?itemId=${item.id}`}>
                <Plus className="h-4 w-4" />
                {t.itemDetail.recordMovement}
              </Link>
            </Button>
          ) : null}
          {canEditItem ? (
            <Button size="sm" asChild>
              <Link href={`/items/${item.id}/edit`}>
                <Pencil className="h-4 w-4" />
                {t.itemDetail.editItem}
              </Link>
            </Button>
          ) : null}
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
              <span className="flex items-center gap-1 font-mono">
                {item.barcode ?? t.itemDetail.noBarcode}
                {/* Phase 18 — copy barcode shortcut */}
                {item.barcode ? <CopyButton text={item.barcode} label="Copy barcode" /> : null}
              </span>
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
            // Sprint 17 PR #1 (UX/UI audit Apr-25 §B-7): inline ternary empty → EmptyState (bare).
            <EmptyState icon={Boxes} title={t.itemDetail.stockEmpty} bare />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.itemDetail.stockColumnWarehouse}</TableHead>
                  <TableHead className="text-right">{t.itemDetail.stockColumnQuantity}</TableHead>
                  {/* Phase 6.7 — tooltip explains what "reserved" means in context */}
                  <TableHead
                    className="text-right"
                    title="Units allocated to pending purchase orders or transfers — not yet physically moved"
                  >
                    {t.itemDetail.stockColumnReserved}
                  </TableHead>
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
            // Sprint 17 PR #1 (UX/UI audit Apr-25 §B-7): inline ternary empty → EmptyState (bare).
            <EmptyState icon={ArrowLeftRight} title={t.movements.recentEmpty} bare />
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
                        <span className={signedQty >= 0 ? "text-success" : "text-destructive"}>
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
          {/* Phase 3 — load more for movement history */}
          {nextMoveCursor ? (
            <div className="flex justify-center border-t pt-3">
              <Link
                href={`/items/${item.id}?moveCursor=${encodeURIComponent(nextMoveCursor)}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Load more movements &rarr;
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
