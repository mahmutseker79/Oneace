// Phase 7C: registration gate.
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
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { GET, POST: betterAuthPost } = toNextJsHandler(auth.handler);

async function gatedPost(request: NextRequest) {
  // The sign-up endpoint path in Better Auth's default router is
  // `/api/auth/sign-up/email`. We match on the trailing segment so
  // a future `basePath` change doesn't silently bypass the gate.
  if (!env.REGISTRATION_ENABLED && request.nextUrl.pathname.endsWith("/sign-up/email")) {
    logger.warn("registration gate: blocked sign-up attempt while REGISTRATION_ENABLED=false", {
      tag: "auth.registration-gate",
      ip: request.headers.get("x-forwarded-for") ?? "unknown",
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
