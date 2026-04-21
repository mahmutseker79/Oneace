/**
 * @openapi-tag: /cron/vercel-quota-health
 *
 * Audit v1.3 §5.48 F-04 — the tag above is the canonical route path.
 * docs/openapi.yaml MUST declare the same path with every HTTP method
 * this file exports. `src/lib/openapi-parity.test.ts` pins the two in
 * lockstep.
 */
/**
 * Vercel daily-deploy quota watchdog (audit v1.3 §5.48).
 *
 * Background — the 2026-04-18 dependabot-burn incident: Dependabot
 * had 20+ open PRs, each firing 1 preview + 1 production deploy on
 * the free-tier quota of 100 deployments/day. By mid-afternoon the
 * v1.5.13 hotfix promote was blocked because quota was exhausted.
 * v1.5.17 shipped the `vercel.json` gate that stops `dependabot/*`
 * branches from deploying, but the structural gap the incident
 * revealed was that there was NO threshold alarm ahead of the 100/day
 * ceiling — the first signal was a red "Quota Exceeded" wall.
 *
 * What this cron does:
 *
 *   1. Call Vercel's `GET /v6/deployments` with
 *      `projectId=<env>&since=<UTC-midnight-ms>` to page through every
 *      deployment created since UTC-00:00. Paginate by `next`
 *      cursor until empty (free-tier page size is 20, so we
 *      realistically fetch ≤ 6 pages to see 100 rows).
 *   2. Count them. Vercel's quota is 100 deploys / UTC day on the
 *      Hobby plan.
 *   3. Below 80 → happy path, log at info with `vercel-quota.ok`.
 *   4. 80–99 → emit `vercel-quota.warn` at warn level — ops has ~20
 *      deploys of headroom to dig into what is eating the budget.
 *   5. ≥ 100 → emit `vercel-quota.exceeded` at error level — all
 *      builds are refused until the next UTC midnight.
 *
 * Why the cron does not try to page Vercel forever: the 80/100/≥100
 * decision does not need an exact count past 100. We cap pagination
 * at MAX_PAGES so a misconfigured project doesn't wedge the cron into
 * a many-thousand-row walk.
 *
 * Deliberate non-choices:
 *
 *   - **No `withCronIdempotency`.** This cron must run multiple times
 *     per UTC day — the point is to detect quota pressure as it
 *     builds. The daily-bucket idempotency would silence the cron
 *     after its first run.
 *   - **No hard failure on missing VERCEL_TOKEN.** A free-tier setup
 *     without a Vercel API token should still boot — the cron logs a
 *     warn and returns 200 `skipped/config`. Ops wires the token
 *     when they want the alarm.
 *   - **No PostHog tracking.** Quota pressure is an ops concern, not
 *     a product-analytics concern. Emitting a PostHog event here
 *     would just pollute the dashboard with infra noise.
 *
 * Auth: CRON_SECRET Bearer header (same pattern as sibling cron routes).
 * Budget: up to MAX_PAGES * one-HTTP-roundtrip + one log, well inside
 *   Vercel Hobby's 60s cron timeout.
 */

import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby cron timeout
export const runtime = "nodejs";

// Vercel Hobby plan daily ceiling. If the plan ever changes this must
// change too — but since the alarm is "we are close to the ceiling",
// getting this wrong by a bit is fine; getting it fundamentally wrong
// (e.g. setting it to 1000) would silence the alarm entirely.
const DAILY_QUOTA = 100;
// Warn threshold. 20 deploys of headroom lets ops triage a runaway
// Dependabot or a misconfigured preview branch before the ceiling
// blocks the hotfix.
const WARN_THRESHOLD = 80;

// Per-fetch timeout. Keeps one flaky API call from eating the cron
// budget.
const FETCH_TIMEOUT_MS = 10_000;
// Pagination cap. Vercel free-tier page size is 20; 10 pages is 200
// rows, comfortably above the 100-deploy ceiling we actually care
// about. The cap is a safety net, not a budget.
const MAX_PAGES = 10;

