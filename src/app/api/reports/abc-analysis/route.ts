/**
 * Phase D — ABC Analysis Report API
 *
 * POST /api/reports/abc-analysis — Get ABC classification data
 * POST /api/reports/abc-analysis/export — Export ABC report
 * POST /api/reports/abc-analysis/classify — Auto-classify items
 */

import { z } from "zod";

import { csvResponse, serializeCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { buildExcelWorkbook, excelResponse, todayIsoDate } from "@/lib/excel";
import { hasCapability } from "@/lib/permissions";
import { hasPlanCapability } from "@/lib/plans";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { calculateABC } from "@/lib/reports/abc-calculator";
import { requireActiveMembership } from "@/lib/session";

const GetABCSchema = z.object({
  orgId: z.string().cuid(),
});

const ExportABCSchema = z.object({
  format: z.enum(["csv", "xlsx", "pdf"]),
  data: z.array(
    z.object({
      itemId: z.string(),
      sku: z.string(),
      name: z.string(),
      quantity: z.number(),
      costPrice: z.number(),
      totalValue: z.number(),
      classification: z.enum(["A", "B", "C"]),
      percentageOfTotalValue: z.number(),
      cumulativePercentage: z.number(),
    }),
  ),
});

const ClassifySchema = z.object({
  orgId: z.string().cuid(),
});

/**
 * GET /api/reports/abc-analysis
 * Returns ABC classification data for all active items
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  try {
    const { membership } = await requireActiveMembership();

    // Rate limit report access per org
    const rl = await rateLimit(`report:abc-analysis:${membership.organizationId}`, RATE_LIMITS.report);
    if (!rl.ok) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    // Check plan capability
    const plan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
    if (!hasPlanCapability(plan, "abcAnalysis")) {
      return Response.json(
        { error: "ABC analysis is not available on your plan" },
        { status: 403 },
      );
    }

    // Handle classify endpoint
    if (pathname.includes("/classify")) {
      const body = await req.json();
      const { orgId } = ClassifySchema.parse(body);

      // Verify org ownership
      if (orgId !== membership.organizationId) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Check permission
      if (!hasCapability(membership.role, "reports.abcClassify")) {
        return Response.json({ error: "Permission denied" }, { status: 403 });
      }

      // Fetch all items with stock levels
      const items = await db.item.findMany({
        where: {
          organizationId: orgId,
          status: "ACTIVE",
        },
        include: {
          stockLevels: { select: { quantity: true } },
        },
      });

      // Calculate ABC
      const withQuantity = items.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        costPrice: item.costPrice,
        quantity: item.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0),
      }));

      const abcResults = calculateABC(withQuantity);

      // Batch update items
      const updatePromises = abcResults.map((result) =>
        db.item.update({
          where: { id: result.itemId },
          data: { abcClass: result.classification },
        }),
      );

      await Promise.all(updatePromises);

      return Response.json({
        success: true,
        updated: abcResults.length,
      });
    }

    // Handle export endpoint
    if (pathname.includes("/export")) {
      const body = await req.json();
      const { format, data } = ExportABCSchema.parse(body);

      if (format === "csv") {
        const csv = serializeCsv(data, [
          { header: "SKU", value: (r) => r.sku },
          { header: "Name", value: (r) => r.name },
          { header: "Qty", value: (r) => r.quantity },
          { header: "Cost Price", value: (r) => r.costPrice },
          { header: "Total Value", value: (r) => r.totalValue },
          { header: "% of Total", value: (r) => r.percentageOfTotalValue.toFixed(2) },
          { header: "Cumulative %", value: (r) => r.cumulativePercentage.toFixed(1) },
          { header: "Class", value: (r) => r.classification },
        ]);
        return csvResponse(`abc-analysis-${todayIsoDate()}.csv`, csv);
      }

      if (format === "xlsx") {
        const workbook = await buildExcelWorkbook("ABC Analysis", data, [
          { header: "SKU", key: "sku", value: (r) => r.sku, width: 12 },
          { header: "Name", key: "name", value: (r) => r.name, width: 25 },
          { header: "Qty", key: "qty", value: (r) => r.quantity, width: 8 },
          {
            header: "Cost Price",
            key: "cost",
            value: (r) => r.costPrice,
            width: 12,
            numFmt: "$#,##0.00",
          },
          {
            header: "Total Value",
            key: "value",
            value: (r) => r.totalValue,
            width: 12,
            numFmt: "$#,##0.00",
          },
          {
            header: "% of Total",
            key: "pct",
            value: (r) => r.percentageOfTotalValue,
            width: 12,
            numFmt: "0.00%",
          },
          {
            header: "Cumulative %",
            key: "cum",
            value: (r) => r.cumulativePercentage,
            width: 12,
            numFmt: "0.0%",
          },
          { header: "Class", key: "class", value: (r) => r.classification, width: 8 },
        ]);
        return excelResponse(`abc-analysis-${todayIsoDate()}.xlsx`, workbook);
      }

      // PDF export would be more complex; for now return error
      return Response.json({ error: "PDF export not yet implemented" }, { status: 501 });
    }

    // Main GET — return ABC data
    const body = await req.json();
    const { orgId } = GetABCSchema.parse(body);

    // Verify org
    if (orgId !== membership.organizationId) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch all active items with stock levels
    const items = await db.item.findMany({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
      },
      include: {
        stockLevels: { select: { quantity: true } },
      },
    });

    // Prepare data for ABC calculation
    const withQuantity = items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      costPrice: item.costPrice,
      quantity: item.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0),
    }));

    // Calculate ABC
    const abcResults = calculateABC(withQuantity);

    return Response.json(abcResults);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("ABC analysis error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
