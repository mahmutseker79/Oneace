import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { requireActiveMembership } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

// P3-3 (audit v1.1 §5.30) — explicit phrase schema. The literal
// "DELETE MY ACCOUNT" is the dead-man's switch; anything else is
// a 400. Using zod instead of an inline equality check means a
// typo in the string is caught at parse time with a clear error,
// and the whole schema is discoverable for the pinned test.
const PHRASE = "DELETE MY ACCOUNT";
const deleteBodySchema = z.object({
  confirmation: z.literal(PHRASE),
});

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
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(0, result.reset - Math.floor(Date.now() / 1000))),
          },
        },
      );
    }

    // Parse and validate confirmation phrase — §5.30: zod schema
    // above replaces the inline equality check. `safeParse` returns a
    // structured result so we can distinguish "missing field" from
    // "wrong phrase" (both 400, but the error body differs).
    const raw = await request.json().catch(() => ({}));
    const parsed = deleteBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid confirmation phrase",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
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
          error:
            "Cannot delete account while you are the owner of an organization. Transfer ownership first.",
          ownedOrganizations: ownedOrgs.map((m) => m.organizationId),
        },
        { status: 403 },
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
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    logger.error("Account deletion failed:", { error: err });
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
