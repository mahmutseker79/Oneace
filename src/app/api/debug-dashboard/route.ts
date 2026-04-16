import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { membership } = await requireActiveMembership();
    const orgId = membership.organizationId;
    const results: Record<string, string> = {};

    // Test each query individually
    try {
      await db.item.count({ where: { organizationId: orgId, status: "ACTIVE" } });
      results["item.count"] = "OK";
    } catch (e: unknown) { results["item.count"] = String(e); }

    try {
      await db.warehouse.count({ where: { organizationId: orgId } });
      results["warehouse.count"] = "OK";
    } catch (e: unknown) { results["warehouse.count"] = String(e); }

    try {
      await db.stockCount.count({ where: { organizationId: orgId, state: "OPEN" } });
      results["stockCount.count"] = "OK";
    } catch (e: unknown) { results["stockCount.count"] = String(e); }

    try {
      await db.stockMovement.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          item: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
      results["stockMovement.findMany"] = "OK";
    } catch (e: unknown) { results["stockMovement.findMany"] = String(e); }

    try {
      await db.$queryRaw`SELECT 1 as test`;
      results["rawQuery"] = "OK";
    } catch (e: unknown) { results["rawQuery"] = String(e); }

    try {
      await db.$queryRaw`
        SELECT COALESCE(SUM(sl.quantity * COALESCE(i."costPrice", 0)), 0)::float as "stockValue"
        FROM "StockLevel" sl
        JOIN "Item" i ON i.id = sl."itemId"
        WHERE sl."organizationId" = ${orgId}
      `;
      results["stockValue.raw"] = "OK";
    } catch (e: unknown) { results["stockValue.raw"] = String(e); }

    try {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      await db.stockMovement.findMany({
        where: { organizationId: orgId, createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true, type: true, quantity: true },
        take: 1,
      });
      results["trendMovements"] = "OK";
    } catch (e: unknown) { results["trendMovements"] = String(e); }

    try {
      await db.$queryRaw`
        SELECT i.id, i.name, i.sku, i."reorderPoint", s.name as "preferredSupplierName",
          COALESCE(SUM(sl.quantity), 0)::int as "onHand"
        FROM "Item" i
        LEFT JOIN "Supplier" s ON s.id = i."preferredSupplierId"
        LEFT JOIN "StockLevel" sl ON sl."itemId" = i.id AND sl."organizationId" = i."organizationId"
        WHERE i."organizationId" = ${orgId}
          AND i.status = 'ACTIVE'
          AND i."reorderPoint" > 0
        GROUP BY i.id, i.name, i.sku, i."reorderPoint", s.name
        HAVING COALESCE(SUM(sl.quantity), 0) <= i."reorderPoint"
        ORDER BY COALESCE(SUM(sl.quantity), 0) ASC
        LIMIT 5
      `;
      results["lowStock.raw"] = "OK";
    } catch (e: unknown) { results["lowStock.raw"] = String(e); }

    return NextResponse.json(results);
  } catch (e: unknown) {
    return NextResponse.json({ auth: String(e) }, { status: 500 });
  }
}
