import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

/**
 * GET /api/account/export
 *
 * GDPR data export endpoint. Returns all user data as a JSON file.
 * Requires authentication and rate-limited to 2 per hour per user.
 */
export async function GET() {
  try {
    const { membership, session } = await requireActiveMembership();

    // Rate limit: max 2 exports per hour per user
    const result = await rateLimit(`account:export:${session.user.id}`, {
      max: 2,
      windowSeconds: 3600,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 2 exports per hour." },
        { status: 429, headers: { "Retry-After": String(Math.max(0, result.reset - Math.floor(Date.now() / 1000))) } }
      );
    }

    // Collect user profile first
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch all memberships BEFORE using them
    const memberships = await db.membership.findMany({
      where: { userId: session.user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            createdAt: true,
          },
        },
      },
    });

    const organizationIds = memberships.map((m) => m.organizationId);

    // Guard against excessive exports
    const MAX_EXPORT_ITEMS = 50_000;
    const itemCount = await db.item.count({
      where: { organizationId: { in: organizationIds } },
    });
    if (itemCount > MAX_EXPORT_ITEMS) {
      return NextResponse.json(
        { error: "Export too large. Contact support for bulk exports." },
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    // Items created by this user's org(s)
    const items = await db.item.findMany({
      where: { organizationId: { in: organizationIds } },
    });

    // Stock movements involving this user
    const stockMovements = await db.stockMovement.findMany({
      where: {
        organizationId: { in: organizationIds },
        createdByUserId: session.user.id,
      },
    });

    // Stock counts involving this user
    const stockCounts = await db.stockCount.findMany({
      where: {
        organizationId: { in: organizationIds },
        createdByUserId: session.user.id,
      },
    });

    // Count entries this user added
    const countEntries = await db.countEntry.findMany({
      where: {
        organizationId: { in: organizationIds },
        countedByUserId: session.user.id,
      },
    });

    // Purchase orders this user created
    const purchaseOrders = await db.purchaseOrder.findMany({
      where: {
        organizationId: { in: organizationIds },
        createdByUserId: session.user.id,
      },
    });

    // Audit events this user triggered
    const auditEvents = await db.auditEvent.findMany({
      where: {
        organizationId: { in: organizationIds },
        actorId: session.user.id,
      },
    });

    // Sessions
    const sessions = await db.session.findMany({
      where: { userId: session.user.id },
    });

    // Accounts (OAuth, etc.)
    const accounts = await db.account.findMany({
      where: { userId: session.user.id },
    });

    // Build the export object
    const exportData = {
      exportDate: new Date().toISOString(),
      user,
      memberships,
      items,
      stockMovements,
      stockCounts,
      countEntries,
      purchaseOrders,
      auditEvents,
      sessions,
      accounts,
    };

    // Record audit event
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "account.data_export",
      entityType: "membership",
      entityId: membership.id,
    });

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="oneace-data-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error("Data export failed:", err);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
