/**
 * Phase D — Count Comparison PDF export
 *
 * POST /api/reports/count-comparison/pdf
 * Body: { count1Id: string, count2Id: string }
 *
 * Mirrors the data pipeline of the JSON compare endpoint but streams a
 * branded PDF back instead of JSON. Plan-gated on `exports`; rate-limited
 * identically to other PDF export routes.
 */

import { z } from "zod";

import { db } from "@/lib/db";
import {
  type TableColumn,
  addPageHeader,
  addSummaryStats,
  addTable,
  createPdfDocument,
} from "@/lib/export/pdf";
import { hasPlanCapability } from "@/lib/plans";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { requireActiveMembership } from "@/lib/session";
import { compareStockCounts } from "@/lib/stockcount/compare";

const BodySchema = z.object({
  count1Id: z.string().cuid(),
  count2Id: z.string().cuid(),
});

export async function POST(req: Request) {
  const { membership } = await requireActiveMembership();

  // Rate-limit: 10 exports per hour per user (matches low-stock/pdf).
  const rl = await rateLimit(`export:${membership.userId}`, RATE_LIMITS.export);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: "Export rate limit exceeded. Try again later." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const plan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(plan, "exports")) {
    return new Response(
      JSON.stringify({
        error:
          "Exports are available on Pro and Business plans. Upgrade to unlock PDF exports.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", issues: parsed.error.issues }, {
      status: 400,
    });
  }
  const { count1Id, count2Id } = parsed.data;

  // Verify both counts belong to this organization before loading rows.
  const counts = await db.stockCount.findMany({
    where: {
      id: { in: [count1Id, count2Id] },
      organizationId: membership.organizationId,
    },
    select: { id: true, name: true, createdAt: true, methodology: true },
  });

  if (counts.length !== 2) {
    return Response.json({ error: "Count not found or not accessible" }, { status: 404 });
  }
  const count1 = counts.find((c) => c.id === count1Id);
  const count2 = counts.find((c) => c.id === count2Id);
  if (!count1 || !count2) {
    return Response.json({ error: "Count not found" }, { status: 404 });
  }

  // Same helper used by the JSON endpoint — one source of truth.
  const rows = await compareStockCounts(count1Id, count2Id, membership.organizationId);

  const totalDiff = rows.reduce((acc, r) => acc + r.difference, 0);
  const totalAbsDiff = rows.reduce((acc, r) => acc + Math.abs(r.difference), 0);
  const matched = rows.filter((r) => r.difference === 0).length;
  const divergent = rows.length - matched;

  // ---------- PDF rendering ----------
  const now = new Date();
  const doc = createPdfDocument({
    orgName: membership.organization.name,
    reportTitle: "Count Comparison",
    date: now,
  });
  let y = addPageHeader(
    doc,
    {
      orgName: membership.organization.name,
      reportTitle: "Count Comparison",
      date: now,
    },
    10,
  );

  y = addSummaryStats(
    doc,
    [
      { label: "Count A", value: count1.name },
      { label: "Count B", value: count2.name },
      { label: "Items compared", value: String(rows.length) },
      { label: "Matched", value: String(matched) },
      { label: "Divergent", value: String(divergent) },
      { label: "Net Δ units", value: formatSigned(totalDiff) },
      { label: "Total |Δ| units", value: String(totalAbsDiff) },
    ],
    y,
  );

  const columns: TableColumn[] = [
    { header: "SKU", dataKey: "sku" },
    { header: "Item", dataKey: "name" },
    { header: "WH", dataKey: "wh" },
    { header: "A qty", dataKey: "a", halign: "right" },
    { header: "B qty", dataKey: "b", halign: "right" },
    { header: "Δ", dataKey: "diff", halign: "right" },
    { header: "Δ%", dataKey: "pct", halign: "right" },
  ];

  const tableRows = rows
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 500) // PDF budget — top 500 rows by abs variance
    .map((r) => ({
      sku: r.itemSku,
      name: r.itemName,
      wh: r.warehouseCode,
      a: String(r.count1Qty),
      b: String(r.count2Qty),
      diff: formatSigned(r.difference),
      pct:
        r.variancePercent === 0
          ? "0%"
          : `${r.variancePercent > 0 ? "+" : ""}${r.variancePercent.toFixed(1)}%`,
    }));

  addTable(doc, columns, tableRows, y);

  const buffer = doc.output("arraybuffer");
  const filename = `count-comparison-${count1.id.slice(0, 6)}-vs-${count2.id.slice(0, 6)}-${now.toISOString().slice(0, 10)}.pdf`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function formatSigned(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : String(n);
}
