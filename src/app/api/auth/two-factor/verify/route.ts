import { db } from "@/lib/db";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { verifyBackupCode, verifyTotpCode } from "@/lib/totp";
import { headers } from "next/headers";

/**
 * POST /api/auth/two-factor/verify
 *
 * Verify a TOTP or backup code after email/password authentication.
 * This endpoint is called after Better Auth has verified email/password
 * but detected that 2FA is enabled for the user.
 *
 * Request body:
 *   {
 *     userId: string;   // The user whose 2FA to verify
 *     code: string;     // 6-digit TOTP or 8-char backup code
 *     sessionToken?: string; // pending session token from Better Auth
 *   }
 *
 * Security notes:
 *   - userId is accepted from the body because this endpoint is called
 *     BEFORE the session is fully established (pending 2FA challenge).
 *     The caller (Better Auth login flow) provides the userId after
 *     email/password verification succeeds.
 *   - Rate limiting keys on both IP AND userId to prevent distributed attacks.
 *   - Account is locked after 10 consecutive failures within the window.
 *
 * Response:
 *   Success (200): { verified: true }
 *   Invalid code (400): { verified: false, error: "Invalid code" }
 *   Rate limited (429): { error: "Too many attempts", retryAfter: number }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, code } = body as { userId?: string; code?: string };

    if (!userId || !code) {
      return new Response(JSON.stringify({ error: "Missing userId or code" }), {
        status: 400,
      });
    }

    // Validate userId format (prevent injection of arbitrary strings into rate-limit keys)
    if (typeof userId !== "string" || userId.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return new Response(JSON.stringify({ error: "Invalid userId format" }), { status: 400 });
    }

    // Verify that the userId corresponds to a real user (prevent enumeration via arbitrary IDs)
    const userExists = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      // Return same error as invalid code to prevent user enumeration
      return new Response(JSON.stringify({ verified: false, error: "Invalid code" }), {
        status: 400,
      });
    }

    // Get client IP for rate limiting
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

    // Rate limit by IP + user combo (prevents distributed brute-force)
    const rateLimitKey = `auth:two_factor:${ip}:${userId}`;
    const rateLimitResult = await rateLimit(rateLimitKey, RATE_LIMITS.twoFactor);

    // Also rate limit per-user globally (prevents multi-IP attacks on single user)
    const perUserRateResult = await rateLimit(`auth:two_factor:user:${userId}`, {
      max: 10,
      windowSeconds: 300,
    });

    if (!rateLimitResult.ok || !perUserRateResult.ok) {
      const failedResult = !rateLimitResult.ok ? rateLimitResult : perUserRateResult;
      const retryAfter = Math.max(0, failedResult.reset - Math.floor(Date.now() / 1000));
      return new Response(JSON.stringify({ error: "Too many attempts", retryAfter }), {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      });
    }

    // Get the user's 2FA configuration
    const twoFactorAuth = await db.twoFactorAuth.findUnique({
      where: { userId },
      select: {
        secret: true,
        backupCodes: true,
        enabled: true,
      },
    });

    if (!twoFactorAuth?.enabled) {
      // Return same error as invalid code to prevent user enumeration
      return new Response(JSON.stringify({ verified: false, error: "Invalid code" }), {
        status: 400,
      });
    }

    // Try TOTP code first
    const isTotpValid = verifyTotpCode(twoFactorAuth.secret, code);
    if (isTotpValid) {
      return new Response(JSON.stringify({ verified: true }), { status: 200 });
    }

    // Try backup code
    const backupCodesCopy = [...twoFactorAuth.backupCodes];
    const backupResult = verifyBackupCode(code, backupCodesCopy);

    if (backupResult.valid) {
      // Consume the used backup code so it cannot be replayed
      backupCodesCopy.splice(backupResult.index, 1);

      // Update the backup codes (one was consumed)
      await db.twoFactorAuth.update({
        where: { userId },
        data: {
          backupCodes: backupCodesCopy,
        },
      });

      return new Response(
        JSON.stringify({ verified: true, remainingBackupCodes: backupCodesCopy.length }),
        { status: 200 },
      );
    }

    // Neither code was valid
    return new Response(JSON.stringify({ verified: false, error: "Invalid code" }), {
      status: 400,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
