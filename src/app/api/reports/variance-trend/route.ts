/**
 * Phase D — Variance Trend Report API
 *
 * GET /api/reports/variance-trend — Get variance trend data
 * POST /api/reports/variance-trend/export — Export trend data
 *
 * Calculates actual variance percentages from completed stock counts,
 * grouped by completion date. Each data point represents the average
 * absolute variance percentage for counts completed on that day.
 */

import { z } from "zod";

import { csvResponse, serializeCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { buildExcelWorkbook, excelResponse, todayIsoDate } from "@/lib/excel";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { requireActiveMembership } from "@/lib/session";

const ExportSchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  data: z.array(z.any()),
});

async function handleGetTrend(_req?: Request) {
  try {
    const { membership } = await requireActiveMembership();

    // Rate limit report access per org
    const rl = await rateLimit(`report:variance-trend:${membership.organizationId}`, RATE_LIMITS.report);
    if (!rl.ok) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    // Fetch completed stock counts from the last 90 days with their entries
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const completedCounts = await db.stockCount.findMany({
      where: {
        organizationId: membership.organizationId,
        state: "COMPLETED",
        completedAt: { gte: since },
      },
      select: {
        id: true,
        completedAt: true,
        entries: {
          select: {
            countedQty: true,
            snapshot: {
              select: {
                systemQty: true,
              },
            },
          },
        },
      },
      orderBy: { completedAt: "asc" },
    });

    // Group counts by date and calculate average variance per day
    const varianceByDate = new Map<string, { totalVariance: number; totalItems: number }>();

    for (const count of completedCounts) {
      if (!count.completedAt) continue;
      const dateStr = count.completedAt.toISOString().split("T")[0];

      let countVarianceSum = 0;
      let countItemCount = 0;

      for (const entry of count.entries) {
        const systemQty = entry.snapshot?.systemQty ?? 0;
        const countedQty = entry.countedQty;
        if (systemQty === 0 && countedQty === 0) continue;

        // Absolute variance percentage
        const denominator = systemQty || 1; // avoid division by zero
        const variancePct = Math.abs((countedQty - systemQty) / denominator) * 100;
        countVarianceSum += variancePct;
        countItemCount++;
      }

      const existing = varianceByDate.get(dateStr) ?? { totalVariance: 0, totalItems: 0 };
      existing.totalVariance += countVarianceSum;
      existing.totalItems += countItemCount;
      varianceByDate.set(dateStr, existing);
    }

    // Build trend data array
    const trendData = Array.from(varianceByDate.entries())
      .map(([date, { totalVariance, totalItems }]) => ({
        date,
        variance: totalItems > 0
          ? Number.parseFloat((totalVariance / totalItems).toFixed(2))
          : 0,
        countItems: totalItems,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // If no data, return empty array (UI will show "no data" state)
    return Response.json(trendData);
  } catch (error) {
    console.error("Get trend error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleExport(req: Request) {
  try {
    const body = await req.json();
    const { format, data } = ExportSchema.parse(body);

    if (format === "csv") {
      const csv = serializeCsv(data, [
        { header: "Date", value: (r) => r.date },
        { header: "Variance %", value: (r) => r.variance.toFixed(2) },
        { header: "Items Counted", value: (r) => r.countItems ?? "" },
      ]);
      return csvResponse(`variance-trend-${todayIsoDate()}.csv`, csv);
    }

    if (format === "xlsx") {
      const workbook = await buildExcelWorkbook("Variance Trend", data, [
        { header: "Date", key: "date", value: (r) => r.date, width: 12 },
        { header: "Variance %", key: "var", value: (r) => r.variance, width: 12, numFmt: "0.00%" },
        { header: "Items Counted", key: "items", value: (r) => r.countItems ?? 0, width: 14 },
      ]);
      return excelResponse(`variance-trend-${todayIsoDate()}.xlsx`, workbook);
    }

    return Response.json({ error: "Invalid format" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Export error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleGetTrend(req);
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  if (url.pathname.includes("/export")) {
    return handleExport(req);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
