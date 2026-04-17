import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import {
  type BinOption,
  PutawayForm,
  type PutawayFormLabels,
  type PutawayItem,
} from "./putaway-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.purchaseOrders.putaway.metaTitle} — ${t.purchaseOrders.metaTitle}`,
  };
}

export default async function PutawayPage({ params }: PageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Load PO with lines and item details.
  const po = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      supplier: { select: { name: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      lines: {
        orderBy: { createdAt: "asc" },
        include: {
          item: { select: { id: true, sku: true, name: true } },
        },
      },
    },
  });

  if (!po) notFound();

  // Putaway is meaningful for POs that have received at least some stock.
  // Allow it for any non-DRAFT status with received quantities.
  const hasAnyReceived = po.lines.some((l) => l.receivedQty > 0);
  if (!hasAnyReceived) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={`/purchase-orders/${id}`}>
              <ChevronLeft className="h-4 w-4" />
              {t.purchaseOrders.detail.backToList}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{t.purchaseOrders.putaway.heading}</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t.purchaseOrders.putaway.nothingReceivedTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t.purchaseOrders.putaway.nothingReceivedBody}
          </CardContent>
        </Card>
      </div>
    );
  }

  const warehouseId = po.warehouse.id;

  // Load bins for this warehouse.
  const bins = await db.bin.findMany({
    where: { warehouseId, isArchived: false },
    orderBy: { code: "asc" },
    select: { id: true, code: true, label: true },
  });

  // Load warehouse-level (binId=null) stock levels for all received items.
  const receivedItemIds = po.lines.filter((l) => l.receivedQty > 0).map((l) => l.itemId);

  const unbinnedLevels = await db.stockLevel.findMany({
    where: {
      organizationId: membership.organizationId,
      warehouseId,
      itemId: { in: receivedItemIds },
      binId: null,
    },
    select: { itemId: true, quantity: true },
  });
  const unbinnedMap = new Map(unbinnedLevels.map((sl) => [sl.itemId, sl.quantity]));

  // Build putaway items — only lines that have been received.
  const putawayItems: PutawayItem[] = po.lines
    .filter((l) => l.receivedQty > 0)
    .map((l) => ({
      itemId: l.item.id,
      itemName: l.item.name,
      itemSku: l.item.sku,
      unbinnedQty: Math.max(0, unbinnedMap.get(l.item.id) ?? 0),
    }));

  const binOptions: BinOption[] = bins.map((b) => ({
    id: b.id,
    code: b.code,
    label: b.label ?? null,
  }));

  const labels: PutawayFormLabels = {
    heading: t.purchaseOrders.putaway.heading,
    subtitle: t.purchaseOrders.putaway.subtitle,
    columnItem: t.purchaseOrders.detail.columnItem,
    columnSku: t.purchaseOrders.detail.columnSku,
    columnUnbinned: t.purchaseOrders.putaway.columnUnbinned,
    columnBin: t.purchaseOrders.putaway.columnBin,
    columnQty: t.purchaseOrders.receive.columnReceiveNow,
    binPlaceholder: t.purchaseOrders.putaway.binPlaceholder,
    noBins: t.purchaseOrders.putaway.noBins,
    noUnbinnedStock: t.purchaseOrders.putaway.noUnbinnedStock,
    submit: t.purchaseOrders.putaway.submit,
    submitting: t.movements.offlineSubmitting,
    cancel: t.common.cancel,
    successTitle: t.purchaseOrders.putaway.successTitle,
    successBody: (count: number) =>
      t.purchaseOrders.putaway.successBody.replace("{count}", String(count)),
    viewPo: t.purchaseOrders.receive.viewPo,
    overAssignError: t.purchaseOrders.putaway.overAssignError,
    nothingToAssign: t.purchaseOrders.putaway.nothingToAssign,
    genericError: t.purchaseOrders.errors.receiveFailed,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/purchase-orders/${id}`}>
            <ChevronLeft className="h-4 w-4" />
            {t.purchaseOrders.detail.backToList}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t.purchaseOrders.putaway.heading}</h1>
        <p className="text-sm text-muted-foreground">{t.purchaseOrders.putaway.subtitle}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {po.poNumber} · {po.supplier.name} → {po.warehouse.name}
        </p>
      </div>

      <PutawayForm
        warehouseId={warehouseId}
        purchaseOrderId={id}
        backHref={`/purchase-orders/${id}`}
        items={putawayItems}
        bins={binOptions}
        labels={labels}
      />
    </div>
  );
}
