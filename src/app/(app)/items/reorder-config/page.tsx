import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { ReorderConfigForm } from "./reorder-config-form";
import type { ReorderConfigFormLabels } from "./reorder-config-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.items.reorderConfig.metaTitle };
}

export default async function ReorderConfigPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const items = await db.item.findMany({
    where: {
      organizationId: membership.organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      sku: true,
      name: true,
      reorderPoint: true,
      reorderQty: true,
      stockLevels: { select: { quantity: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    onHand: item.stockLevels.reduce((sum, l) => sum + l.quantity, 0),
    reorderPoint: item.reorderPoint,
    reorderQty: item.reorderQty,
  }));

  const formLabels: ReorderConfigFormLabels = {
    columnName: t.items.reorderConfig.columnName,
    columnSku: t.items.reorderConfig.columnSku,
    columnOnHand: t.items.reorderConfig.columnOnHand,
    columnReorderPoint: t.items.reorderConfig.columnReorderPoint,
    columnReorderQty: t.items.reorderConfig.columnReorderQty,
    saveCta: t.items.reorderConfig.saveCta,
    saving: t.items.reorderConfig.saving,
    noChanges: t.items.reorderConfig.noChanges,
    successToast: t.items.reorderConfig.successToast,
    changedCount: t.items.reorderConfig.changedCount,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/items">
            <ChevronLeft className="h-4 w-4" />
            {t.items.reorderConfig.backToItems}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t.items.reorderConfig.heading}</h1>
        <p className="text-muted-foreground">{t.items.reorderConfig.subtitle}</p>
      </div>
      <ReorderConfigForm rows={rows} labels={formLabels} />
    </div>
  );
}
