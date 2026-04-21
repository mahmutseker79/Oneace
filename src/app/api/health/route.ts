/**
 * @openapi-tag: /health
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
// Sprint 37: /api/health — liveness + readiness probe.
// Phase 7A / P5: extended with a schema sentinel.
// Phase 7B / P2: extended with a migrations sub-check.
//
// A single endpoint covering the common platform probes:
//
//   * **Liveness** — "is the Next.js process up?" — answered by the
//     route being reachable at all. Any 200 means the server is
//     running, event loop isn't wedged, and the bundle parsed
//     successfully.
//   * **Readiness — connectivity** — "can we reach Postgres?" —
//     answered by a cheap `SELECT 1` round trip. If Prisma can talk
//     to the database, the connection layer is ready.
//   * **Readiness — schema** — "are the core tables actually
//     present?" — answered by a `to_regclass(...)` probe against a
//     short list of core tables. This catches the "deploy pointed
//     at the wrong database" and "migrations didn't land" failure
//     modes, both of which would otherwise look healthy until the
//     first real request hits a missing column.
//   * **Readiness — migrations** — "did every migration this build
//     expects actually finish applying?" — answered by counting
//     completed rows in `_prisma_migrations` and comparing against
//     the build-time `EXPECTED_MIGRATION_COUNT` env var. This is
//     opt-in: if the env var is unset, the check is **skipped with
//     a warn log** rather than failing closed, which preserves the
//     Phase 7A behaviour as the floor and avoids introducing a new
//     failure mode for operators who have not wired the env var
//     yet.
//
// If any check fails we return 503 with the same body shape so
// callers can distinguish "up but not ready" from "hard down" and
// alert on the specific sub-check that tripped.
//
// A few deliberate choices:
//
//   * No auth. Health endpoints have to be callable by load
//     balancers, uptime probes, and Vercel's own infra without
//     credentials. We expose zero PII and zero tenant data, so
//     making this public is fine.
//   * `export const dynamic = "force-dynamic"` because the default
//     Next.js route handler caching would turn this into a static
//     200 snapshot and make the DB check useless.
//   * We include `version` and `commit` fields when available so
//     the uptime dashboard can spot a stuck-old-deploy scenario;
//     both come from Vercel-provided env vars and fall back to
//     "unknown" in local dev.
//   * We intentionally keep the body tiny — this endpoint can
//     get polled aggressively and any bloat is pure cost.

import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// Don't cache — the whole point of the endpoint is that each hit
// exercises the DB. Without this, Next.js 15 will try to render
// route handlers statically when they're parameter-free.
export const dynamic = "force-dynamic";
// Node runtime: Prisma's client library doesn't run on the edge
// runtime, so we pin this route to Node.
export const runtime = "nodejs";

type HealthPayload = {
  status: "ok" | "degraded";
  uptime: number;
  timestamp: string;
  environment: string;
  version: string;
  commit: string;
  checks: {
    database: "ok" | "fail";
    // Phase 7A / P5 — schema sentinel. "ok" means every core table
    // the app needs to serve traffic is present in the current
    // search path. "fail" means the database is reachable but the
    // migrations haven't landed (or the app is pointed at the
    // wrong database), which is a distinct failure mode from a
    // hard DB outage and deserves its own alert.
    schema: "ok" | "fail";
    // Phase 7B / P2 — migrations sentinel. "ok" means the number of
    // finished rows in `_prisma_migrations` matches the build-time
    // `EXPECTED_MIGRATION_COUNT` env var. "fail" means the count is
    // off (usually: the deploy landed ahead of `migrate deploy`).
    // "skipped" means `EXPECTED_MIGRATION_COUNT` is not set on this
    // environment — we do not treat an unset gate as a failure, so
    // Phase 7A behaviour is preserved as the floor.
    migrations: "ok" | "fail" | "skipped";
  };
  // Present only when something is wrong, so the happy path stays
  // as compact as possible.
  errors?: string[];
};

// Core tables the app cannot serve a single authenticated request
// without. Deliberately short — this is a deploy-gate sentinel, not
// a schema integrity check. Expanding this list turns a normal
// additive migration into a deploy-blocking event and should be
// done consciously.
//
// The rationale for each entry:
//   * Organization  — the tenancy root. Every request resolves to
//     one of these rows.
//   * Membership    — without this, `requireActiveMembership` fails
//     on the first authenticated page load.
//   * User          — Better Auth's account table; login itself
//     depends on it.
//   * Session       — Better Auth session store; cookie validation
//     depends on it.
//   * StockMovement — the central domain table. If Phase 5A's
//     additive columns are missing this table also signals the
//     migration didn't land.
const CORE_TABLES = ["Organization", "Membership", "User", "Session", "StockMovement"] as const;

// Vercel injects these at deploy time. Missing locally is fine —
// "unknown" is a signal the uptime dashboard can interpret as
// "development" rather than a broken deploy.
const version = process.env.VERCEL_GIT_COMMIT_REF ?? "unknown";
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown";

// Phase 7B / P2 — parse the build-time migration-count gate. We do
// this once at module load so a malformed value is surfaced in the
// server log at boot, not buried in every probe response. An unset
// value is not an error: the probe will simply skip the migrations
// sub-check and warn once on first use (see below).
//
// We deliberately do not add this to `src/lib/env.ts`: the env
// schema would make the value strictly required (and fail the boot
// if unset), which would regress Phase 7A behaviour for environments
// that have not wired the var yet. Reading `process.env` directly
// here mirrors how `VERCEL_GIT_COMMIT_REF` / `VERCEL_GIT_COMMIT_SHA`
// are handled in this same module — this is a probe-local knob, not
// a load-bearing secret.
const rawExpectedMigrationCount = process.env.EXPECTED_MIGRATION_COUNT;
const expectedMigrationCount: number | null = (() => {
  if (rawExpectedMigrationCount === undefined || rawExpectedMigrationCount === "") {
    return null;
  }
  const parsed = Number.parseInt(rawExpectedMigrationCount, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    // Malformed value — do not fail the module import (that would
    // take the whole app down). Log once and treat as "unset" so
    // the probe skips the check with the same unset-path behaviour.
    logger.warn("health check: EXPECTED_MIGRATION_COUNT is not a non-negative integer — skipping", {
      tag: "health.migrations.bad-env",
      value: rawExpectedMigrationCount,
    });
    return null;
  }
  return parsed;
})();

/**
 * Audit v1.3 §5.46 F-02 — caller telemetry markers.
 *
 * Problem the audit described: `/api/health` is polled by
 * multiple external infra callers (Vercel uptime, external
 * monitoring, the push helper's post-push probe, cron-routed
 * probes…) but the route never logged *who* was calling. When the
 * 2026-04-18 incident was debugged, we could not answer the
 * trivial question "is our main webhook actually probing health
 * right now?" without redeploying with an ad-hoc log line.
 *
 * Fix: on every probe we extract a small set of caller markers
 * from the request headers and emit a single structured log
 * entry with `tag: "health.probe.caller"`. The field names are
 * deliberately log-drain-friendly — Vercel log drains / PostHog
 * relays can filter on the tag without any parsing.
 *
 * What we intentionally do NOT log:
 *   - Request body (there isn't one — GET endpoint).
 *   - Cookies or auth headers (the route is public; callers don't
 *     send them, but a belt-and-braces redaction still applies).
 *   - Full header dump (noisy and liable to leak tokens if a
 *     caller ever mis-routes an Authorization-bearing request to
 *     /api/health).
 *
 * Sampling: none. /api/health is called by a bounded set of infra
 * probes (single-digit QPS in production). At that volume a
 * structured log per hit is cheaper than building a sampler that
 * future debugging has to reverse-engineer.
 */
