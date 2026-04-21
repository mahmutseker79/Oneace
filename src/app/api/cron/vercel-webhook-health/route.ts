/**
 * @openapi-tag: /cron/vercel-webhook-health
 *
 * Audit v1.3 §5.45 F-01 — the tag above is the canonical route path.
 * docs/openapi.yaml MUST declare the same path with every HTTP method
 * this file exports. `src/lib/openapi-parity.test.ts` pins the two in
 * lockstep.
 */
/**
 * Vercel webhook silent-push detector (audit v1.3 §5.45).
 *
 * Background — the 2026-04-14 → 2026-04-18 silent-main-webhook
 * incident: three consecutive pushes to `main` (including the v1.5.13
 * edge-logger hotfix tag) landed on GitHub but never triggered a
 * production build on Vercel. The GitHub → Vercel webhook was
 * "connected" in the Vercel UI but in practice the delivery queue was
 * empty for days. Nothing in the observability stack fired. The only
 * way we noticed was by eyeballing https://oneace-next-local.vercel.app
 * and seeing it was still serving v1.2.16 while `main` was on
 * v1.5.13. That is a zero-signal class of incident the v1.3 dossier
 * made P1.
 *
 * What this cron does:
 *
 *   1. Query the GitHub public commits API for the latest SHA on
 *      `main` (`GET /repos/:owner/:repo/commits/main`). Unauthenticated
 *      works for a public repo; if `GITHUB_TOKEN` is present we send
 *      it so private-repo deploys keep working.
 *   2. Fetch the production `/api/health` endpoint and read its
 *      `commit` field (Vercel injects `VERCEL_GIT_COMMIT_SHA` at build
 *      time, and `/api/health` surfaces the first 7 chars).
 *   3. If the GitHub SHA.slice(0,7) differs from the deployed commit
 *      AND the GitHub commit is older than `WEBHOOK_STALE_MINUTES`
 *      (default 30), log an error with `tag: "webhook-health.silent"`
 *      and return 200 `{ alarm: "silent" }`. Ops alert rules watch
 *      for that exact tag.
 *   4. If `/api/health` itself returns a non-200, that is a different
 *      failure mode (prod is down, not silent) — log with
 *      `tag: "webhook-health.prod-down"` so alert routing can split
 *      the two. Still return 200 because the cron itself succeeded;
 *      the body carries the signal.
 *
 * Deliberate non-choices:
 *
 *   - **No `withCronIdempotency`.** The idempotency helper keys on a
 *     UTC-day bucket, which works for the 4 daily cleanup crons but
 *     would silence this cron after its first run each day. We want
 *     roughly 48 runs/day so the mean-time-to-detect a silent webhook
 *     is ~30 min, not 24h. Each run is idempotent in the trivial
 *     sense (it reads two endpoints, emits a log, does not write DB
 *     state), so we skip the helper on purpose.
 *   - **No hard failure on missing env.** If `GITHUB_MAIN_REPO` or
 *     `PUBLIC_PROD_URL` are unset, we log a warn and return 200
 *     `{ skipped: "config" }`. A cron that 500s every tick is noise,
 *     not signal, and this one is supposed to be a silent sentinel
 *     until it actually has something to say.
 *   - **No alarm on network blips.** A single GitHub or `/api/health`
 *     fetch failure is logged at warn level and we return
 *     `{ skipped: "transport" }`. The "silent" alarm only fires when
 *     we successfully read both endpoints AND the deployed commit is
 *     genuinely behind.
 *
 * Auth: CRON_SECRET Bearer header (same pattern as sibling cron routes).
 * Budget: two outbound HTTP fetches + one log, well inside Vercel
 *   Hobby's 60s cron timeout.
 */

import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby cron timeout
// Node runtime: we use `fetch` + `process.env` freely; no Prisma or
// other Node-only libraries, but pinning the runtime keeps this
// consistent with the sibling cron routes and avoids any edge-runtime
// surprise if a future refactor pulls in `@/lib/db`.
export const runtime = "nodejs";

// Window after which a GitHub-main commit that does NOT match the
// deployed SHA is classified as a silent webhook. Vercel free-tier
// builds complete in ~3–5 min; anything beyond 30 min is past the
// point where a healthy webhook + build pipeline would have closed the
// gap. Exposed as a constant so the pinned test can read it without
// import-time side effects.
const WEBHOOK_STALE_MINUTES = 30;

// Per-fetch timeout. Vercel Cron's function timeout is 60s; leaving
// each fetch at the default 10s means a flaky endpoint cannot eat the
// entire cron budget and starve the other check.
const FETCH_TIMEOUT_MS = 10_000;

type OutcomeBody =
  | { ok: true; status: "match"; sha: string; commit: string }
  | {
      ok: true;
      status: "silent";
      alarm: "silent";
      expectedSha: string;
      deployedCommit: string;
      commitAgeMinutes: number;
      githubCommitAt: string;
    }
  | {
      ok: true;
      status: "prod-down";
      alarm: "prod-down";
      healthStatus: number;
    }
  | { ok: true; status: "skipped"; reason: "config" | "transport"; detail?: string };

