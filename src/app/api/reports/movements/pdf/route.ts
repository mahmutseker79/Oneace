import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { exportMovementHistoryPdf } from "@/lib/export/pdf";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET() {
  const { membership } = await requireActiveMembership();

  // Rate limit export endpoint: 10 per hour per user
  const rl = await rateLimit(`export:${membership.userId}`, RATE_LIMITS.export);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: "Export rate limit exceeded. Try again later." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
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

  // Fetch all stock movements, sorted by date descending
  const movements = await db.stockMovement.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      item: { select: { sku: true, name: true } },
      warehouse: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000, // Reasonable limit for report
  });

  type MovementRow = {
    sku: string;
    itemName: string;
    warehouseName: string;
    type: string;
    quantity: number;
    notes: string;
    date: string;
  };

  const rows: MovementRow[] = movements.map((mov) => ({
    sku: mov.item.sku,
    itemName: mov.item.name,
    warehouseName: mov.warehouse.name,
    type: mov.type,
    quantity: mov.quantity,
    notes: mov.note ?? "",
    date: new Date(mov.createdAt).toLocaleDateString(),
  }));

  const pdfBytes = await exportMovementHistoryPdf({
    orgName: membership.organization.name,
    date: new Date(),
    movements: rows,
  });

  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="oneace-movements-${today}.pdf"`,
    },
  });
}
