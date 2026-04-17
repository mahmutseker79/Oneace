/**
 * Phase D — Count Comparison Report API
 *
 * GET /api/reports/count-comparison/counts — List available counts
 * POST /api/reports/count-comparison/compare — Compare two counts
 * POST /api/reports/count-comparison/export — Export comparison
 */

import { z } from "zod";

import { csvResponse, serializeCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { buildExcelWorkbook, excelResponse, todayIsoDate } from "@/lib/excel";
import { requireActiveMembership } from "@/lib/session";

const CompareSchema = z.object({
  count1Id: z.string().cuid(),
  count2Id: z.string().cuid(),
});

const ExportSchema = z.object({
  format: z.enum(["csv", "xlsx"]),
  comparison: z.array(z.any()),
  count1Name: z.string(),
  count2Name: z.string(),
});

/**
 * GET /api/reports/count-comparison/counts
 * List all completed/in-progress stock counts
 */
async function handleGetCounts(_req?: Request) {
  try {
    const { membership } = await requireActiveMembership();

    const counts = await db.stockCount.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
        name: true,
        state: true,
        createdAt: true,
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json(
      counts.map((c) => ({
        id: c.id,
        name: c.name,
        state: c.state,
        createdAt: c.createdAt,
        itemCount: c._count.entries,
      })),
    );
  } catch (error) {
    console.error("Get counts error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/reports/count-comparison/compare
 * Compare two stock counts
 */
async function handleCompare(req: Request) {
  try {
    const { membership } = await requireActiveMembership();
    const body = await req.json();
    const { count1Id, count2Id } = CompareSchema.parse(body);

    // Fetch both counts
    const [count1, count2] = await Promise.all([
      db.stockCount.findUnique({
        where: { id: count1Id },
        include: {
          entries: {
            select: {
              itemId: true,
              countedQuantity: true,
              item: { select: { sku: true, name: true } },
            },
          },
        },
      }),
      db.stockCount.findUnique({
        where: { id: count2Id },
        include: {
          entries: {
            select: {
              itemId: true,
              countedQuantity: true,
              item: { select: { sku: true, name: true } },
            },
          },
        },
      }),
    ]);

    if (!count1 || !count2) {
      return Response.json({ error: "Count not found" }, { status: 404 });
    }

    // Verify ownership
    if (
      count1.organizationId !== membership.organizationId ||
      count2.organizationId !== membership.organizationId
    ) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Build comparison map
    const count1Map = new Map(
      count1.entries.map((e) => [
        e.itemId,
        {
          sku: e.item.sku,
          name: e.item.name,
          qty: e.countedQuantity,
        },
      ]),
    );

    const count2Map = new Map(
      count2.entries.map((e) => [
        e.itemId,
        {
          sku: e.item.sku,
          name: e.item.name,
          qty: e.countedQuantity,
        },
      ]),
    );

    // Merge all items
    const allItemIds = new Set([...count1Map.keys(), ...count2Map.keys()]);

    const comparison = Array.from(allItemIds)
      .map((itemId) => {
        const item1 = count1Map.get(itemId);
        const item2 = count2Map.get(itemId);

        const qty1 = item1?.qty ?? null;
        const qty2 = item2?.qty ?? null;
        const sku = item1?.sku ?? item2?.sku ?? "?";
        const name = item1?.name ?? item2?.name ?? "Unknown";

        let variance = 0;
        let variancePercent = 0;

        if (qty1 !== null && qty2 !== null) {
          variance = qty2 - qty1;
          variancePercent = qty1 > 0 ? (variance / qty1) * 100 : 0;
        }

        return {
          itemId,
          sku,
          name,
          count1Qty: qty1,
          count2Qty: qty2,
          variance,
          variancePercent,
        };
      })
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    return Response.json(comparison);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Compare error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/reports/count-comparison/export
 * Export comparison as CSV or XLSX
 */
async function handleExport(req: Request) {
  try {
    // Auth check — export requires active membership
    await requireActiveMembership();

    const body = await req.json();
    const { format, comparison, count1Name, count2Name } = ExportSchema.parse(body);

    if (format === "csv") {
      const csv = serializeCsv(comparison, [
        { header: "SKU", value: (r: Record<string, unknown>) => r.sku as string },
        { header: "Name", value: (r: Record<string, unknown>) => r.name as string },
        {
          header: count1Name || "Count 1",
          value: (r: Record<string, unknown>) => (r.count1Qty ?? "") as string | number | null,
        },
        {
          header: count2Name || "Count 2",
          value: (r: Record<string, unknown>) => (r.count2Qty ?? "") as string | number | null,
        },
        { header: "Variance", value: (r: Record<string, unknown>) => r.variance as number },
        {
          header: "Variance %",
          value: (r: Record<string, unknown>) => (r.variancePercent as number).toFixed(1),
        },
      ]);
      return csvResponse(`count-comparison-${todayIsoDate()}.csv`, csv);
    }

    if (format === "xlsx") {
      const workbook = await buildExcelWorkbook("Count Comparison", comparison, [
        {
          header: "SKU",
          key: "sku",
          value: (r: Record<string, unknown>) => r.sku as string,
          width: 12,
        },
        {
          header: "Name",
          key: "name",
          value: (r: Record<string, unknown>) => r.name as string,
          width: 25,
        },
        {
          header: count1Name || "Count 1",
          key: "c1",
          value: (r: Record<string, unknown>) => (r.count1Qty ?? "") as string | number | null,
          width: 10,
        },
        {
          header: count2Name || "Count 2",
          key: "c2",
          value: (r: Record<string, unknown>) => (r.count2Qty ?? "") as string | number | null,
          width: 10,
        },
        {
          header: "Variance",
          key: "var",
          value: (r: Record<string, unknown>) => r.variance as number,
          width: 10,
        },
        {
          header: "Variance %",
          key: "varpct",
          value: (r: Record<string, unknown>) => r.variancePercent as number,
          width: 10,
          numFmt: "0.0%",
        },
      ]);
      return excelResponse(`count-comparison-${todayIsoDate()}.xlsx`, workbook);
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
  const url = new URL(req.url);

  if (url.pathname.includes("/counts")) {
    return handleGetCounts(req);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  if (url.pathname.includes("/compare")) {
    return handleCompare(req);
  }

  if (url.pathname.includes("/export")) {
    return handleExport(req);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