/** Small helper — fetch with an AbortController-backed timeout. */
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
    logger.warn("CRON_SECRET not configured for vercel-webhook-health", {
      tag: "cron.vercel-webhook-health.no-secret",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "CRON_SECRET" },
      { status: 500 },
    );
  }

  if (!cronSecret || cronSecret !== expectedSecret) {
    logger.warn("Invalid cron secret for vercel-webhook-health", {
      tag: "cron.vercel-webhook-health.unauthorized",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "unauthorized" },
      { status: 401 },
    );
  }

  // ── 2. Required config ────────────────────────────────────────────
  // Format: "owner/repo" — e.g. "mahmutseker79/Oneace". Kept as a
  // single env var so local dev just sets one knob, not two.
  const mainRepo = process.env.GITHUB_MAIN_REPO;
  // Public URL of the production deployment. We read `/api/health`
  // off this origin — it has to be the PROD origin, not a preview
  // alias, otherwise we would be comparing main SHA against a
  // preview's SHA and get a false-positive silent alarm every push.
  const prodUrl = process.env.PUBLIC_PROD_URL;

  if (!mainRepo || !prodUrl) {
    logger.warn("webhook-health: skipping — missing config", {
      tag: "webhook-health.skipped.config",
      hasRepo: Boolean(mainRepo),
      hasProdUrl: Boolean(prodUrl),
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
      "User-Agent": "oneace-webhook-health",
    };
    const ghToken = process.env.GITHUB_TOKEN;
    if (ghToken) ghHeaders.Authorization = `Bearer ${ghToken}`;

    const ghRes = await fetchWithTimeout(
      `https://api.github.com/repos/${mainRepo}/commits/main`,
      { headers: ghHeaders },
    );
    if (!ghRes.ok) {
      logger.warn("webhook-health: github api non-2xx — treating as transient", {
        tag: "webhook-health.skipped.github",
        status: ghRes.status,
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
      logger.warn("webhook-health: github payload missing sha/date", {
        tag: "webhook-health.skipped.github-shape",
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
    logger.warn("webhook-health: github fetch failed — treating as transient", {
      tag: "webhook-health.skipped.github-fetch",
      err,
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
  let healthStatus: number;
  try {
    const healthRes = await fetchWithTimeout(`${prodUrl.replace(/\/$/, "")}/api/health`);
    healthStatus = healthRes.status;
    if (healthRes.status >= 500) {
      // Prod is returning 5xx — this is the distinct "prod-down"
      // failure mode. Emit with a separate tag so alerts don't
      // conflate it with silent-webhook.
      logger.error("webhook-health: prod /api/health is 5xx — prod-down alarm", {
        tag: "webhook-health.prod-down",
        healthStatus: healthRes.status,
      });
      return NextResponse.json({
        ok: true,
        status: "prod-down",
        alarm: "prod-down",
        healthStatus: healthRes.status,
      });
    }
    const healthJson = (await healthRes.json()) as { commit?: string };
    if (!healthJson.commit || healthJson.commit === "unknown") {
      logger.warn("webhook-health: prod /api/health returned no commit — skipping", {
        tag: "webhook-health.skipped.health-shape",
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
    logger.warn("webhook-health: health fetch failed — treating as transient", {
      tag: "webhook-health.skipped.health-fetch",
      err,
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
    // Happy path — prod is on the tip of main. This is the overwhelmingly
    // common outcome; keep the log at info level so it is visible but
    // not noisy.
    logger.info("webhook-health: match", {
      tag: "webhook-health.match",
      sha: expectedShaShort,
    });
    return NextResponse.json({
      ok: true,
      status: "match",
      sha: expectedShaShort,
      commit: deployedCommit,
    });
  }

  // SHAs differ. Compute commit age; only raise the silent alarm if
  // enough time has elapsed that a healthy webhook + build should have
  // closed the gap by now.
  const commitAgeMinutes = (Date.now() - githubCommitAt.getTime()) / 60_000;
  if (commitAgeMinutes < WEBHOOK_STALE_MINUTES) {
    logger.info("webhook-health: commit newer than stale threshold — still deploying", {
      tag: "webhook-health.deploying",
      expectedSha: expectedShaShort,
      deployedCommit,
      commitAgeMinutes: Math.round(commitAgeMinutes),
    });
    return NextResponse.json({
      ok: true,
      status: "match",
      sha: expectedShaShort,
      commit: deployedCommit,
    });
  }

  // Silent alarm. Log at error level with the structured tag that the
  // ops alert rule watches for.
  logger.error("webhook-health: silent-main-webhook detected", {
    tag: "webhook-health.silent",
    expectedSha: expectedShaShort,
    deployedCommit,
    commitAgeMinutes: Math.round(commitAgeMinutes),
    githubCommitAt: githubCommitAt.toISOString(),
    staleThresholdMinutes: WEBHOOK_STALE_MINUTES,
  });
  return NextResponse.json({
    ok: true,
    status: "silent",
    alarm: "silent",
    expectedSha: expectedShaShort,
    deployedCommit,
    commitAgeMinutes: Math.round(commitAgeMinutes),
    githubCommitAt: githubCommitAt.toISOString(),
  });
}
