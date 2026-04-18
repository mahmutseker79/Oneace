/**
 * @openapi-tag: /auth/[...all]
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
// Phase 7C: registration gate + rate limiting.
//
// Better Auth's `toNextJsHandler` produces a { GET, POST } pair that
// forwards every `/api/auth/*` request to the Better Auth router.
// When `REGISTRATION_ENABLED` is `false`, we wrap the POST handler so
// that any request whose path ends in `/sign-up/email` gets a 403
// before Better Auth ever sees it.
//
// Why wrap POST rather than conditionally setting
// `emailAndPassword.enabled` in auth.ts?
//   - Better Auth reads that flag once at module load. Toggling it
//     requires a server restart, which is fine — env vars take effect
//     on deploy. But the flag also disables the *login* codepath for
//     email+password, which breaks existing sessions. Wrapping the
//     route handler is strictly narrower: it blocks sign-up while
//     leaving sign-in, session refresh, and every other auth endpoint
//     intact.
//
// Why 403 and not 404?
//   - A 404 would imply the endpoint doesn't exist, which confuses
//     client-side error handling in the register form. A 403 clearly
//     says "this action is not allowed right now" and the client can
//     surface a useful message.

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { GET, POST: betterAuthPost } = toNextJsHandler(auth.handler);

async function gatedPost(request: NextRequest) {
  // Extract IP for rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const pathname = new URL(request.url).pathname;

  // Rate limit sign-in: 5 attempts per 5 minutes per IP
  if (pathname.includes("/sign-in")) {
    const rl = await rateLimit(`login:ip:${ip}`, { max: 5, windowSeconds: 300 });
    if (!rl.ok) {
      logger.warn("Login rate limit exceeded", {
        tag: "auth.rate-limit",
        ip,
      });
      return NextResponse.json(
        {
          message: "Too many login attempts. Please try again later.",
          code: "LOGIN_RATE_LIMIT",
        },
        { status: 429, headers: { "Retry-After": String(rl.reset) } },
      );
    }
  }

  // Rate limit sign-up: per-IP AND per-email to prevent distributed attacks
  if (pathname.includes("/sign-up")) {
    // Per-IP: 3 registrations per hour
    const ipRl = await rateLimit(`register:ip:${ip}`, { max: 3, windowSeconds: 3600 });
    if (!ipRl.ok) {
      logger.warn("Registration rate limit exceeded (IP)", { tag: "auth.rate-limit", ip });
      return NextResponse.json(
        {
          message: "Too many registration attempts. Please try again later.",
          code: "REGISTER_RATE_LIMIT_IP",
        },
        { status: 429, headers: { "Retry-After": String(ipRl.reset) } },
      );
    }

    // Per-email: 2 registrations per hour (prevents email spam from multiple IPs)
    try {
      const body = await request.clone().json();
      const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : null;
      if (email) {
        const emailRl = await rateLimit(`register:email:${email}`, { max: 2, windowSeconds: 3600 });
        if (!emailRl.ok) {
          logger.warn("Registration rate limit exceeded (email)", {
            tag: "auth.rate-limit",
            email: email.replace(/@.*/, "@***"),
          });
          return NextResponse.json(
            {
              message:
                "Too many registration attempts for this email. Please try again later.",
              code: "REGISTER_RATE_LIMIT_EMAIL",
            },
            { status: 429, headers: { "Retry-After": String(emailRl.reset) } },
          );
        }
      }
    } catch {
      // If body parsing fails, continue with IP-only rate limiting
    }
  }

  // The sign-up endpoint path in Better Auth's default router is
  // `/api/auth/sign-up/email`. We match on the trailing segment so
  // a future `basePath` change doesn't silently bypass the gate.
  if (!env.REGISTRATION_ENABLED && request.nextUrl.pathname.endsWith("/sign-up/email")) {
    logger.warn("registration gate: blocked sign-up attempt while REGISTRATION_ENABLED=false", {
      tag: "auth.registration-gate",
      ip,
    });
    return NextResponse.json(
      {
        message:
          "Registration is currently closed. Please contact your administrator for an invitation.",
      },
      { status: 403 },
    );
  }
  return betterAuthPost(request);
}

export { GET, gatedPost as POST };
