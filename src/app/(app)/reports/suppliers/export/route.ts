import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { supplierActiveWhere } from "@/lib/db/soft-delete";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

/**
 * GET /reports/suppliers/export — supplier performance CSV.
 *
 * One row per supplier, same metrics as the on-screen report:
 *
 *   - Total POs / Open POs / Received value / On-time rate / Avg lead time
 *
 * On-time rate and avg lead time are emitted as empty cells when there
 * are no eligible PO samples, rather than 0 or "—" — so downstream
 * analysts can distinguish "actually on-time 0%" from "not enough data
 * to know". Lead time is rounded to one decimal; currency values are
 * fixed-point at two decimals. Rows sort by received value descending.
 */

type ExportRow = {
  name: string;
  code: string;
  totalPos: number;
  openPos: number;
  receivedValue: string;
  onTimeRate: string | null;
  avgLeadDays: string | null;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "Supplier", value: (r) => r.name },
  { header: "Code", value: (r) => r.code },
  { header: "Total POs", value: (r) => r.totalPos },
  { header: "Open POs", value: (r) => r.openPos },
  { header: "Received value", value: (r) => r.receivedValue },
  { header: "On-time rate", value: (r) => r.onTimeRate },
  { header: "Avg lead time (days)", value: (r) => r.avgLeadDays },
];

export async function GET() {
  const { membership } = await requireActiveMembership();

  // Phase 13.2 — exports require PRO or BUSINESS plan
  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({
        error:
          "Exports are available on Pro and Business plans. Upgrade to unlock CSV and Excel exports.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  // P2-4 (§11.4) — keep the CSV in lockstep with the on-screen
  // report: archived suppliers are hidden everywhere else, they
  // should not bleed into an export either.
  const suppliers = await db.supplier.findMany({
    where: { organizationId: membership.organizationId, ...supplierActiveWhere },
    select: {
      name: true,
      code: true,
      purchaseOrders: {
        select: {
          status: true,
          orderedAt: true,
          expectedAt: true,
          receivedAt: true,
          lines: {
            select: {
              receivedQty: true,
              unitCost: true,
            },
          },
        },
      },
    },
  });

  const rows: ExportRow[] = suppliers.map((s) => {
    let openPos = 0;
    let receivedValue = 0;
    let onTimeEligible = 0;
    let onTimeCount = 0;
    const leadTimeSampleDays: number[] = [];

    for (const po of s.purchaseOrders) {
      if (po.status === "SENT" || po.status === "PARTIALLY_RECEIVED") {
        openPos += 1;
      }

      for (const line of po.lines) {
        const unit = Number(line.unitCost.toString());
        receivedValue += line.receivedQty * unit;
      }

      if (po.status === "RECEIVED" && po.receivedAt) {
        const orderedMs = po.orderedAt.getTime();
        const receivedMs = po.receivedAt.getTime();
        const leadDays = Math.round((receivedMs - orderedMs) / (1000 * 60 * 60 * 24));
        if (leadDays >= 0) leadTimeSampleDays.push(leadDays);

        if (po.expectedAt) {
          onTimeEligible += 1;
          if (receivedMs <= po.expectedAt.getTime()) onTimeCount += 1;
        }
      }
    }

    const onTimeRate =
      onTimeEligible === 0 ? null : `${((onTimeCount / onTimeEligible) * 100).toFixed(0)}%`;

    const avgLead =
      leadTimeSampleDays.length === 0
        ? null
        : (leadTimeSampleDays.reduce((a, b) => a + b, 0) / leadTimeSampleDays.length).toFixed(1);

    return {
      name: s.name,
      code: s.code ?? "",
      totalPos: s.purchaseOrders.length,
      openPos,
      receivedValue: receivedValue.toFixed(2),
      onTimeRate,
      avgLeadDays: avgLead,
    };
  });

  rows.sort((a, b) => Number(b.receivedValue) - Number(a.receivedValue));

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-supplier-performance-${todayIsoDate()}.csv`, csv);
}
