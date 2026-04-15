import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { getRegion } from "@/lib/i18n";
import { exportStockValuePdf } from "@/lib/export/pdf";

export async function GET() {
  const { membership } = await requireActiveMembership();

  // Phase 13.2 — exports require PRO or BUSINESS plan
  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({
        error:
          "Exports are available on Pro and Business plans. Upgrade to unlock PDF and Excel exports.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  // Get organization region for currency formatting
  const region = await getRegion();
  const currency = new Intl.NumberFormat(region.numberLocale, { style: "currency", currency: "USD" })
    .format(0)
    .replace(/[\d.,]/g, "")
    .trim();

  // Fetch all warehouses and stock levels
  const warehouses = await db.warehouse.findMany({
    where: { organizationId: membership.organizationId },
    select: { id: true, name: true },
  });

  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId, status: "ACTIVE" },
    select: {
      id: true,
      sku: true,
      name: true,
      costPrice: true,
      stockLevels: {
        select: { quantity: true, warehouseId: true },
      },
    },
  });

  // Calculate warehouse-level totals
  type WarehouseData = {
    name: string;
    value: number;
    units: number;
    items: number;
  };

  const warehouseMap = new Map<string, WarehouseData>();
  for (const warehouse of warehouses) {
    warehouseMap.set(warehouse.id, {
      name: warehouse.name,
      value: 0,
      units: 0,
      items: 0,
    });
  }

  let totalValue = 0;
  let totalUnits = 0;
  const itemRows: Array<{
    sku: string;
    name: string;
    warehouseName: string;
    onHand: number;
    costPrice: number;
    value: number;
  }> = [];

  for (const item of items) {
    const costPrice = item.costPrice ? Number(item.costPrice.toString()) : 0;

    // Group by warehouse
    const byWarehouse = new Map<string, number>();
    for (const level of item.stockLevels) {
      byWarehouse.set(
        level.warehouseId,
        (byWarehouse.get(level.warehouseId) ?? 0) + level.quantity,
      );
    }

    // Process each warehouse
    for (const [warehouseId, quantity] of byWarehouse) {
      const warehouse = warehouseMap.get(warehouseId);
      if (!warehouse) continue;

      const value = quantity * costPrice;
      warehouse.value += value;
      warehouse.units += quantity;
      warehouse.items += 1;

      totalValue += value;
      totalUnits += quantity;

      const warehouseName = warehouse.name;
      itemRows.push({
        sku: item.sku,
        name: item.name,
        warehouseName,
        onHand: quantity,
        costPrice,
        value,
      });
    }
  }

  const pdfBytes = await exportStockValuePdf({
    orgName: membership.organization.name,
    date: new Date(),
    totalValue,
    totalUnits,
    currency,
    warehouses: Array.from(warehouseMap.values()),
    itemRows,
  });

  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="oneace-stock-value-${today}.pdf"`,
    },
  });
}
