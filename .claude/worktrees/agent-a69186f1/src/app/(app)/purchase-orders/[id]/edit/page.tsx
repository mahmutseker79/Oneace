import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { PurchaseOrderForm, type PurchaseOrderFormLabels } from "../../purchase-order-form";

type EditPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.purchaseOrders.editPurchaseOrder} — ${t.purchaseOrders.metaTitle}`,
  };
}

export default async function EditPurchaseOrderPage({ params }: EditPageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const po = await db.purchaseOrder.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      lines: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          itemId: true,
          orderedQty: true,
          unitCost: true,
          note: true,
        },
      },
    },
  });

  if (!po) notFound();

  // Received / cancelled POs are not editable — bounce back to detail.
  if (po.status !== "DRAFT" && po.status !== "SENT") {
    redirect(`/purchase-orders/${id}`);
  }

  const [suppliers, warehouses, items] = await Promise.all([
    db.supplier.findMany({
      where: { organizationId: membership.organizationId, isActive: true },
      select: { id: true, name: true, currency: true },
      orderBy: { name: "asc" },
    }),
    db.warehouse.findMany({
      where: { organizationId: membership.organizationId },
      select: { id: true, name: true, code: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db.item.findMany({
      where: { organizationId: membership.organizationId },
      select: { id: true, sku: true, name: true, costPrice: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const itemOptions = items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    costPrice: item.costPrice ? Number(item.costPrice) : null,
  }));

  const labels: PurchaseOrderFormLabels = {
    fields: t.purchaseOrders.fields,
    statusBadge: t.purchaseOrders.statusBadge,
    totalsLabel: t.purchaseOrders.totalsLabel,
    common: {
      save: t.common.save,
      saveChanges: t.common.saveChanges,
      cancel: t.common.cancel,
      optional: t.common.optional,
    },
    errors: {
      createFailed: t.purchaseOrders.errors.createFailed,
      updateFailed: t.purchaseOrders.errors.updateFailed,
    },
    backHref: `/purchase-orders/${id}`,
  };

  const initial = {
    id: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    warehouseId: po.warehouseId,
    currency: po.currency,
    orderedAt: po.orderedAt,
    expectedAt: po.expectedAt,
    notes: po.notes,
    status: po.status,
    lines: po.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      orderedQty: line.orderedQty,
      unitCost: line.unitCost.toString(),
      note: line.note,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/purchase-orders/${id}`}>
            <ChevronLeft className="h-4 w-4" />
            {t.purchaseOrders.backToList}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t.purchaseOrders.editPurchaseOrder}</h1>
        <p className="text-muted-foreground font-mono text-sm">{po.poNumber}</p>
      </div>

      <PurchaseOrderForm
        labels={labels}
        mode="edit"
        suppliers={suppliers}
        warehouses={warehouses}
        items={itemOptions}
        initial={initial}
      />
    </div>
  );
}
