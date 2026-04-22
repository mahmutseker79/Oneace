/**
 * @openapi-tag: /cron/platform-webhook-health
 *
 * Audit v1.3 §5.45 F-01 — platform-agnostic rename of the prior
 * `vercel-webhook-health` route. The logic was never Vercel-specific
 * (it compares GitHub main HEAD to the prod /api/health `commit`
 * field), so Faz 2 is a pure rename + @openapi-tag update. The route
 * handler itself is unchanged in behavior; only the URL and log tag
 * prefix move to `platform-*` so the same alarm fires regardless of
 * whether the site is on Vercel, Netlify, or a future platform.
 *
 * docs/openapi.yaml MUST declare `/cron/platform-webhook-health` with
 * every HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
/**
 * Silent-push detector — runs every 30 min, compares GitHub main HEAD
 * against the deployed `/api/health.commit` field, and emits a
 * structured log at error level if the deployed commit is stale past
 * WEBHOOK_STALE_MINUTES.
 *
 * Auth: CRON_SECRET Bearer header (same pattern as sibling cron routes).
 *
 * What this cron does:
 *
 *   1. Query the GitHub public commits API for the latest SHA on
 *      `main` (`GET /repos/:owner/:repo/commits/main`). Unauthenticated
 *      works for a public repo; if `GITHUB_TOKEN` is present we send
 *      it so private-repo deploys keep working.
 *   2. Fetch the production `/api/health` endpoint and read its
 *      `commit` field (the prod build injects the HEAD SHA at build
 *      time; `/api/health` surfaces the first 7 chars).
 *   3. If the GitHub SHA.slice(0,7) differs from the deployed commit
 *      AND the GitHub commit is older than `WEBHOOK_STALE_MINUTES`
 *      (default 30), log an error with `tag: "platform-webhook.silent"`
 *      and return 200 `{ alarm: "silent" }`. Ops alert rules watch
 *      for that exact tag.
 *   4. If `/api/health` itself returns a non-200, that is a different
 *      failure mode (prod is down, not silent) — log with
 *      `tag: "platform-webhook.prod-down"` so alert routing can split
 *      the two. Still return 200 because the cron itself succeeded;
 *      the body carries the signal.
 *
 * Deliberate non-choices:
 *
 *   - **No `withCronIdempotency`.** The idempotency helper keys on a
 *     UTC-day bucket, which works for the 4 daily cleanup crons but
 *     would silence this cron after its first run each day. We want
 *     roughly 48 runs/day so the mean-time-to-detect a silent webhook
 *     is ~30 min, not 24h.
 *   - **No hard failure on missing env.** If `GITHUB_MAIN_REPO` or
 *     `PUBLIC_PROD_URL` are unset, we log a warn and return 200
 *     `{ skipped: "config" }`. A cron that 500s every tick is noise,
 *     not signal.
 *   - **No alarm on network blips.** A single GitHub or `/api/health`
 *     fetch failure is logged at warn level and we return
 *     `{ skipped: "transport" }`.
 */

import { detectPlatform } from "@/lib/hosting-platform";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby cron timeout; Netlify scheduled functions cap at 60s too
export const runtime = "nodejs";

// Window after which a GitHub-main commit that does NOT match the
// deployed SHA is classified as a silent webhook. Vercel/Netlify free
// tier builds complete in ~3–5 min; beyond 30 min a healthy webhook +
// build pipeline would have closed the gap. Exposed as a constant so
// the pinned test can read it without import-time side effects.
const WEBHOOK_STALE_MINUTES = 30;
const FETCH_TIMEOUT_MS = 10_000;

