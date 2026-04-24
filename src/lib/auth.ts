import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getMailer } from "@/lib/mail";
import { buildResetPasswordEmail } from "@/lib/mail/templates/reset-password-email";
// GOD MODE roadmap 2026-04-23 — P2-03 per-email forgot-password
// rate limit. Uses the existing rate-limit helper so a single email
// address cannot be flooded with reset-link requests (anti-
// enumeration + anti-spam). Keyed on the lowercased email so case
// variations don't sidestep the bucket.
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

// Sprint 37: env vars are now read through the validated `env`
// module so a missing / malformed secret fails at boot instead of
// producing a cryptic 500 on the first real request.
export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // God-Mode v2 §1.2 — wire forgot-password end-to-end.
    //
    // Before this hook existed, Better Auth's `forgetPassword`
    // endpoint validated the request but had no way to actually
    // deliver a reset link — the user saw "check your inbox" but
    // never received an email. `sendResetPassword` is invoked by
    // Better Auth with the email address and a pre-signed URL that
    // contains the one-time token. We route it through `getMailer()`
    // which is a no-op console mailer in dev (prints the URL to
    // stdout so you can copy it into the browser) and Resend in
    // prod — identical flow either way.
    //
    // Failures here are logged but swallowed to keep the anti-
    // enumeration posture intact: the forgot-password form shows
    // the same "check your inbox" message regardless of whether
    // the email existed or delivery succeeded.
    sendResetPassword: async ({ user, url }) => {
      try {
        // P2-03: per-email throttle. The middleware default IP limit
        // already guards the endpoint, but IP alone is not enough —
        // a single attacker can flood ONE email from many IPs, and
        // a shared-NAT victim can also hit the default limit
        // benignly. Email-keyed throttle is the right dimension for
        // the "please stop spamming my inbox" concern.
        //
        // We DO NOT branch the user-facing UX on this — the form
        // still shows the same "check your inbox" message whether
        // the send succeeded, failed, or was throttled (anti-
        // enumeration posture intact). We just skip the actual
        // send.
        const emailKey = `forgot-password:${user.email.trim().toLowerCase()}`;
        const gate = await rateLimit(emailKey, RATE_LIMITS.forgotPassword);
        if (!gate.ok) {
          // `reset` is the UTC unix-seconds window-rollover timestamp;
          // operators can compute retry-after from it if needed.
          logger.warn("forgot-password throttled (P2-03 per-email gate)", {
            email: user.email,
            reset: gate.reset,
          });
          return;
        }

        const appOrigin =
          env.NEXT_PUBLIC_APP_URL?.trim() || env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
        const message = buildResetPasswordEmail({
          to: user.email,
          resetUrl: url,
          appOrigin,
        });
        const mailer = getMailer();
        await mailer.send({
          to: user.email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      } catch (error) {
        logger.error("Failed to send password reset email", {
          email: user.email,
          error: error instanceof Error ? error.message : String(error),
        });
        // Deliberately swallow — see comment above. The UX path
        // must be identical whether the send succeeded, failed,
        // or the address didn't exist.
      }
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days (reduced from 30 for security)
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      // Extend here with locale, timezone, etc. as profile fields grow.
    },
  },
  trustedOrigins: [
    env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    env.BETTER_AUTH_URL,
    // Faz 3 cutover — BOTH origins are trusted during the Vercel → Netlify
    // migration window. Once DNS is flipped and Vercel project is paused,
    // the vercel.app entry can stay (it's a no-op, just a dead origin) or
    // be removed in a later cleanup. Keeping both is safe: better-auth
    // only accepts origins that the browser actually sent, so a dead
    // domain in this list has no security impact.
    //
    // Rationale: `NEXT_PUBLIC_APP_URL` is set in prod env, so the fallback
    // below is only used in local/dev or when the env var is missing. But
    // during the cutover window, if the env var lags the DNS flip even
    // briefly, we don't want better-auth to start rejecting sessions.
    ...(env.NEXT_PUBLIC_APP_URL
      ? []
      : ["https://oneace-next-local.vercel.app", "https://oneace-next-local.netlify.app"]),
  ].filter(Boolean) as string[],
});

export type Session = typeof auth.$Infer.Session;
