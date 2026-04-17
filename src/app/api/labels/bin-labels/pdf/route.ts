import { db } from "@/lib/db";
import { generateBinLabelsPdf } from "@/lib/labels/bin-label-pdf";
import { requireActiveMembership } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { membership } = await requireActiveMembership();

  // Get warehouseId from query params
  const url = new URL(request.url);
  const warehouseId = url.searchParams.get("warehouseId");

  if (!warehouseId) {
    return new Response(
      JSON.stringify({
        error: "warehouseId query parameter is required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Verify the warehouse belongs to the organization
  const warehouse = await db.warehouse.findFirst({
    where: {
      id: warehouseId,
      organizationId: membership.organizationId,
    },
    select: { id: true, name: true },
  });

  if (!warehouse) {
    return new Response(
      JSON.stringify({
        error: "Warehouse not found",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // Fetch all bins for this warehouse
  const bins = await db.bin.findMany({
    where: { warehouseId },
    select: { code: true },
    orderBy: { code: "asc" },
  });

  if (bins.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No bins found for this warehouse",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Generate PDF with bin labels
  const labels = bins.map((bin) => ({
    binCode: bin.code,
    warehouseName: warehouse.name,
  }));

  const pdfBytes = generateBinLabelsPdf(labels);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `bin-labels-${warehouse.name.replace(/\s+/g, "-")}-${today}.pdf`;

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
