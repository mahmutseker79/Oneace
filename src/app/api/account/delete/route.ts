import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

/**
 * POST /api/account/delete
 *
 * GDPR account deletion endpoint. Requires confirmation phrase to prevent accidents.
 * - Rate limited: 1 per hour per user
 * - Rejects if user is OWNER of any organization
 * - Deletes: user's memberships, sessions, accounts, two-factor auth
 * - Does NOT delete: organization data (items, movements, etc. belong to the org)
 */
export async function POST(request: Request) {
  try {
    const { membership, session } = await requireActiveMembership();

    // Rate limit: max 1 deletion per hour per user
    const result = await rateLimit(`account:delete:${session.user.id}`, {
      max: 1,
      windowSeconds: 3600,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 1 deletion attempt per hour." },
        { status: 429, headers: { "Retry-After": String(Math.max(0, result.reset - Math.floor(Date.now() / 1000))) } }
      );
    }

    // Parse and validate confirmation phrase
    const body = await request.json().catch(() => ({}));
    const { confirmation } = body as { confirmation?: string };

    if (confirmation !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        { error: "Invalid confirmation phrase" },
        { status: 400 }
      );
    }

    // Check if user is OWNER of any organization
    const ownedOrgs = await db.membership.findMany({
      where: {
        userId: session.user.id,
        role: "OWNER",
      },
    });

    if (ownedOrgs.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete account while you are the owner of an organization. Transfer ownership first.",
          ownedOrganizations: ownedOrgs.map((m) => m.organizationId),
        },
        { status: 403 }
      );
    }

    // Record audit event before deletion
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "account.deleted",
      entityType: "membership",
      entityId: membership.id,
    });

    // Delete in transaction
    await db.$transaction([
      // Delete all memberships
      db.membership.deleteMany({
        where: { userId: session.user.id },
      }),
      // Delete all sessions
      db.session.deleteMany({
        where: { userId: session.user.id },
      }),
      // Delete all accounts (OAuth, etc.)
      db.account.deleteMany({
        where: { userId: session.user.id },
      }),
      // Delete two-factor auth if exists
      db.twoFactorAuth.deleteMany({
        where: { userId: session.user.id },
      }),
      // Finally, delete the user
      db.user.delete({
        where: { id: session.user.id },
      }),
    ]);

    return NextResponse.json(
      { ok: true, message: "Account deleted successfully. This action cannot be undone." },
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Account deletion failed:", err);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
