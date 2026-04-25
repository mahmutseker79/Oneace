import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

import {
  type ItemOption,
  type StockSnapshot,
  TransferWizard,
  type TransferWizardLabels,
  type WarehouseOption,
} from "./transfer-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.movements.transfers.metaTitle };
}

export default async function NewTransferPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Phase 13.3 — plan gate for transfer wizard
  const transferPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(transferPlan, "transfers")) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/movements">
              <ArrowLeft className="h-4 w-4" />
              {t.common.back}
            </Link>
          </Button>
        </div>
        <PageHeader
          title={t.movements.transfers.heading}
          description={t.movements.transfers.subtitle}
        />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Inter-warehouse transfers are available on Pro and Business plans. Upgrade to move
              stock between locations with a guided wizard.
            </p>
            <Button asChild size="sm">
              <Link href="/settings/billing">Upgrade to Pro</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [rawWarehouses, rawItems] = await Promise.all([
    db.warehouse.findMany({
      where: { organizationId: membership.organizationId, isArchived: false },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    db.item.findMany({
      where: { organizationId: membership.organizationId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: 500,
      // Phase 11.4: barcode added for client-side scan matching
      select: { id: true, name: true, sku: true, barcode: true },
    }),
  ]);

  // Precondition: transfers require at least 2 warehouses and 1 item.
  if (rawWarehouses.length < 2 || rawItems.length === 0) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/movements">
              <ArrowLeft className="h-4 w-4" />
              {t.common.back}
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t.movements.transfers.heading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {rawWarehouses.length < 2 ? (
              <p>
                {t.movements.errors.noSecondWarehouse}{" "}
                <Link href="/warehouses/new" className="text-primary hover:underline">
                  {t.warehouses.newWarehouse}
                </Link>
              </p>
            ) : null}
            {rawItems.length === 0 ? (
              <p>
                {t.movements.errors.noItems}{" "}
                <Link href="/items/new" className="text-primary hover:underline">
                  {t.items.newItem}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Load warehouse-level stock levels for all active items across all
  // warehouses. This gives the wizard on-hand context without requiring
  // a round-trip per warehouse selection.
  const stockLevels = await db.stockLevel.findMany({
    where: {
      organizationId: membership.organizationId,
      binId: null, // warehouse-level only
    },
    select: { itemId: true, warehouseId: true, quantity: true },
  });

  const warehouses: WarehouseOption[] = rawWarehouses.map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
  }));

  const items: ItemOption[] = rawItems.map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    // Phase 11.4: barcode passed to wizard for scan matching
    barcode: i.barcode ?? null,
  }));

  const stockSnapshot: StockSnapshot[] = stockLevels.map((sl) => ({
    itemId: sl.itemId,
    warehouseId: sl.warehouseId,
    quantity: sl.quantity,
  }));

  const labels: TransferWizardLabels = {
    stepLocations: t.movements.transfers.stepLocations,
    stepItems: t.movements.transfers.stepItems,
    stepReview: t.movements.transfers.stepReview,
    from: t.movements.fields.warehouseSource,
    to: t.movements.fields.toWarehouse,
    fromPlaceholder: t.movements.transfers.fromPlaceholder,
    toPlaceholder: t.movements.transfers.toPlaceholder,
    sameWarehouseError: t.movements.errors.sameWarehouse,
    itemsHeading: t.movements.transfers.itemsHeading,
    addItem: t.movements.transfers.addItem,
    item: t.movements.fields.item,
    itemPlaceholder: t.movements.fields.itemPlaceholder,
    quantity: t.movements.fields.quantity,
    onHand: t.movements.transfers.onHand,
    onHandInsufficient: t.movements.transfers.onHandInsufficient,
    remove: t.common.remove,
    noItemsError: t.movements.transfers.noItemsError,
    reviewHeading: t.movements.transfers.stepReview,
    reviewFrom: t.movements.transfers.reviewFrom,
    reviewTo: t.movements.transfers.reviewTo,
    reviewItem: t.movements.transfers.reviewItem,
    reviewQty: t.movements.transfers.reviewQty,
    reviewOnHand: t.movements.transfers.reviewOnHand,
    reference: t.movements.fields.reference,
    referencePlaceholder: t.movements.fields.referencePlaceholder,
    note: t.movements.fields.note,
    notePlaceholder: t.movements.fields.notePlaceholder,
    back: t.common.back,
    next: t.common.next ?? "Next",
    submit: t.movements.transfers.submit,
    submitting: t.movements.offlineSubmitting,
    successMessage: t.movements.transfers.successMessage,
    errorMessage: t.movements.errors.createFailed,
    cancel: t.common.cancel,
    // Phase 11.4 — scan input labels
    scanInputLabel: t.movements.transfers.scanInputLabel,
    scanInputPlaceholder: t.movements.transfers.scanInputPlaceholder,
    scanInputHint: t.movements.transfers.scanInputHint,
    scanMatched: t.movements.transfers.scanMatched,
    scanIncremented: t.movements.transfers.scanIncremented,
    scanNotFound: t.movements.transfers.scanNotFound,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/movements">
            <ArrowLeft className="h-4 w-4" />
            {t.common.back}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={t.movements.transfers.heading}
        description={t.movements.transfers.subtitle}
      />

      <TransferWizard
        warehouses={warehouses}
        items={items}
        stockSnapshot={stockSnapshot}
        labels={labels}
      />
    </div>
  );
}
