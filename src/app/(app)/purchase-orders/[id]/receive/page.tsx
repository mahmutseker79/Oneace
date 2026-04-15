import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
          // Phase 11.2: barcode added so the scan input can match
          // scanned codes to the correct PO line.
          item: { select: { id: true, sku: true, name: true, barcode: true } },
        },
      },
    },
  });

  // Phase 11.3: check if the PO's warehouse has any bins so we can
  // conditionally show the putaway CTA on the success screen.
  // Use a cheap count — we only need to know if bins exist, not the full list.
  const warehouseBinCount = po
    ? await db.bin.count({ where: { warehouseId: po.warehouse.id, isArchived: false } })
    : 0;

  if (!po) notFound();

  // Only DRAFT, SENT, or PARTIALLY_RECEIVED POs are receivable.
  if (po.status !== "DRAFT" && po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
    redirect(`/purchase-orders/${id}`);
  }

  const poLabel = po.poNumber;

  const lines: ReceiveLine[] = po.lines.map((line) => ({
    id: line.id,
    itemName: line.item.name,
    itemSku: line.item.sku,
    // Phase 11.2: barcode used by the scan input for line matching.
    // null when the item has no barcode registered.
    itemBarcode: line.item.barcode ?? null,
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
    // Phase 11.2 — scan-driven receiving
    scanInputLabel: t.purchaseOrders.receive.scanInputLabel,
    scanInputPlaceholder: t.purchaseOrders.receive.scanInputPlaceholder,
    scanInputHint: t.purchaseOrders.receive.scanInputHint,
    scanMatchFound: t.purchaseOrders.receive.scanMatchFound,
    scanMatchNotFound: t.purchaseOrders.receive.scanMatchNotFound,
    scanMatchAlreadyFull: t.purchaseOrders.receive.scanMatchAlreadyFull,
    // Phase 11.3: putaway CTA — only shown when warehouse has bins.
    putawayLabel: warehouseBinCount > 0 ? t.purchaseOrders.putaway.heading : undefined,
    putawayHref: warehouseBinCount > 0 ? `/purchase-orders/${id}/putaway` : undefined,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.purchaseOrders.receive.heading}
        description={t.purchaseOrders.receive.subtitle}
        backHref={`/purchase-orders/${id}`}
        breadcrumb={[
          { label: t.nav?.purchaseOrders ?? "Purchase Orders", href: "/purchase-orders" },
          { label: poLabel },
          { label: t.purchaseOrders.receive.heading },
        ]}
      />

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
