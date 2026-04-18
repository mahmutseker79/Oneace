/**
 * @openapi-tag: /reports/low-stock/pdf
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
import { db } from "@/lib/db";
import { exportLowStockPdf } from "@/lib/export/pdf";
import { hasPlanCapability } from "@/lib/plans";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { requireActiveMembership } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const { membership } = await requireActiveMembership();

  // Rate limit export endpoint: 10 per hour per user
  const rl = await rateLimit(`export:${membership.userId}`, RATE_LIMITS.export);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "Export rate limit exceeded. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Phase 13.2 — exports require PRO or BUSINESS plan
  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({
        error:
          "Exports are available on Pro and Business plans. Upgrade to unlock PDF and Excel exports.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const items = await db.item.findMany({
    where: { organizationId: membership.organizationId, status: "ACTIVE" },
    select: {
      sku: true,
      name: true,
      reorderPoint: true,
      reorderQty: true,
      preferredSupplier: { select: { name: true } },
      stockLevels: { select: { quantity: true } },
    },
  });

  type ExportItem = {
    sku: string;
    name: string;
    supplierName: string;
    onHand: number;
    reorderPoint: number;
    shortfall: number;
    reorderQty: number;
  };

  const rows: ExportItem[] = items
    .map((item) => {
      const onHand = item.stockLevels.reduce((acc, l) => acc + l.quantity, 0);
      return {
        sku: item.sku,
        name: item.name,
        supplierName: item.preferredSupplier?.name ?? "",
        onHand,
        reorderPoint: item.reorderPoint,
        shortfall: item.reorderPoint - onHand,
        reorderQty: item.reorderQty,
      };
    })
    .filter((row) => row.reorderPoint > 0 && row.onHand <= row.reorderPoint)
    .sort((a, b) => b.shortfall - a.shortfall);

  const pdfBytes = await exportLowStockPdf({
    orgName: membership.organization.name,
    date: new Date(),
    items: rows,
  });

  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="oneace-low-stock-${today}.pdf"`,
    },
  });
}
