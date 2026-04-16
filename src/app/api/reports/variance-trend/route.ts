/**
 * Phase D — Variance Trend Report API
 *
 * GET /api/reports/variance-trend — Get variance trend data
 * POST /api/reports/variance-trend/export — Export trend data
 */

import { z } from "zod";

import { csvResponse, serializeCsv } from "@/lib/csv";
import { buildExcelWorkbook, excelResponse, todayIsoDate } from "@/lib/excel";
import { requireActiveMembership } from "@/lib/session";

const ExportSchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  data: z.array(z.any()),
});

async function handleGetTrend(_req: Request) {
  try {
    await requireActiveMembership();

    // Generate 30-day trend (synthetic for now, would come from historical snapshots)
    const trendData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      // Synthetic variance calculation: start at 8%, vary by day
      const baseVariance = 8;
      const noise = Math.sin(i / 5) * 3;
      const variance = Math.max(0, baseVariance + noise);

      trendData.push({
        date: dateStr,
        variance: Number.parseFloat(variance.toFixed(2)),
      });
    }

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
      ]);
      return csvResponse(`variance-trend-${todayIsoDate()}.csv`, csv);
    }

    if (format === "xlsx") {
      const workbook = await buildExcelWorkbook("Variance Trend", data, [
        { header: "Date", key: "date", value: (r) => r.date, width: 12 },
        { header: "Variance %", key: "var", value: (r) => r.variance, width: 12, numFmt: "0.00%" },
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
