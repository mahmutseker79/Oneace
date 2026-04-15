import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { serializeCsv, csvResponse, todayIsoDate } from "@/lib/csv";
import type { CsvColumn } from "@/lib/csv";

type ExportRow = {
  code: string;
  category: string;
  occurrences: string;
  totalQtyImpact: string;
  totalValueImpact: string;
  percentOfTotal: string;
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

  const movements = await db.stockMovement.findMany({
    where: {
      organizationId: membership.organizationId,
      reasonCodeId: { not: null },
    },
    select: {
      quantity: true,
      reasonCodeId: true,
      reasonCode: {
        select: {
          id: true,
          code: true,
          category: true,
        },
      },
      item: {
        select: {
          costPrice: true,
        },
      },
    },
  });

  const reasonCodeMap = new Map<string, { code: string; category: string; count: number; qtyImpact: number; valueImpact: number }>();
  let totalImpact = 0;

  for (const m of movements) {
    if (!m.reasonCode) continue;

    const key = m.reasonCode.id;
    const costNum = m.item.costPrice ? Number(m.item.costPrice.toString()) : 0;
    const valueImpact = m.quantity * costNum;

    if (!reasonCodeMap.has(key)) {
      reasonCodeMap.set(key, {
        code: m.reasonCode.code,
        category: m.reasonCode.category,
        count: 0,
        qtyImpact: 0,
        valueImpact: 0,
      });
    }

    const row = reasonCodeMap.get(key)!;
    row.count += 1;
    row.qtyImpact += m.quantity;
    row.valueImpact += valueImpact;
    totalImpact += Math.abs(valueImpact);
  }

  const rows: ExportRow[] = Array.from(reasonCodeMap.values())
    .map((row) => {
      const percent = totalImpact > 0 ? (Math.abs(row.valueImpact) / totalImpact) * 100 : 0;
      return {
        code: row.code,
        category: row.category,
        occurrences: String(row.count),
        totalQtyImpact: String(row.qtyImpact),
        totalValueImpact: String(row.valueImpact),
        percentOfTotal: String(Math.round(percent * 10) / 10),
      };
    })
    .sort((a, b) => parseInt(b.occurrences) - parseInt(a.occurrences));

  const columns: CsvColumn<ExportRow>[] = [
    { header: "Code", value: (r) => r.code },
    { header: "Category", value: (r) => r.category },
    { header: "Occurrences", value: (r) => r.occurrences },
    { header: "Total Qty Impact", value: (r) => r.totalQtyImpact },
    { header: "Total Value Impact", value: (r) => r.totalValueImpact },
    { header: "% of Total", value: (r) => r.percentOfTotal },
  ];

  const csv = serializeCsv(rows, columns);
  const filename = `reason-code-summary-${todayIsoDate()}.csv`;

  return csvResponse(filename, csv);
}
