import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import {
  PurchaseOrderForm,
  type PurchaseOrderFormLabels,
  type PurchaseOrderPrefill,
} from "../purchase-order-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `${t.purchaseOrders.newPurchaseOrder} — ${t.purchaseOrders.metaTitle}`,
  };
}

type SearchParams = Promise<{ supplier?: string; items?: string }>;

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const params = (await searchParams) ?? {};
  const prefillSupplierId = params.supplier?.trim() || undefined;
  const prefillItemIds = params.items
    ? params.items
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];

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
      where: { organizationId: membership.organizationId, status: "ACTIVE" },
      select: { id: true, sku: true, name: true, costPrice: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const missing =
    suppliers.length === 0
      ? {
          body: t.purchaseOrders.emptyNoSuppliers,
          cta: t.purchaseOrders.emptyNoSuppliersCta,
          href: "/suppliers/new",
        }
      : warehouses.length === 0
        ? {
            body: t.purchaseOrders.emptyNoWarehouses,
            cta: t.purchaseOrders.emptyNoWarehousesCta,
            href: "/warehouses/new",
          }
        : items.length === 0
          ? {
              body: t.purchaseOrders.emptyNoItems,
              cta: t.purchaseOrders.emptyNoItemsCta,
              href: "/items/new",
            }
          : null;

  if (missing) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/purchase-orders">
              <ChevronLeft className="h-4 w-4" />
              {t.purchaseOrders.backToList}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{t.purchaseOrders.newPurchaseOrderHeading}</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t.purchaseOrders.emptyTitle}</CardTitle>
            <CardDescription>{missing.body}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={missing.href}>{missing.cta}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const itemOptions = items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    costPrice: item.costPrice ? Number(item.costPrice) : null,
  }));

  // Build prefill only from supplier/item IDs that actually belong to this org
  // (since we fetched them via org-scoped queries above, this is already safe).
  let prefill: PurchaseOrderPrefill | undefined;
  if (prefillSupplierId || prefillItemIds.length > 0) {
    const supplierIsValid = prefillSupplierId && suppliers.some((s) => s.id === prefillSupplierId);
    const prefillLines: Array<{ itemId: string; quantity: number }> = [];
    if (prefillItemIds.length > 0) {
      // Fetch reorderQty for the requested items (org-scoped)
      const prefillItems = await db.item.findMany({
        where: {
          organizationId: membership.organizationId,
          id: { in: prefillItemIds },
          status: "ACTIVE",
        },
        select: { id: true, reorderQty: true },
      });
      const reorderQtyById = new Map(prefillItems.map((i) => [i.id, i.reorderQty ?? 0]));
      // Preserve the order given in the URL
      for (const id of prefillItemIds) {
        if (reorderQtyById.has(id)) {
          const qty = reorderQtyById.get(id) ?? 0;
          prefillLines.push({ itemId: id, quantity: qty > 0 ? qty : 1 });
        }
      }
    }
    if (supplierIsValid || prefillLines.length > 0) {
      prefill = {
        supplierId: supplierIsValid ? prefillSupplierId : undefined,
        lines: prefillLines.length > 0 ? prefillLines : undefined,
      };
    }
  }

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
    backHref: "/purchase-orders",
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/purchase-orders">
            <ChevronLeft className="h-4 w-4" />
            {t.purchaseOrders.backToList}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t.purchaseOrders.newPurchaseOrderHeading}</h1>
        <p className="text-muted-foreground">{t.purchaseOrders.newPurchaseOrderSubtitle}</p>
      </div>

      <PurchaseOrderForm
        labels={labels}
        mode="create"
        suppliers={suppliers}
        warehouses={warehouses}
        items={itemOptions}
        prefill={prefill}
      />
    </div>
  );
}
