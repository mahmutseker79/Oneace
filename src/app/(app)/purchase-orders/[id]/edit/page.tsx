import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
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

  const poLabel = po.poNumber;

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
      <PageHeader
        title={t.purchaseOrders.editPurchaseOrder}
        description=""
        backHref={`/purchase-orders/${id}`}
        breadcrumb={[
          { label: t.nav?.purchaseOrders ?? "Purchase Orders", href: "/purchase-orders" },
          { label: poLabel },
          { label: t.purchaseOrders.editPurchaseOrder },
        ]}
      />

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
