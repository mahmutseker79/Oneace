import { db } from "@/lib/db";
import { exportBinInventoryPdf } from "@/lib/export/pdf";
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

  // Bins are a PRO+ feature
  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "bins")) {
    return new Response(
      JSON.stringify({
        error:
          "Bin features are available on Pro and Business plans. Upgrade to unlock this report.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  // Fetch stock levels with bin and item details
  const stockLevels = await db.stockLevel.findMany({
    where: {
      organizationId: membership.organizationId,
      binId: { not: null }, // Only bin-tracked stock
      quantity: { gt: 0 },
    },
    include: {
      warehouse: { select: { id: true, name: true } },
      bin: { select: { id: true, code: true } },
      item: { select: { sku: true, name: true } },
    },
    orderBy: [{ warehouse: { name: "asc" } }, { bin: { code: "asc" } }, { item: { name: "asc" } }],
  });

  type BinData = {
    code: string;
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
    }>;
  };

  type LocationData = {
    name: string;
    bins: BinData[];
  };

  // Group by warehouse, then bin
  const locationsMap = new Map<string, LocationData>();

  for (const level of stockLevels) {
    if (!level.bin || !level.warehouse) continue;

    const warehouseKey = level.warehouse.id;
    let location = locationsMap.get(warehouseKey);
    if (!location) {
      location = {
        name: level.warehouse.name,
        bins: [],
      };
      locationsMap.set(warehouseKey, location);
    }

    let bin = location.bins.find((b) => b.code === level.bin?.code);
    if (!bin) {
      bin = { code: level.bin.code, items: [] };
      location.bins.push(bin);
    }

    bin.items.push({
      sku: level.item.sku,
      name: level.item.name,
      quantity: level.quantity,
    });
  }

  const locations = Array.from(locationsMap.values());

  const pdfBytes = await exportBinInventoryPdf({
    orgName: membership.organization.name,
    date: new Date(),
    locations,
  });

  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="oneace-bin-inventory-${today}.pdf"`,
    },
  });
}
