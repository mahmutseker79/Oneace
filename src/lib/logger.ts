// Sprint 37: Structured server-side logger.
//
// We've been using bare `console.log` / `console.error` calls across
// the server-action layer. That works fine in development, but in
// production on Vercel we want:
//
//   * A consistent shape (level, timestamp, message, extras) so
//     log-aggregation tools can filter by level and pull out the
//     structured fields without regex.
//   * A single place to gate debug output behind `LOG_LEVEL`.
//   * A tiny, dependency-free surface so we're not pulling pino
//     (~200KB) into the Next.js server bundle for an MVP.
//
// This module gives us exactly that — four level methods
// (debug / info / warn / error) that emit JSON lines on stdout in
// production and pretty, human-readable strings in development. The
// development format is intentionally close to what a bare
// `console.log` would produce so existing ergonomics are preserved.
//
// We deliberately do NOT emit to a remote logging service here. If
// we later plug Axiom / BetterStack / Datadog in, it will be behind
// this same interface so call sites don't change.

import { env, isProduction } from "@/lib/env";

type LogLevel = "debug" | "info" | "warn" | "error";

// Numeric weights so threshold comparisons are a single >=.
const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Default threshold: debug in dev/test, info in prod. An explicit
// LOG_LEVEL env var overrides either default.
const configuredLevel: LogLevel = env.LOG_LEVEL ?? (isProduction ? "info" : "debug");
const threshold = LEVEL_WEIGHT[configuredLevel];

/**
 * Structured log context — arbitrary JSON-serialisable fields
 * attached to a log line. Kept as `Record<string, unknown>` rather
 * than a tighter type because call sites legitimately log lots of
 * different shapes (error objects, request ids, row counts, ...).
 */
export type LogContext = Record<string, unknown>;

/**
 * Serialise an Error into something JSON-friendly. Without this,
 * `JSON.stringify(new Error("x"))` emits `{}` because Error fields
 * are non-enumerable. We include the stack because in a log
 * aggregator you almost always want it.
 */
function serialiseError(err: unknown): unknown {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      // Preserve any custom fields (Prisma errors carry `code`,
      // `meta`, etc.) without clobbering the ones we just set.
      ...Object.fromEntries(
        Object.entries(err).filter(
          ([key]) => key !== "name" && key !== "message" && key !== "stack",
        ),
      ),
    };
  }
  return err;
}

/**
 * Walk a context object and replace any Error instances with their
 * serialised form so JSON.stringify produces something useful.
 * Non-Error values pass through untouched.
 */
function normaliseContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = value instanceof Error ? serialiseError(value) : value;
  }
  return out;
}

/**
 * Core emit function. In production, writes a single JSON line
 * suitable for Vercel/Cloudwatch ingestion. In development, writes
 * a readable "LEVEL message { …ctx }" line so local logs stay
 * skimmable. Unknown (below-threshold) levels are no-ops.
 */
function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_WEIGHT[level] < threshold) return;

  const normalised = normaliseContext(context);

  if (isProduction) {
    // Single-line JSON so log aggregators parse cleanly. The ISO
    // timestamp lets us re-order entries if two processes race on
    // the same stream.
    const payload = {
      level,
      timestamp: new Date().toISOString(),
      message,
      ...(normalised ? { context: normalised } : {}),
    };
    // Use console.error for warn/error and console.log for info/debug —
    // preserves Vercel's stderr/stdout split AND works in the Edge
    // Runtime, where `process.stdout`/`process.stderr` are undefined.
    //
    // Previously this branch called `process.stderr.write(...)` /
    // `process.stdout.write(...)` directly, which throws
    // `TypeError: Cannot read properties of undefined (reading 'write')`
    // in Edge middleware. That crash manifested as
    // `MIDDLEWARE_INVOCATION_FAILED` on every request in production,
    // because `src/middleware.ts` → `rate-limit.ts` fires a
    // `logger.warn(...)` at module load when Upstash Redis is not
    // configured (Upstash creds are optional; the fallback-warning
    // path is the common case). Node runtime (API routes, server
    // actions) was unaffected. See tag v1.5.13-hotfix-edge-logger.
    const line = JSON.stringify(payload);
    if (level === "warn" || level === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
    return;
  }

  // Dev format: upper-case level tag, then the message, then a
  // compact JSON render of the context (only if present). We use
  // the corresponding console method so browser/terminal colouring
  // and `next dev` grouping still work.
  const prefix = `[${level.toUpperCase()}]`;
  const consoleFn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.info;
  if (normalised && Object.keys(normalised).length > 0) {
    consoleFn(`${prefix} ${message}`, normalised);
  } else {
    consoleFn(`${prefix} ${message}`);
  }
}

/**
 * The exported logger. Usage:
 *
 * ```ts
 * import { logger } from "@/lib/logger";
 * logger.info("purchase order received", { poId, userId });
 * logger.error("failed to send email", { err, to });
 * ```
 *
 * Prefer passing the thrown error under the conventional `err` key
 * so grep-ability stays consistent across the codebase.
 */
export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
