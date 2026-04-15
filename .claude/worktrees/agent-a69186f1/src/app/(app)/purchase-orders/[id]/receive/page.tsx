import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { ReceiveForm, type ReceiveFormLabels, type ReceiveLine } from "./receive-form";

type ReceivePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.purchaseOrders.receive.metaTitle} — ${t.purchaseOrders.metaTitle}`,
  };
}

export default async function ReceivePurchaseOrderPage({ params }: ReceivePageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const po = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      supplier: { select: { id: true, name: true } },
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

  // Only DRAFT, SENT, or PARTIALLY_RECEIVED POs are receivable.
  if (po.status !== "DRAFT" && po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
    redirect(`/purchase-orders/${id}`);
  }

  const lines: ReceiveLine[] = po.lines.map((line) => ({
    id: line.id,
    itemName: line.item.name,
    itemSku: line.item.sku,
    orderedQty: line.orderedQty,
    receivedQty: line.receivedQty,
  }));

  const labels: ReceiveFormLabels = {
    columnItem: t.purchaseOrders.detail.columnItem,
    columnSku: t.purchaseOrders.detail.columnSku,
    columnOrdered: t.purchaseOrders.detail.columnOrdered,
    columnReceived: t.purchaseOrders.detail.columnReceived,
    columnOpen: t.purchaseOrders.receive.columnOpen,
    columnReceiveNow: t.purchaseOrders.receive.columnReceiveNow,
    notesLabel: t.purchaseOrders.receive.notesLabel,
    notesPlaceholder: t.purchaseOrders.receive.notesPlaceholder,
    submit: t.purchaseOrders.receive.submit,
    submitAll: t.purchaseOrders.receive.submitAll,
    cancel: t.common.cancel,
    successTitle: t.purchaseOrders.receive.successTitle,
    successBody: (count: number) =>
      t.purchaseOrders.receive.successBody.replace("{count}", String(count)),
    successFullyReceived: t.purchaseOrders.receive.successFullyReceived,
    viewPo: t.purchaseOrders.receive.viewPo,
    nothingToReceive: t.purchaseOrders.errors.nothingToReceive,
    receiveOverflow: t.purchaseOrders.errors.receiveOverflow,
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
        <h1 className="text-2xl font-semibold">{t.purchaseOrders.receive.heading}</h1>
        <p className="text-muted-foreground text-sm">{t.purchaseOrders.receive.subtitle}</p>
        <p className="text-muted-foreground font-mono text-xs">
          {po.poNumber} · {po.supplier.name} → {po.warehouse.name}
        </p>
      </div>

      <ReceiveForm
        purchaseOrderId={po.id}
        poNumber={po.poNumber}
        backHref={`/purchase-orders/${id}`}
        lines={lines}
        labels={labels}
      />
    </div>
  );
}
