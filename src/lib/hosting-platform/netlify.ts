/**
 * Netlify quota adapter — parity companion to `./vercel.ts`.
 *
 * Netlify Free plan quotas:
 *   - 300 build minutes / month
 *   - 125k function invocations / month
 *   - Unlimited deploys (no per-day ceiling like Vercel Hobby's 100)
 *
 * "Build minutes" is the only one that blocks deploys when exceeded,
 * mirroring Vercel's deploy-count behavior. The alarm semantics are
 * "% of monthly budget burned" rather than raw deploy count.
 *
 * Netlify doesn't publish a stable public-API endpoint for the exact
 * minutes-used counter that the dashboard displays. The closest
 * reliable signal is the per-site deploys listing — we sum deploy
 * durations in the current calendar month and cap pagination the same
 * way the Vercel adapter does.
 *
 * If a future Netlify API release exposes an authoritative
 * "/accounts/:id/build_minutes_used" endpoint, swap `fetchSnapshot`
 * to call it; the adapter interface is stable.
 *
 * Required env:
 *   - NETLIFY_TOKEN   : personal access token with read scope
 *   - NETLIFY_SITE_ID : site ID to aggregate deploys for
 */

import type { QuotaFetchResult, QuotaProvider } from "./index";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PAGES = 10;
const PAGE_SIZE = 50;
/** Netlify Free plan monthly ceiling (minutes). */
const NETLIFY_MONTHLY_QUOTA_MINUTES = 300;

interface NetlifyDeploy {
  created_at?: string;
  deploy_time?: number | null; // seconds
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** ISO string for the first instant of the current UTC month. */
function utcMonthStartIso(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

export function createNetlifyQuotaProvider(): QuotaProvider {
  return {
    platform: "netlify",
    async fetchSnapshot(): Promise<QuotaFetchResult> {
      const netlifyToken = process.env.NETLIFY_TOKEN;
      const netlifySiteId = process.env.NETLIFY_SITE_ID;

      if (!netlifyToken || !netlifySiteId) {
        return { ok: false, reason: "config", detail: "NETLIFY_TOKEN/SITE_ID" };
      }

      const monthStartIso = utcMonthStartIso(new Date());
      const monthStartMs = new Date(monthStartIso).getTime();

      let totalSeconds = 0;

      try {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const params = new URLSearchParams({
            page: String(page),
            per_page: String(PAGE_SIZE),
          });

          const res = await fetchWithTimeout(
            `https://api.netlify.com/api/v1/sites/${encodeURIComponent(netlifySiteId)}/deploys?${params}`,
            { headers: { Authorization: `Bearer ${netlifyToken}` } },
          );
          if (!res.ok) {
            return {
              ok: false,
              reason: "transport",
              detail: `netlify:${res.status}`,
            };
          }

          const rows = (await res.json()) as NetlifyDeploy[];
          if (!Array.isArray(rows) || rows.length === 0) break;

          let reachedBoundary = false;
          for (const row of rows) {
            const createdAt = row.created_at
              ? new Date(row.created_at).getTime()
              : NaN;
            if (!Number.isFinite(createdAt) || createdAt < monthStartMs) {
              // Deploys are ordered newest-first; hitting one older than
              // the month boundary means the rest are too. Stop paging.
              reachedBoundary = true;
              break;
            }
            // deploy_time is in seconds; treat null/undefined as 0
            // (build still pending / skipped).
            totalSeconds += typeof row.deploy_time === "number"
              ? Math.max(0, row.deploy_time)
              : 0;
          }
          if (reachedBoundary || rows.length < PAGE_SIZE) break;
        }
      } catch {
        return { ok: false, reason: "transport", detail: "netlify-fetch" };
      }

      const totalMinutes = Math.ceil(totalSeconds / 60);

      return {
        ok: true,
        snapshot: {
          count: totalMinutes,
          ceiling: NETLIFY_MONTHLY_QUOTA_MINUTES,
          unit: "build-minutes/month",
          platformDetail: {
            siteId: netlifySiteId,
            monthStart: monthStartIso,
            totalSeconds,
          },
        },
      };
    },
  };
}
