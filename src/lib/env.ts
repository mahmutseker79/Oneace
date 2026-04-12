// Sprint 37: Centralised environment variable schema.
//
// Until this sprint, env vars were read directly at call sites via
// `process.env.FOO ?? "fallback"`. That worked through the early
// sprints — we were mostly prototyping against a single Neon branch —
// but it leaves us blind in two failure modes that become real the
// moment we ship to production:
//
//   1. **Missing required secrets**. `BETTER_AUTH_SECRET` with no
//      fallback would silently start the server with `undefined` as
//      the signing key, at which point login appears to work locally
//      but every request fails on the first deploy with a cryptic
//      500. We want the server to refuse to start instead.
//
//   2. **Typos in URLs**. A paste error in `DATABASE_URL` fails
//      lazily inside Prisma; a typo in `BETTER_AUTH_URL` fails with
//      a redirect loop. Both are discovered after users notice.
//
// The Zod schema below validates the process environment once, at
// module load, and throws a clearly-formatted error listing every
// failure. The validated result is frozen and exported as `env` —
// call sites should import `env` instead of touching `process.env`
// directly (the few existing call sites are migrated in this
// sprint's commit).
//
// Edge runtime note: this file is pure — no Node imports — so it is
// safe to `import { env }` from middleware, route handlers, server
// components, and server actions alike. The `NODE_ENV` defaulting
// mirrors Next's own convention so the schema stays stable whether
// the file is loaded from `next dev`, `next build`, or `next start`.

import { z } from "zod";

// Helper for optional URLs that should either be a valid URL or
// absent — an empty string is treated as "not set" so a blank
// line in `.env` doesn't trip the schema. Trailing slashes are
// not normalised here; call sites that care (e.g. redirect
// construction) strip them locally.
const optionalUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));

