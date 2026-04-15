import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { serializeCsv, csvResponse, todayIsoDate } from "@/lib/csv";
import type { CsvColumn } from "@/lib/csv";

type ExportRow = {
  date: string;
  itemSku: string;
  itemName: string;
  warehouse: string;
  expectedQty: string;
  countedQty: string;
  variance: string;
  reasonCode: string;
  reasonCodeName: string;
  createdBy: string;
};

export async function GET() {
  const { membership } = await requireActiveMembership();

  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({
        error: "Exports are available on Pro and Business plans.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const movements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      type: "ADJUSTMENT",
    },
    select: {
      id: true,
      createdAt: true,
      quantity: true,
      direction: true,
      item: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
      reasonCode: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      stockCountId: true,
      itemId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const stockCountIds = new Set(
    movements.filter((m) => m.stockCountId).map((m) => m.stockCountId!),
  );

  const countSnapshots = stockCountIds.size > 0
    ? await db.countSnapshot.findMany({
        where: {
          countId: { in: Array.from(stockCountIds) },
        },
        select: {
          countId: true,
          itemId: true,
          expectedQuantity: true,
        },
      })
    : [];

  const countEntriesByCountId = stockCountIds.size > 0
    ? await db.countEntry.findMany({
        where: {
          count: {
            id: { in: Array.from(stockCountIds) },
          },
        },
        select: {
          countId: true,
          itemId: true,
          countedQuantity: true,
        },
      })
    : [];

  const snapshotMap = new Map<string, Map<string, number>>();
  for (const snap of countSnapshots) {
    if (!snapshotMap.has(snap.countId)) {
      snapshotMap.set(snap.countId, new Map());
    }
    snapshotMap.get(snap.countId)!.set(snap.itemId, snap.expectedQuantity);
  }

  const entryMap = new Map<string, Map<string, number>>();
  for (const entry of countEntriesByCountId) {
    if (!entryMap.has(entry.countId)) {
      entryMap.set(entry.countId, new Map());
    }
    entryMap.get(entry.countId)!.set(entry.itemId, entry.countedQuantity);
  }

  const locale = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows: ExportRow[] = movements.map((m) => {
    let expectedQty: number | null = null;
    let countedQty: number | null = null;

    if (m.stockCountId) {
      const snapshots = snapshotMap.get(m.stockCountId);
      const entries = entryMap.get(m.stockCountId);
      if (snapshots) expectedQty = snapshots.get(m.itemId) ?? null;
      if (entries) countedQty = entries.get(m.itemId) ?? null;
    }

    const variance =
      expectedQty != null && countedQty != null ? countedQty - expectedQty : 0;

    return {
      date: locale.format(m.createdAt),
      itemSku: m.item.sku,
      itemName: m.item.name,
      warehouse: m.warehouse.name,
      expectedQty: expectedQty !== null ? String(expectedQty) : "",
      countedQty: countedQty !== null ? String(countedQty) : "",
      variance: variance !== 0 ? String(variance) : "",
      reasonCode: m.reasonCode?.code ?? "",
      reasonCodeName: m.reasonCode?.name ?? "",
      createdBy: m.createdBy?.name ?? "",
    };
  });

  const columns: CsvColumn<ExportRow>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Item SKU", value: (r) => r.itemSku },
    { header: "Item Name", value: (r) => r.itemName },
    { header: "Warehouse", value: (r) => r.warehouse },
    { header: "Expected Qty", value: (r) => r.expectedQty },
    { header: "Counted Qty", value: (r) => r.countedQty },
    { header: "Variance", value: (r) => r.variance },
    { header: "Reason Code", value: (r) => r.reasonCode },
    { header: "Reason Name", value: (r) => r.reasonCodeName },
    { header: "Created By", value: (r) => r.createdBy },
  ];

  const csv = serializeCsv(rows, columns);
  const filename = `adjustments-${todayIsoDate()}.csv`;

  return csvResponse(filename, csv);
}
