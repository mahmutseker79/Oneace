/**
 * @openapi-tag: /account/sessions/{id}/revoke
 *
 * v1.2 P2 §5.39 — revoke one specific session by id.
 *
 * Guards (non-negotiable):
 *   - `requireSession` — unauthenticated request → 401.
 *   - ownership check — a user can only revoke a row whose
 *     `userId` matches their own. A mismatch returns 404 on purpose
 *     (not 403): the caller should not be able to probe whether a
 *     session id belongs to another user.
 *   - self-revoke guard — the caller cannot revoke the session that
 *     authenticated the request. That's a sign-out, not a revoke,
 *     and going through this route would strand the cookie. Return
 *     400 with a dedicated `code` so the UI can disable the row.
 *   - rate limit — 10 revokes per minute per user. A legitimate
 *     user will revoke a handful of devices; a stolen-session
 *     script would blow through this.
 *
 * docs/openapi.yaml must declare `/account/sessions/{id}/revoke` —
 * openapi-parity.test.ts pins that link.
 */
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const currentSessionId = session.session.id;

    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing session id" }, { status: 400 });
    }

    const rate = await rateLimit(`account:sessions:revoke:${userId}`, {
      max: 10,
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

    // Self-revoke guard — see header. Returned with a dedicated code
    // so the UI can render the current row as "This device" and
    // avoid calling the endpoint at all.
    if (id === currentSessionId) {
      return NextResponse.json(
        {
          error: "Cannot revoke the current session via this endpoint — sign out instead.",
          code: "CURRENT_SESSION",
        },
        { status: 400 },
      );
    }

    // Ownership check. We scope the delete by (id, userId) so a
    // guessed id belonging to another user returns 404.
    const result = await db.session.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Best-effort audit record. `organizationId` is required by the
    // helper, so we attach the caller's first active org if any; if
    // the caller has no membership (stolen-laptop scenario) we skip
    // the audit rather than fail the revocation.
    try {
      const membership = await db.membership.findFirst({
        where: { userId, deactivatedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (membership) {
        await recordAudit({
          organizationId: membership.organizationId,
          actorId: userId,
          action: "account.session_revoked",
          entityType: "session",
          entityId: id,
        });
      }
    } catch (auditErr) {
      logger.warn("Session revoke audit write failed (non-fatal)", {
        error: auditErr,
        userId,
        sessionId: id,
      });
    }

    return NextResponse.json({ ok: true, revokedId: id }, { status: 200 });
  } catch (err) {
    logger.error("Session revoke failed", { error: err });
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}
