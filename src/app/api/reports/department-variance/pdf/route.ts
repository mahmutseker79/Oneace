/**
 * Phase D — Department Variance PDF export
 *
 * GET /api/reports/department-variance/pdf
 *
 * Uses the same calculation as the JSON endpoint. Plan-gated on
 * `exports`; rate-limited per user.
 */

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

type Status = "good" | "warning" | "critical";

interface DepartmentVarianceRow {
  departmentName: string;
  itemCount: number;
  currentQty: number;
  countedQty: number;
  variance: number; // signed
  variancePercent: number; // always >= 0 (|variance| / current)
  status: Status;
}

export async function GET() {
  const { membership } = await requireActiveMembership();

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

  const departments = await db.department.findMany({
    where: { organizationId: membership.organizationId, isActive: true },
    include: {
      items: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          stockLevels: { select: { quantity: true } },
        },
      },
    },
  });

  const counts = await db.countEntry.findMany({
    where: { count: { organizationId: membership.organizationId } },
    select: {
      itemId: true,
      countedQuantity: true,
    },
  });

  // Build item → counted map (last value wins — mirrors JSON route).
  const countedByItem = new Map<string, number>();
  for (const entry of counts) {
    countedByItem.set(entry.itemId, entry.countedQuantity);
  }

  const rows: DepartmentVarianceRow[] = departments.map((dept) => {
    if (dept.items.length === 0) {
      return {
        departmentName: dept.name,
        itemCount: 0,
        currentQty: 0,
        countedQty: 0,
        variance: 0,
        variancePercent: 0,
        status: "good" as const,
      };
    }

    let currentQty = 0;
    let countedQty = 0;
    for (const item of dept.items) {
      const onHand = item.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
      currentQty += onHand;
      countedQty += countedByItem.get(item.id) ?? 0;
    }

    const variance = countedQty - currentQty;
    const variancePercent = currentQty > 0 ? (Math.abs(variance) / currentQty) * 100 : 0;

    let status: Status = "good";
    if (variancePercent > 10) status = "critical";
    else if (variancePercent > 5) status = "warning";

    return {
      departmentName: dept.name,
      itemCount: dept.items.length,
      currentQty,
      countedQty,
      variance,
      variancePercent,
      status,
    };
  });

  rows.sort((a, b) => b.variancePercent - a.variancePercent);

  const critical = rows.filter((r) => r.status === "critical").length;
  const warning = rows.filter((r) => r.status === "warning").length;
  const totalVariance = rows.reduce((acc, r) => acc + r.variance, 0);

  // ---------- PDF rendering ----------
  const now = new Date();
  const doc = createPdfDocument({
    orgName: membership.organization.name,
    reportTitle: "Department Variance",
    date: now,
  });
  let y = addPageHeader(
    doc,
    {
      orgName: membership.organization.name,
      reportTitle: "Department Variance",
      date: now,
    },
    10,
  );

  y = addSummaryStats(
    doc,
    [
      { label: "Departments", value: String(rows.length) },
      { label: "Critical (>10%)", value: String(critical) },
      { label: "Warning (5-10%)", value: String(warning) },
      { label: "Net Δ units", value: formatSigned(totalVariance) },
    ],
    y,
  );

  const columns: TableColumn[] = [
    { header: "Department", dataKey: "name" },
    { header: "Items", dataKey: "items", halign: "right" },
    { header: "On hand", dataKey: "current", halign: "right" },
    { header: "Counted", dataKey: "counted", halign: "right" },
    { header: "Δ units", dataKey: "diff", halign: "right" },
    { header: "Δ%", dataKey: "pct", halign: "right" },
    { header: "Status", dataKey: "status" },
  ];

  const tableRows = rows.map((r) => ({
    name: r.departmentName,
    items: String(r.itemCount),
    current: String(r.currentQty),
    counted: String(r.countedQty),
    diff: formatSigned(r.variance),
    pct: `${r.variancePercent.toFixed(1)}%`,
    status: r.status.toUpperCase(),
  }));

  addTable(doc, columns, tableRows, y);

  const buffer = doc.output("arraybuffer");
  const filename = `department-variance-${now.toISOString().slice(0, 10)}.pdf`;

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
