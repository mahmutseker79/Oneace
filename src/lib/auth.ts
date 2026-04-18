import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getMailer } from "@/lib/mail";
import { buildResetPasswordEmail } from "@/lib/mail/templates/reset-password-email";
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
    // Vercel preview/production domains
    ...(env.NEXT_PUBLIC_APP_URL ? [] : ["https://oneace-next-local.vercel.app"]),
  ].filter(Boolean) as string[],
});

export type Session = typeof auth.$Infer.Session;
