import { db } from "@/lib/db";
import { headers } from "next/headers";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { verifyTotpCode, verifyBackupCode } from "@/lib/totp";

/**
 * POST /api/auth/two-factor/verify
 *
 * Verify a TOTP or backup code after email/password authentication.
 * This endpoint is called after Better Auth has verified email/password
 * but detected that 2FA is enabled for the user.
 *
 * Request body:
 *   {
 *     userId: string;
 *     code: string; // 6-digit TOTP or 8-char backup code
 *     sessionToken?: string; // pending session token from Better Auth
 *   }
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

    // Get client IP for rate limiting
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

    // Rate limit by IP + user combo
    const rateLimitKey = `auth:two_factor:${ip}:${userId}`;
    const rateLimitResult = await rateLimit(rateLimitKey, RATE_LIMITS.twoFactor);

    if (!rateLimitResult.ok) {
      const retryAfter = Math.max(0, rateLimitResult.reset - Math.floor(Date.now() / 1000));
      return new Response(
        JSON.stringify({ error: "Too many attempts", retryAfter }),
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
          },
        },
      );
    }

    // Get the user's 2FA configuration
    // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
    const twoFactorAuth = await db.twoFactorAuth.findUnique({
      where: { userId },
      select: {
        secret: true,
        backupCodes: true,
        enabled: true,
      },
    });

    if (!twoFactorAuth?.enabled) {
      return new Response(JSON.stringify({ error: "2FA not enabled for this user" }), {
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
    const backupResult = verifyBackupCode(backupCodesCopy, code);

    if (backupResult.valid) {
      // Update the backup codes (one was consumed)
      // @ts-expect-error - TwoFactorAuth model added in latest migration, Prisma client will be regenerated
      await db.twoFactorAuth.update({
        where: { userId },
        data: {
          backupCodes: backupCodesCopy,
        },
      });

      return new Response(JSON.stringify({ verified: true }), { status: 200 });
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