type OutcomeBody =
  | {
      ok: true;
      status: "quota-ok";
      count: number;
      quota: number;
      warnAt: number;
    }
  | {
      ok: true;
      status: "quota-warn";
      alarm: "warn";
      count: number;
      quota: number;
      warnAt: number;
    }
  | {
      ok: true;
      status: "quota-exceeded";
      alarm: "exceeded";
      count: number;
      quota: number;
    }
  | { ok: true; status: "skipped"; reason: "config" | "transport"; detail?: string };

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** Milliseconds since epoch at the start of the current UTC day. */
function utcMidnightMs(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export async function GET(request: NextRequest): Promise<NextResponse<OutcomeBody>> {
  // ── 1. Auth gate ──────────────────────────────────────────────────
  const cronSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.warn("CRON_SECRET not configured for vercel-quota-health", {
      tag: "cron.vercel-quota-health.no-secret",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "CRON_SECRET" },
      { status: 500 },
    );
  }

  if (!cronSecret || cronSecret !== expectedSecret) {
    logger.warn("Invalid cron secret for vercel-quota-health", {
      tag: "cron.vercel-quota-health.unauthorized",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "unauthorized" },
      { status: 401 },
    );
  }

  // ── 2. Required config ────────────────────────────────────────────
  // Vercel API token with at least "read deployments" scope. Team
  // accounts also need VERCEL_TEAM_ID to disambiguate the project.
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;
  const vercelTeamId = process.env.VERCEL_TEAM_ID; // optional — personal account has none

  if (!vercelToken || !vercelProjectId) {
    logger.warn("vercel-quota-health: skipping — missing VERCEL_TOKEN or VERCEL_PROJECT_ID", {
      tag: "vercel-quota.skipped.config",
      hasToken: Boolean(vercelToken),
      hasProjectId: Boolean(vercelProjectId),
    });
    return NextResponse.json({ ok: true, status: "skipped", reason: "config" });
  }

  // ── 3. Page through deployments since UTC midnight ───────────────
  const since = utcMidnightMs(new Date());
  let count = 0;
  let nextCursor: number | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        projectId: vercelProjectId,
        since: String(since),
        limit: "20",
      });
      if (nextCursor !== null) params.set("until", String(nextCursor));
      if (vercelTeamId) params.set("teamId", vercelTeamId);

      const res = await fetchWithTimeout(`https://api.vercel.com/v6/deployments?${params}`, {
        headers: { Authorization: `Bearer ${vercelToken}` },
      });

      if (!res.ok) {
        logger.warn("vercel-quota-health: vercel api non-2xx — transient skip", {
          tag: "vercel-quota.skipped.api",
          status: res.status,
        });
        return NextResponse.json({
          ok: true,
          status: "skipped",
          reason: "transport",
          detail: `vercel:${res.status}`,
        });
      }

      const body = (await res.json()) as {
        deployments?: unknown[];
        pagination?: { next?: number | null };
      };
      const rows = Array.isArray(body.deployments) ? body.deployments.length : 0;
      count += rows;

      const next = body.pagination?.next ?? null;
      // Stop when Vercel says there are no more rows, OR when we have
      // already crossed the ceiling (no point paginating further just
      // to sharpen a number the alarm logic does not depend on).
      if (!next || count >= DAILY_QUOTA) {
        break;
      }
      nextCursor = next;
    }
  } catch (err) {
    logger.warn("vercel-quota-health: vercel fetch failed — transient skip", {
      tag: "vercel-quota.skipped.fetch",
      err,
    });
    return NextResponse.json({
      ok: true,
      status: "skipped",
      reason: "transport",
      detail: "vercel-fetch",
    });
  }

  // ── 4. Threshold decision ────────────────────────────────────────
  if (count >= DAILY_QUOTA) {
    logger.error("vercel-quota-health: daily deploy quota exceeded", {
      tag: "vercel-quota.exceeded",
      count,
      quota: DAILY_QUOTA,
    });
    return NextResponse.json({
      ok: true,
      status: "quota-exceeded",
      alarm: "exceeded",
      count,
      quota: DAILY_QUOTA,
    });
  }

  if (count >= WARN_THRESHOLD) {
    logger.warn("vercel-quota-health: approaching daily deploy quota", {
      tag: "vercel-quota.warn",
      count,
      quota: DAILY_QUOTA,
      warnAt: WARN_THRESHOLD,
    });
    return NextResponse.json({
      ok: true,
      status: "quota-warn",
      alarm: "warn",
      count,
      quota: DAILY_QUOTA,
      warnAt: WARN_THRESHOLD,
    });
  }

  logger.info("vercel-quota-health: within headroom", {
    tag: "vercel-quota.ok",
    count,
    quota: DAILY_QUOTA,
    warnAt: WARN_THRESHOLD,
  });
  return NextResponse.json({
    ok: true,
    status: "quota-ok",
    count,
    quota: DAILY_QUOTA,
    warnAt: WARN_THRESHOLD,
  });
}