export type HealthCallerMarkers = {
  ua: string;
  ip: string;
  vercelId: string;
  referer: string;
};

export function extractCallerMarkers(request: Request | NextRequest): HealthCallerMarkers {
  const headers = request.headers;
  const rawIp = headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "unknown";
  // First entry in x-forwarded-for is the client; the rest are
  // proxy hops and are never useful for "who called".
  const ip = rawIp.split(",")[0]?.trim() || "unknown";
  return {
    ua: headers.get("user-agent") ?? "unknown",
    ip,
    // Vercel stamps every request with x-vercel-id on ingress; having
    // this lets us correlate a probe line with the Vercel dashboard
    // request view if something looks off.
    vercelId: headers.get("x-vercel-id") ?? "unknown",
    referer: headers.get("referer") ?? "unknown",
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthPayload>> {
  // §5.46 F-02 — caller telemetry. Log before any DB work so even a
  // probe that times out during the SELECT 1 leaves a "who" trail.
  const caller = extractCallerMarkers(request);
  logger.info("health check: probe received", {
    tag: "health.probe.caller",
    ua: caller.ua,
    ip: caller.ip,
    vercelId: caller.vercelId,
    referer: caller.referer,
  });

  const errors: string[] = [];
  let databaseStatus: "ok" | "fail" = "ok";
  let schemaStatus: "ok" | "fail" = "ok";
  let migrationsStatus: "ok" | "fail" | "skipped" = "skipped";

  try {
    // Cheapest possible DB round-trip. `$queryRaw` bypasses Prisma's
    // query builder so a half-broken generated client still pings
    // the connection. The template tag form is used so Prisma knows
    // it's a parameter-free literal — no SQL injection surface here.
    await db.$queryRaw`SELECT 1`;
  } catch (err) {
    databaseStatus = "fail";
    // Include only the error class name in the public response; the
    // full stack goes to the server log where ops can find it by
    // correlating timestamps. We don't want a load balancer probe
    // response to leak a Prisma error path.
    errors.push(`database: ${err instanceof Error ? err.name : "unknown"}`);
    logger.error("health check: database probe failed", { err });
  }

  // Phase 7A / P5 — schema sentinel. We only run this when the DB
  // connectivity check above already passed; there's no point
  // asking Postgres about its catalog if we can't reach it at all.
  //
  // `to_regclass('public."Foo"')` returns the OID of the table if
  // it exists and NULL otherwise — no exception on missing tables,
  // so one round-trip can report on every core table at once. This
  // is strictly a "are the tables there" probe: we do not check
  // columns, indexes, constraints, or data. A deploy that applied
  // every migration correctly passes this trivially; a deploy that
  // points at an empty or half-migrated database fails loudly.
  if (databaseStatus === "ok") {
    try {
      const rows = await db.$queryRaw<Array<{ oid: string | null }>>`
        SELECT unnest(ARRAY[
          to_regclass('public."Organization"')::text,
          to_regclass('public."Membership"')::text,
          to_regclass('public."User"')::text,
          to_regclass('public."Session"')::text,
          to_regclass('public."StockMovement"')::text
        ]) AS oid
      `;
      const missing: string[] = [];
      rows.forEach((row, idx) => {
        if (!row.oid) {
          const tableName = CORE_TABLES[idx];
          if (tableName) missing.push(tableName);
        }
      });
      if (missing.length > 0) {
        schemaStatus = "fail";
        errors.push(`schema: missing ${missing.join(", ")}`);
        logger.error("health check: schema sentinel found missing tables", {
          tag: "health.schema-missing",
          missing,
        });
      }
    } catch (err) {
      schemaStatus = "fail";
      errors.push(`schema: ${err instanceof Error ? err.name : "unknown"}`);
      logger.error("health check: schema sentinel probe failed", {
        tag: "health.schema-probe-failed",
        err,
      });
    }
  } else {
    // DB unreachable — mark schema unknown but surface it as "fail"
    // so the overall probe is degraded and the body is consistent.
    // We do NOT add a second error line here: the DB failure above
    // is already the root cause and surfacing it twice just
    // confuses alert routing.
    schemaStatus = "fail";
  }

  // Phase 7B / P2 — migrations sentinel. Only meaningful when:
  //   1. the database is reachable (otherwise the count query will
  //      just fail for the same root cause already surfaced above),
  //   2. the schema sentinel passed (otherwise `_prisma_migrations`
  //      itself may not exist yet on a cold database), and
  //   3. `EXPECTED_MIGRATION_COUNT` is set on this environment.
  //
  // When the gate is unset we intentionally leave `migrationsStatus`
  // at its initial "skipped" value and emit a warn-level log once
  // per probe. Skipping is NOT a failure — the overall health check
  // ignores "skipped" when computing `overallOk` below, which
  // preserves Phase 7A behaviour for operators who have not yet
  // plumbed the env var.
  if (databaseStatus === "ok" && schemaStatus === "ok") {
    if (expectedMigrationCount === null) {
      logger.warn(
        "health check: EXPECTED_MIGRATION_COUNT is unset — skipping migration count check",
        { tag: "health.migrations.skipped" },
      );
    } else {
      try {
        // One cheap round-trip. `finished_at IS NOT NULL` filters
        // out migrations that are rolling forward right now — we
        // only want to count the ones that actually completed, so
        // a half-applied migration during a rolling deploy does not
        // flap the probe back and forth.
        const rows = await db.$queryRaw<Array<{ applied: number }>>`
          SELECT COUNT(*)::int AS applied FROM _prisma_migrations WHERE finished_at IS NOT NULL
        `;
        const applied = rows[0]?.applied ?? 0;
        if (applied === expectedMigrationCount) {
          migrationsStatus = "ok";
        } else {
          migrationsStatus = "fail";
          errors.push(`migrations: expected ${expectedMigrationCount}, found ${applied}`);
          logger.error("health check: migration count mismatch", {
            tag: "health.migrations.mismatch",
            expected: expectedMigrationCount,
            applied,
          });
        }
      } catch (err) {
        migrationsStatus = "fail";
        errors.push(`migrations: ${err instanceof Error ? err.name : "unknown"}`);
        logger.error("health check: migrations probe failed", {
          tag: "health.migrations.probe-failed",
          err,
        });
      }
    }
  }
  // We deliberately do NOT flip `migrationsStatus` to "fail" when
  // the database or schema check already tripped. The root-cause
  // alert should fire on `database` or `schema`; surfacing a third
  // dependent failure on the migrations line just noises up the
  // alert and hides the real trigger.

  // Overall readiness computation. A "skipped" migrations check
  // does not degrade the overall status — that is the whole point
  // of the Phase 7A floor.
  const overallOk = databaseStatus === "ok" && schemaStatus === "ok" && migrationsStatus !== "fail";

  const payload: HealthPayload = {
    status: overallOk ? "ok" : "degraded",
    // `process.uptime()` is in seconds with float precision. Round
    // to whole seconds — consumers don't care about sub-second drift
    // and it keeps the body stable enough for diff-based alerts.
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version,
    commit,
    checks: {
      database: databaseStatus,
      schema: schemaStatus,
      migrations: migrationsStatus,
    },
    ...(errors.length > 0 ? { errors } : {}),
  };

  // 200 when fully ready, 503 when any readiness check failed.
  // Liveness-only probes that only care about "is the process up?"
  // should still accept the 503 — the body carries enough signal.
  const statusCode = payload.status === "ok" ? 200 : 503;

  return NextResponse.json(payload, {
    status: statusCode,
    headers: {
      // Belt-and-braces: even though we set dynamic="force-dynamic"
      // above, upstream CDNs (Cloudflare, etc.) ignore that and
      // need an explicit no-store to not cache the probe.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
