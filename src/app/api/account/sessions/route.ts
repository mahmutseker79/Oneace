/**
 * @openapi-tag: /account/sessions
 *
 * v1.2 P2 §5.39 — Admin session revocation path.
 *
 * The account had no way to list active Better-Auth sessions, and
 * therefore no way to revoke an old device. The fix is three narrow
 * routes (list / revoke-one / revoke-all-others) anchored to the
 * Prisma `Session` model. Tenancy is per-user (not per-org), so we
 * deliberately do NOT go through `requireActiveMembership` — a user
 * with zero memberships must still be able to kill a stolen-laptop
 * session. `requireSession` is the right guard here.
 *
 * The doc/code parity rule from §5.32 applies: docs/openapi.yaml
 * MUST declare this path with every HTTP method exported here.
 * `src/lib/openapi-parity.test.ts` pins them in lockstep.
 */
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * GET /api/account/sessions
 *
 * List the caller's active Better-Auth sessions. Returns only the
 * metadata needed by the UI — id, userAgent, ipAddress, createdAt,
 * updatedAt, expiresAt, and a `current` flag indicating which row
 * matches the caller's own session cookie. The session `token` is
 * intentionally omitted: exposing it to any client (even the owner)
 * widens the blast radius of an XSS to "full account takeover".
 *
 * Rate limit: 30 per minute per user. High enough to support a noisy
 * refresh pattern in the UI without opening a metadata-scraping
 * vector for a rogue extension.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const currentSessionId = session.session.id;

    const rate = await rateLimit(`account:sessions:list:${userId}`, {
      max: 30,
      windowSeconds: 60,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(0, rate.reset - Math.floor(Date.now() / 1000))),
          },
        },
      );
    }

    const rows = await db.session.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });

    const sessions = rows.map((row) => ({
      ...row,
      current: row.id === currentSessionId,
    }));

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (err) {
    logger.error("Failed to list sessions", { error: err });
    return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 });
  }
}