const schema = z.object({
  // --- Runtime selector -------------------------------------------------
  // Next.js sets this automatically; we accept the three values it
  // ever produces and default to "development" so type inference
  // stays concrete for consumers that branch on it.
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Database ---------------------------------------------------------
  // Both URLs are required. `DATABASE_URL` is the pooled connection
  // (PgBouncer on Neon); `DIRECT_URL` is the unpooled connection
  // used by Prisma for schema introspection and migrations. Missing
  // either of these makes the app non-functional, so we fail loud.
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid Postgres connection URL"),
  DIRECT_URL: z.string().url("DIRECT_URL must be a valid Postgres connection URL"),

  // --- Better Auth ------------------------------------------------------
  // `BETTER_AUTH_SECRET` is the HMAC signing key for session cookies.
  // A 32-character minimum is Better Auth's own advice and prevents
  // well-meaning devs from pasting in a 6-char placeholder. The URL
  // is used to mint absolute URLs in email flows and OAuth callbacks
  // (when we add them post-MVP).
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters (a strong random string)"),
  BETTER_AUTH_URL: z
    .string()
    .url("BETTER_AUTH_URL must be an absolute URL like https://app.example.com"),

  // --- Public client-side URL ------------------------------------------
  // `NEXT_PUBLIC_APP_URL` is embedded in the client bundle and used
  // both for absolute links in invitation emails and as the Better
  // Auth trusted-origin allowlist. Required in production; optional
  // in development so a fresh clone still boots.
  NEXT_PUBLIC_APP_URL: optionalUrl,

  // --- Mail (optional) --------------------------------------------------
  // Resend is the transport today. When unset, `src/lib/mail`
  // logs the message to stdout instead of sending — that's the
  // dev-loop behaviour we want to preserve. Both must either be
  // set together or omitted together; the superRefine below
  // enforces that pairing.
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().email("MAIL_FROM must be a valid email address").optional(),

  // --- Observability (optional, Sprint 37+) ----------------------------
  // `LOG_LEVEL` controls the structured logger threshold. Default
  // is "info" in production, "debug" everywhere else (applied in
  // the logger module, not here, so the default stays tied to the
  // runtime selector above rather than duplicated).
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

  // --- Registration gate (optional, Phase 7C) --------------------------
  // When `false`, the `/register` page redirects to `/login` and the
  // Better Auth sign-up endpoint returns 403. Defaults to `true` so
  // local dev and fresh clones boot without an extra env var. The
  // intended launch sequence is: deploy with `true` → create the
  // owner account → flip to `false` → all subsequent users join via
  // invitation only.
  REGISTRATION_ENABLED: z
    .enum(["true", "false", "1", "0"])
    .default("true")
    .transform((v) => v === "true" || v === "1"),

  // --- Rate limiting (optional, Phase 6A / P2) -------------------------
  // Upstash Redis REST credentials. When both are set, the
  // `src/lib/rate-limit.ts` helper switches to a Redis-backed sliding
  // window; otherwise it falls back to an in-process Map that is
  // best-effort only and explicitly NOT safe for multi-instance
  // deployments (see the warning emitted at startup in that module).
  // Both keys must be set together — the superRefine below enforces
  // the pairing with the same all-or-nothing rule used for the mail
  // pair, so a half-configured environment fails fast instead of
  // silently falling back.
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // --- Audit retention (Sprint 40) -------------------------------------
  // Number of days to retain `AuditEvent` rows. Consumed by the
  // `src/scripts/prune-audit.ts` housekeeping script (`npm run
  // audit:prune`) which deletes older rows in batches and logs a
  // single aggregate `audit.pruned` row back to the audit log.
  //
  // Default 365 because one year is the minimum retention window
  // most compliance regimes (SOX / HIPAA / GDPR Article 30) tolerate
  // without a specific exemption — shorter windows should be an
  // explicit, reviewed decision rather than an accidental default.
  // The minimum allowed is 1 day to prevent a zero-or-negative
  // value from wiping the whole log in one run.
  //
  // Parsed as a string + coerced because `process.env` values are
  // always strings; the coerce lets deployment platforms (Vercel,
  // Render, bare .env files) supply the value as a plain number
  // literal without quoting. A nonsensical value (e.g. "banana")
  // fails the schema at boot, same as any other required variable.
  AUDIT_RETENTION_DAYS: z.coerce
    .number()
    .int("AUDIT_RETENTION_DAYS must be a whole number of days")
    .min(1, "AUDIT_RETENTION_DAYS must be at least 1 day")
    .default(365),

  // --- Cron auth (Sprint 41) -------------------------------------------
  // Shared secret used to authenticate cron-triggered API routes such as
  // `/api/cron/notifications/[frequency]`. The route rejects any call
  // whose `Authorization: Bearer <value>` header doesn't match, or — if
  // `CRON_SECRET` is unset — returns 503 so a forgotten config can't
  // accidentally fan out emails from an open endpoint. Optional at the
  // schema level because notifications are opt-in: a fresh dev clone
  // without cron configured should still boot.
  //
  // A 16-char minimum keeps us away from trivially-guessable
  // placeholders while staying compatible with common vault formats
  // (GitHub Actions secret, Vercel env var, Doppler token).
  CRON_SECRET: z
    .string()
    .min(16, "CRON_SECRET must be at least 16 characters — use a strong random string")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

// Require the mail pair to be all-or-nothing: having `RESEND_API_KEY`
// without `MAIL_FROM` is a silent misconfiguration (Resend will 422
// on every send with an unhelpful error). We treat it as a schema
// failure so the server won't start.
const schemaWithRefinements = schema.superRefine((values, ctx) => {
  const hasKey = Boolean(values.RESEND_API_KEY);
  const hasFrom = Boolean(values.MAIL_FROM);
  if (hasKey !== hasFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["MAIL_FROM"],
      message:
        "RESEND_API_KEY and MAIL_FROM must be set together. Set both to enable outbound email, or leave both unset to fall back to console logging in development.",
    });
  }

  // In production, NEXT_PUBLIC_APP_URL should be set — otherwise
  // invitation emails link to localhost. We don't fail the schema
  // (deploys without an app URL are still bootable), but we log a
  // single startup warning here so ops can spot the drift. This is
  // the only `console.warn` in this module on purpose: the logger
  // module imports from this file, so using `logger.warn` here
  // would create a circular import at boot.
  if (values.NODE_ENV === "production" && !values.NEXT_PUBLIC_APP_URL) {
    console.warn(
      "[env] NEXT_PUBLIC_APP_URL is unset in production. Invitation emails and absolute URLs will point at localhost.",
    );
  }

  // Phase 6A / P2 — Upstash Redis REST credentials must be set
  // together. Having only one half of the pair is a silent
  // misconfiguration (the rate limiter would fall back to in-memory
  // and a second instance would silently disagree), so we surface it
  // as a schema failure.
  const hasRedisUrl = Boolean(values.UPSTASH_REDIS_REST_URL);
  const hasRedisToken = Boolean(values.UPSTASH_REDIS_REST_TOKEN);
  if (hasRedisUrl !== hasRedisToken) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["UPSTASH_REDIS_REST_TOKEN"],
      message:
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together. Set both to enable distributed rate limiting, or leave both unset to fall back to in-process limits (dev only — NOT safe for multi-instance deployments).",
    });
  }
});

/**
 * Parsed environment, validated once at import time. Call sites
 * should prefer `env.FOO` over `process.env.FOO` so the type system
 * can narrow (e.g. `env.NODE_ENV` is a literal union).
 *
 * Note: this is intentionally a module-top-level call. If the schema
 * fails, the server process exits on first import — which is exactly
 * what we want for missing required secrets. Tests that need to
 * mutate env vars should do so before the first import of this file.
 */
function parseEnv() {
  const result = schemaWithRefinements.safeParse(process.env);
  if (!result.success) {
    // Format the errors into a single multi-line message. We don't
    // use console.error here because Next.js will sometimes swallow
    // module-load console output; throwing is loud and propagates
    // through the dev server overlay cleanly.
    const lines = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    });
    throw new Error(
      `[env] Environment validation failed:\n${lines.join("\n")}\n\nCheck your .env file or deployment environment and restart.`,
    );
  }
  return Object.freeze(result.data);
}

export const env = parseEnv();

/**
 * Convenience flag exported so call sites that only want to know
 * "are we in prod?" don't need to import the full `env` object or
 * remember the literal string.
 */
export const isProduction = env.NODE_ENV === "production";
