import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import {
  type ItemOption,
  NewCountForm,
  type NewCountFormLabels,
  type WarehouseOption,
} from "../new-count-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.stockCounts.createHeading };
}

export default async function NewStockCountPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const [items, warehouses] = await Promise.all([
    db.item.findMany({
      where: { organizationId: membership.organizationId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, sku: true, name: true },
    }),
    db.warehouse.findMany({
      where: { organizationId: membership.organizationId, isArchived: false },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
  ]);

  if (items.length === 0 || warehouses.length === 0) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title={t.stockCounts.createHeading}
          breadcrumb={[
            { label: t.stockCounts.metaTitle, href: "/stock-counts" },
            { label: t.stockCounts.createHeading },
          ]}
          backHref="/stock-counts"
        />
        <Card>
          <CardHeader>
            <CardTitle>{t.stockCounts.createHeading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {items.length === 0 ? (
              <p>
                {t.movements.errors.noItems}{" "}
                <Link href="/items/new" className="text-primary hover:underline">
                  {t.items.newItem}
                </Link>
              </p>
            ) : null}
            {warehouses.length === 0 ? (
              <p>
                {t.stockCounts.errors.noWarehouses}{" "}
                <Link href="/warehouses/new" className="text-primary hover:underline">
                  {t.warehouses.newWarehouse}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  const itemOptions: ItemOption[] = items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
  }));
  const warehouseOptions: WarehouseOption[] = warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
  }));

  const labels: NewCountFormLabels = {
    name: t.stockCounts.fields.name,
    namePlaceholder: t.stockCounts.fields.namePlaceholder,
    methodology: t.stockCounts.fields.methodology,
    methodologyOptions: {
      CYCLE: t.stockCounts.methodology.CYCLE,
      FULL: t.stockCounts.methodology.FULL,
      SPOT: t.stockCounts.methodology.SPOT,
      BLIND: t.stockCounts.methodology.BLIND,
      DOUBLE_BLIND: t.stockCounts.methodology.DOUBLE_BLIND,
      DIRECTED: t.stockCounts.methodology.DIRECTED,
    },
    methodologyHelp: {
      CYCLE: t.stockCounts.methodologyHelp.CYCLE,
      FULL: t.stockCounts.methodologyHelp.FULL,
      SPOT: t.stockCounts.methodologyHelp.SPOT,
      BLIND: t.stockCounts.methodologyHelp.BLIND,
      DOUBLE_BLIND: t.stockCounts.methodologyHelp.DOUBLE_BLIND,
      DIRECTED: t.stockCounts.methodologyHelp.DIRECTED,
    },
    warehouse: t.stockCounts.fields.warehouse,
    warehouseAll: t.stockCounts.fields.warehouseAll,
    warehouseHelp: t.stockCounts.fields.warehouseHelp,
    items: t.stockCounts.fields.items,
    itemsSearchPlaceholder: t.stockCounts.fields.itemsSearchPlaceholder,
    itemsSelected: (count: number) =>
      t.stockCounts.fields.itemsSelected.replace("{count}", String(count)),
    itemsSelectAll: t.stockCounts.fields.itemsSelectAll,
    itemsEmpty: t.stockCounts.fields.itemsEmpty,
    itemsHint: t.stockCounts.fields.itemsHint,
    advancedOptions: t.stockCounts.fields.advancedOptions,
    submit: t.common.create,
    cancel: t.common.cancel,
    genericError: t.stockCounts.errors.createFailed,
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={t.stockCounts.createHeading}
        description={t.stockCounts.createSubtitle}
        breadcrumb={[
          { label: t.stockCounts.metaTitle, href: "/stock-counts" },
          { label: t.stockCounts.createHeading },
        ]}
        backHref="/stock-counts"
      />

      <Card>
        <CardContent className="pt-6">
          <NewCountForm labels={labels} items={itemOptions} warehouses={warehouseOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
