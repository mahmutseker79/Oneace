/**
 * @openapi-tag: /cron/platform-quota-health
 *
 * Audit v1.3 §5.48 F-04 — platform-agnostic successor to the prior
 * `vercel-quota-health` route. The alarm policy (80/100/≥100 of the
 * billing-period ceiling) is identical; the difference is that the
 * Vercel-API call is extracted behind `src/lib/hosting-platform` so
 * the same route works on Netlify (300 build-minutes/month ceiling).
 *
 * docs/openapi.yaml MUST declare `/cron/platform-quota-health` with
 * every HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
/**
 * Platform-neutral deploy / build-budget watchdog.
 *
 * What the cron does:
 *   1. Auth via CRON_SECRET Bearer header.
 *   2. Detect active platform (VERCEL=1 / NETLIFY=true / explicit
 *      HOSTING_PLATFORM override). On `unknown` → skipped/config.
 *   3. Ask the platform adapter for `{count, ceiling, unit}`.
 *   4. Decide against a policy that's expressed as a % of ceiling so
 *      it works for both deploy-counts (Vercel) and build-minutes
 *      (Netlify):
 *         count / ceiling  < 0.80  → quota-ok
 *         count / ceiling >= 0.80  → quota-warn
 *         count / ceiling >= 1.00  → quota-exceeded
 *   5. Emit a structured log at info/warn/error with the
 *      `platform-quota.*` tag that ops alert rules watch for.
 *
 * Deliberate non-choices:
 *   - No `withCronIdempotency` — the cron must run multiple times per
 *     budgeting period so headroom trends are visible.
 *   - No PostHog. Infra concern, not product.
 *   - Adapter returns a raw `count`; the % policy is route-side, not
 *     adapter-side, so future platforms don't need to re-derive it.
 *
 * Ops alert mapping (grep these in your rules file):
 *   platform-quota.ok / platform-quota.warn / platform-quota.exceeded
 *   platform-quota.skipped.config / platform-quota.skipped.api
 *
 * Auth: CRON_SECRET Bearer header.
 */

import { detectPlatform, getQuotaProvider } from "@/lib/hosting-platform";
import { logger } from "@/lib/logger";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const runtime = "nodejs";

// Alarm thresholds. Expressed as fractions of the ceiling so the same
// route works for Vercel's "100 deploys/day" and Netlify's "300
// minutes/month" without platform-specific tuning.
const WARN_RATIO = 0.80;

type OutcomeBody =
  | {
      ok: true;
      status: "quota-ok";
      platform: string;
      count: number;
      ceiling: number;
      unit: string;
    }
  | {
      ok: true;
      status: "quota-warn";
      alarm: "warn";
      platform: string;
      count: number;
      ceiling: number;
      unit: string;
      warnAt: number;
    }
  | {
      ok: true;
      status: "quota-exceeded";
      alarm: "exceeded";
      platform: string;
      count: number;
      ceiling: number;
      unit: string;
    }
  | { ok: true; status: "skipped"; reason: "config" | "transport"; detail?: string };

export async function GET(request: NextRequest): Promise<NextResponse<OutcomeBody>> {
  // ── 1. Auth gate ──────────────────────────────────────────────────
  const cronSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.warn("CRON_SECRET not configured for platform-quota-health", {
      tag: "cron.platform-quota-health.no-secret",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "CRON_SECRET" },
      { status: 500 },
    );
  }

  if (!cronSecret || cronSecret !== expectedSecret) {
    logger.warn("Invalid cron secret for platform-quota-health", {
      tag: "cron.platform-quota-health.unauthorized",
    });
    return NextResponse.json(
      { ok: true, status: "skipped", reason: "config", detail: "unauthorized" },
      { status: 401 },
    );
  }

  // ── 2. Platform dispatch ──────────────────────────────────────────
  const platform = detectPlatform();
  const provider = await getQuotaProvider(platform);
  if (!provider) {
    logger.warn("platform-quota-health: no adapter for platform — skipping", {
      tag: "platform-quota.skipped.config",
      platform,
    });
    return NextResponse.json({
      ok: true,
      status: "skipped",
      reason: "config",
      detail: `no-adapter:${platform}`,
    });
  }

  // ── 3. Fetch snapshot ─────────────────────────────────────────────
  const result = await provider.fetchSnapshot();
  if (!result.ok) {
    const tag =
      result.reason === "config"
        ? "platform-quota.skipped.config"
        : "platform-quota.skipped.api";
    logger.warn(`platform-quota-health: ${result.reason} skip`, {
      tag,
      platform: provider.platform,
      detail: result.detail,
    });
    return NextResponse.json({
      ok: true,
      status: "skipped",
      reason: result.reason,
      detail: result.detail,
    });
  }

  const { count, ceiling, unit } = result.snapshot;
  const warnAt = Math.floor(ceiling * WARN_RATIO);

  // ── 4. Threshold decision ────────────────────────────────────────
  if (count >= ceiling) {
    logger.error("platform-quota-health: budget exceeded", {
      tag: "platform-quota.exceeded",
      platform: provider.platform,
      count,
      ceiling,
      unit,
      detail: result.snapshot.platformDetail,
    });
    return NextResponse.json({
      ok: true,
      status: "quota-exceeded",
      alarm: "exceeded",
      platform: provider.platform,
      count,
      ceiling,
      unit,
    });
  }

  if (count >= warnAt) {
    logger.warn("platform-quota-health: approaching budget ceiling", {
      tag: "platform-quota.warn",
      platform: provider.platform,
      count,
      ceiling,
      unit,
      warnAt,
      detail: result.snapshot.platformDetail,
    });
    return NextResponse.json({
      ok: true,
      status: "quota-warn",
      alarm: "warn",
      platform: provider.platform,
      count,
      ceiling,
      unit,
      warnAt,
    });
  }

  logger.info("platform-quota-health: within headroom", {
    tag: "platform-quota.ok",
    platform: provider.platform,
    count,
    ceiling,
    unit,
    warnAt,
  });
  return NextResponse.json({
    ok: true,
    status: "quota-ok",
    platform: provider.platform,
    count,
    ceiling,
    unit,
  });
}
