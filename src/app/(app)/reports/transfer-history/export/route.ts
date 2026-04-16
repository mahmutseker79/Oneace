import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { serializeCsv, csvResponse, todayIsoDate } from "@/lib/csv";
import type { CsvColumn } from "@/lib/csv";

type ExportRow = {
  transferNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  status: string;
  totalItems: string;
  shippedQty: string;
  receivedQty: string;
  discrepancy: string;
  shippedDate: string;
  receivedDate: string;
};

export async function GET() {
  const { membership } = await requireActiveMembership();

  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({ error: "Exports are available on Pro and Business plans." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const transfers = await db.stockTransfer.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      lines: {
        select: {
          shippedQty: true,
          receivedQty: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows: ExportRow[] = transfers.map((t) => {
    const shippedQty = t.lines.reduce((s, l) => s + (l.shippedQty ?? 0), 0);
    const receivedQty = t.lines.reduce((s, l) => s + (l.receivedQty ?? 0), 0);
    const discrepancy = receivedQty - shippedQty;

    return {
      transferNumber: t.transferNumber,
      fromWarehouse: t.fromWarehouse.name,
      toWarehouse: t.toWarehouse.name,
      status: t.status,
      totalItems: String(t.lines.length),
      shippedQty: String(shippedQty),
      receivedQty: String(receivedQty),
      discrepancy: discrepancy !== 0 ? String(discrepancy) : "",
      shippedDate: t.shippedAt ? dateFmt.format(t.shippedAt) : "",
      receivedDate: t.receivedAt ? dateFmt.format(t.receivedAt) : "",
    };
  });

  const columns: CsvColumn<ExportRow>[] = [
    { header: "Transfer #", value: (r) => r.transferNumber },
    { header: "From Warehouse", value: (r) => r.fromWarehouse },
    { header: "To Warehouse", value: (r) => r.toWarehouse },
    { header: "Status", value: (r) => r.status },
    { header: "Total Items", value: (r) => r.totalItems },
    { header: "Shipped Qty", value: (r) => r.shippedQty },
    { header: "Received Qty", value: (r) => r.receivedQty },
    { header: "Discrepancy", value: (r) => r.discrepancy },
    { header: "Shipped Date", value: (r) => r.shippedDate },
    { header: "Received Date", value: (r) => r.receivedDate },
  ];

  const csv = serializeCsv(rows, columns);
  const filename = `transfer-history-${todayIsoDate()}.csv`;

  return csvResponse(filename, csv);
}
