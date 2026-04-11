// Sprint 37: /api/health — liveness + readiness probe.
//
// A single endpoint covering two common platform probes:
//
//   * **Liveness** — "is the Next.js process up?" — answered by the
//     route being reachable at all. Any 200 means the server is
//     running, event loop isn't wedged, and the bundle parsed
//     successfully.
//   * **Readiness** — "can the app serve traffic?" — answered by a
//     cheap `SELECT 1` round trip against Postgres. If Prisma can
//     talk to the database, the request path is ready. If the DB
//     is down, we return 503 with the same body shape so callers
//     can distinguish "up but not ready" from "hard down".
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

import { NextResponse } from "next/server";

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
  };
  // Present only when something is wrong, so the happy path stays
  // as compact as possible.
  errors?: string[];
};

// Vercel injects these at deploy time. Missing locally is fine —
// "unknown" is a signal the uptime dashboard can interpret as
// "development" rather than a broken deploy.
const version = process.env.VERCEL_GIT_COMMIT_REF ?? "unknown";
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown";

export async function GET(): Promise<NextResponse<HealthPayload>> {
  const errors: string[] = [];
  let databaseStatus: "ok" | "fail" = "ok";

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

  const payload: HealthPayload = {
    status: databaseStatus === "ok" ? "ok" : "degraded",
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
