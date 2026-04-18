/**
 * @openapi-tag: /account/sessions/revoke-all
 *
 * v1.2 P2 §5.39 — revoke every session EXCEPT the caller's current
 * one. The call doesn't sign out the device that initiated it —
 * that would strand the user with no working cookie and no UI to
 * recover. Users who want to end the current session too should
 * follow up with a sign-out.
 *
 * Guards:
 *   - `requireSession` — unauthenticated → 401.
 *   - rate limit — 5 per hour per user. Legitimate use is "I got
 *     a phishing scare, kill everything else once"; 5/h lets the
 *     user retry after a 500 without opening a spam surface.
 *   - atomic delete — a single `deleteMany` with a NOT filter.
 *
 * The response reports the count so the UI can render
 * "Revoked 3 sessions." docs/openapi.yaml declares the path.
 */
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const currentSessionId = session.session.id;

    const rate = await rateLimit(`account:sessions:revoke-all:${userId}`, {
      max: 5,
      windowSeconds: 3600,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 5 per hour." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(0, rate.reset - Math.floor(Date.now() / 1000))),
          },
        },
      );
    }

    const result = await db.session.deleteMany({
      where: { userId, NOT: { id: currentSessionId } },
    });

    // Best-effort audit — same pattern as the single-revoke route.
    try {
      const membership = await db.membership.findFirst({
        where: { userId, deactivatedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (membership) {
        await recordAudit({
          organizationId: membership.organizationId,
          actorId: userId,
          action: "account.all_sessions_revoked",
          entityType: "session",
          entityId: currentSessionId,
        });
      }
    } catch (auditErr) {
      logger.warn("Session revoke-all audit write failed (non-fatal)", {
        error: auditErr,
        userId,
      });
    }

    return NextResponse.json(
      { ok: true, revokedCount: result.count, keptSessionId: currentSessionId },
      { status: 200 },
    );
  } catch (err) {
    logger.error("Session revoke-all failed", { error: err });
    return NextResponse.json({ error: "Failed to revoke sessions" }, { status: 500 });
  }
}