type OutcomeBody =
  | { ok: true; status: "match"; sha: string; commit: string; platform: string }
  | {
      ok: true;
      status: "silent";
      alarm: "silent";
      expectedSha: string;
      deployedCommit: string;
      commitAgeMinutes: number;
      githubCommitAt: string;
      platform: string;
    }
  | {
      ok: true;
      status: "prod-down";
      alarm: "prod-down";
      healthStatus: number;
      platform: string;
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

export async function GET(request: NextRequest): Promise<NextResponse<OutcomeBody>> {
  // ── 1. Auth gate ──────────────────────────────────────────────────
  const cronSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.warn("CRON_SECRET not configured for platform-webhook-health", {
      tag: "cron.platform-webhook-health.no-secret",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "CRON_SECRET" },
      { status: 500 },
    );
  }

  if (!cronSecret || cronSecret !== expectedSecret) {
    logger.warn("Invalid cron secret for platform-webhook-health", {
      tag: "cron.platform-webhook-health.unauthorized",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "unauthorized" },
      { status: 401 },
    );
  }

  const platform = detectPlatform();

  // ── 2. Required config ────────────────────────────────────────────
  const mainRepo = process.env.GITHUB_MAIN_REPO;
  const prodUrl = process.env.PUBLIC_PROD_URL;

  if (!mainRepo || !prodUrl) {
    logger.warn("platform-webhook-health: skipping — missing config", {
      tag: "platform-webhook.skipped.config",
      hasRepo: Boolean(mainRepo),
      hasProdUrl: Boolean(prodUrl),
      platform,
    });
    return NextResponse.json({ ok: true, status: "skipped", reason: "config" });
  }

  // ── 3. Fetch GitHub main HEAD ────────────────────────────────────
  let githubSha: string;
  let githubCommitAt: Date;
  try {
    const ghHeaders: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "oneace-platform-webhook-health",
    };
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken) ghHeaders.Authorization = `Bearer ${ghToken}`;

    const ghRes = await fetchWithTimeout(
      `https://api.github.com/repos/${mainRepo}/commits/main`,
      { headers: ghHeaders },
    );
    if (!ghRes.ok) {
      logger.warn("platform-webhook-health: github api non-2xx — transient skip", {
        tag: "platform-webhook.skipped.github",
        status: ghRes.status,
        platform,
      });
      return NextResponse.json({
        ok: true,
        status: "skipped",
        reason: "transport",
        detail: `github:${ghRes.status}`,
      });
    }
    const ghJson = (await ghRes.json()) as {
      sha?: string;
      commit?: { committer?: { date?: string } };
    };
    if (!ghJson.sha || !ghJson.commit?.committer?.date) {
      logger.warn("platform-webhook-health: github payload missing sha/date", {
        tag: "platform-webhook.skipped.github-shape",
        platform,
      });
      return NextResponse.json({
        ok: true,
        status: "skipped",
        reason: "transport",
        detail: "github-shape",
      });
    }
    githubSha = ghJson.sha;
    githubCommitAt = new Date(ghJson.commit.committer.date);
  } catch (err) {
    logger.warn("platform-webhook-health: github fetch failed — transient skip", {
      tag: "platform-webhook.skipped.github-fetch",
      err,
      platform,
    });
    return NextResponse.json({
      ok: true,
      status: "skipped",
      reason: "transport",
      detail: "github-fetch",
    });
  }

  // ── 4. Fetch prod /api/health ────────────────────────────────────
  let deployedCommit: string;
  try {
    const healthRes = await fetchWithTimeout(`${prodUrl.replace(/\/$/, "")}/api/health`);
    if (healthRes.status >= 500) {
      logger.error("platform-webhook-health: prod /api/health is 5xx — prod-down alarm", {
        tag: "platform-webhook.prod-down",
        healthStatus: healthRes.status,
        platform,
      });
      return NextResponse.json({
        ok: true,
        status: "prod-down",
        alarm: "prod-down",
        healthStatus: healthRes.status,
        platform,
      });
    }
    const healthJson = (await healthRes.json()) as { commit?: string };
    if (!healthJson.commit || healthJson.commit === "unknown") {
      logger.warn("platform-webhook-health: prod /api/health returned no commit — skipping", {
        tag: "platform-webhook.skipped.health-shape",
        platform,
      });
      return NextResponse.json({
        ok: true,
        status: "skipped",
        reason: "transport",
        detail: "health-shape",
      });
    }
    deployedCommit = healthJson.commit;
  } catch (err) {
    logger.warn("platform-webhook-health: health fetch failed — transient skip", {
      tag: "platform-webhook.skipped.health-fetch",
      err,
      platform,
    });
    return NextResponse.json({
      ok: true,
      status: "skipped",
      reason: "transport",
      detail: "health-fetch",
    });
  }

  // ── 5. Compare SHAs ───────────────────────────────────────────────
  const expectedShaShort = githubSha.slice(0, 7);
  if (expectedShaShort === deployedCommit) {
    logger.info("platform-webhook-health: match", {
      tag: "platform-webhook.match",
      sha: expectedShaShort,
      platform,
    });
    return NextResponse.json({
      ok: true,
      status: "match",
      sha: expectedShaShort,
      commit: deployedCommit,
      platform,
    });
  }

  const commitAgeMinutes = (Date.now() - githubCommitAt.getTime()) / 60_000;
  if (commitAgeMinutes < WEBHOOK_STALE_MINUTES) {
    logger.info("platform-webhook-health: commit newer than stale threshold — still deploying", {
      tag: "platform-webhook.deploying",
      expectedSha: expectedShaShort,
      deployedCommit,
      commitAgeMinutes: Math.round(commitAgeMinutes),
      platform,
    });
    return NextResponse.json({
      ok: true,
      status: "match",
      sha: expectedShaShort,
      commit: deployedCommit,
      platform,
    });
  }

  logger.error("platform-webhook-health: silent-main-webhook detected", {
    tag: "platform-webhook.silent",
    expectedSha: expectedShaShort,
    deployedCommit,
    commitAgeMinutes: Math.round(commitAgeMinutes),
    githubCommitAt: githubCommitAt.toISOString(),
    staleThresholdMinutes: WEBHOOK_STALE_MINUTES,
    platform,
  });
  return NextResponse.json({
    ok: true,
    status: "silent",
    alarm: "silent",
    expectedSha: expectedShaShort,
    deployedCommit,
    commitAgeMinutes: Math.round(commitAgeMinutes),
    githubCommitAt: githubCommitAt.toISOString(),
    platform,
  });
}
