/**
 * Phase D — Department Variance Report API
 *
 * GET /api/reports/department-variance — Get variance data by department
 * POST /api/reports/department-variance/export — Export variance data
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

async function handleGetVariance(_req?: Request) {
  try {
    const { membership } = await requireActiveMembership();

    // Rate limit report access per org
    const rl = await rateLimit(`report:dept-variance:${membership.organizationId}`, RATE_LIMITS.report);
    if (!rl.ok) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    // Fetch all departments with their items
    const departments = await db.department.findMany({
      where: {
        organizationId: membership.organizationId,
        isActive: true,
      },
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

    // Fetch all count entries for variance calculation
    const counts = await db.countEntry.findMany({
      where: {
        count: { organizationId: membership.organizationId },
      },
      select: {
        itemId: true,
        countedQuantity: true,
        item: { select: { departmentId: true } },
      },
    });

    // Calculate variance per department
    const varianceData = departments.map((dept) => {
      // Get items in this department
      const deptItems = dept.items;

      if (deptItems.length === 0) {
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          itemCount: 0,
          variance: 0,
          variancePercent: 0,
          status: "good" as const,
        };
      }

      // Calculate current quantities
      let currentQty = 0;
      let countedQty = 0;

      for (const item of deptItems) {
        const onHand = item.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
        currentQty += onHand;

        // Find counted quantity from latest count
        const counted =
          counts.find((c: (typeof counts)[number]) => c.itemId === item.id)?.countedQuantity || 0;
        countedQty += counted;
      }

      const variance = countedQty - currentQty;
      const variancePercent = currentQty > 0 ? (Math.abs(variance) / currentQty) * 100 : 0;

      let status: "good" | "warning" | "critical" = "good";
      if (variancePercent > 10) {
        status = "critical";
      } else if (variancePercent > 5) {
        status = "warning";
      }

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        itemCount: deptItems.length,
        variance,
        variancePercent,
        status,
      };
    });

    return Response.json(varianceData);
  } catch (error) {
    console.error("Get variance error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function handleExport(req: Request) {
  try {
    const body = await req.json();
    const { format, data } = ExportSchema.parse(body);

    if (format === "csv") {
      const csv = serializeCsv(data, [
        { header: "Department", value: (r: Record<string, unknown>) => r.departmentName as string },
        { header: "Items", value: (r: Record<string, unknown>) => r.itemCount as number },
        { header: "Variance", value: (r: Record<string, unknown>) => r.variance as number },
        {
          header: "Variance %",
          value: (r: Record<string, unknown>) => (r.variancePercent as number).toFixed(2),
        },
        { header: "Status", value: (r: Record<string, unknown>) => r.status as string },
      ]);
      return csvResponse(`department-variance-${todayIsoDate()}.csv`, csv);
    }

    if (format === "xlsx") {
      const workbook = await buildExcelWorkbook("Department Variance", data, [
        {
          header: "Department",
          key: "dept",
          value: (r: Record<string, unknown>) => r.departmentName as string,
          width: 20,
        },
        {
          header: "Items",
          key: "items",
          value: (r: Record<string, unknown>) => r.itemCount as number,
          width: 10,
        },
        {
          header: "Variance",
          key: "var",
          value: (r: Record<string, unknown>) => r.variance as number,
          width: 12,
        },
        {
          header: "Variance %",
          key: "varpct",
          value: (r: Record<string, unknown>) => r.variancePercent as number,
          width: 12,
          numFmt: "0.00%",
        },
        {
          header: "Status",
          key: "status",
          value: (r: Record<string, unknown>) => r.status as string,
          width: 10,
        },
      ]);
      return excelResponse(`department-variance-${todayIsoDate()}.xlsx`, workbook);
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
  return handleGetVariance(req);
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  if (url.pathname.includes("/export")) {
    return handleExport(req);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
