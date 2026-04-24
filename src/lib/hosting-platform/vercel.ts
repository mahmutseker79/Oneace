/**
 * Vercel quota adapter — extracted from the original
 * /api/cron/vercel-quota-health route so the route becomes a thin
 * threshold decider that works on any hosting platform.
 *
 * Semantics: count deployments since UTC-midnight. Vercel Hobby plan
 * allows 100 deploys / UTC day; pagination caps at MAX_PAGES so a
 * misconfigured project can't wedge the cron into a many-thousand-row
 * walk.
 *
 * Required env:
 *   - VERCEL_TOKEN      : API token with "read deployments" scope
 *   - VERCEL_PROJECT_ID : project ID to scope the query to
 *   - VERCEL_TEAM_ID    : optional, personal accounts don't have one
 */

import type { QuotaFetchResult, QuotaProvider } from "./index";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_PAGES = 10;
const PAGE_SIZE = 20;
/** Vercel Hobby plan daily ceiling — raw count only; threshold policy lives on the route. */
const VERCEL_DAILY_QUOTA = 100;

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function utcMidnightMs(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function createVercelQuotaProvider(): QuotaProvider {
  return {
    platform: "vercel",
    async fetchSnapshot(): Promise<QuotaFetchResult> {
      const vercelToken = process.env.VERCEL_TOKEN;
      const vercelProjectId = process.env.VERCEL_PROJECT_ID;
      const vercelTeamId = process.env.VERCEL_TEAM_ID; // optional

      if (!vercelToken || !vercelProjectId) {
        return { ok: false, reason: "config", detail: "VERCEL_TOKEN/PROJECT_ID" };
      }

      const since = utcMidnightMs(new Date());
      let count = 0;
      let nextCursor: number | null = null;

      try {
        for (let page = 0; page < MAX_PAGES; page++) {
          const params = new URLSearchParams({
            projectId: vercelProjectId,
            since: String(since),
            limit: String(PAGE_SIZE),
          });
          if (nextCursor !== null) params.set("until", String(nextCursor));
          if (vercelTeamId) params.set("teamId", vercelTeamId);

          const res = await fetchWithTimeout(`https://api.vercel.com/v6/deployments?${params}`, {
            headers: { Authorization: `Bearer ${vercelToken}` },
          });
          if (!res.ok) {
            return {
              ok: false,
              reason: "transport",
              detail: `vercel:${res.status}`,
            };
          }
          const body = (await res.json()) as {
            deployments?: unknown[];
            pagination?: { next?: number | null };
          };
          const rows = Array.isArray(body.deployments) ? body.deployments.length : 0;
          count += rows;

          const next = body.pagination?.next ?? null;
          // Stop when Vercel says no more rows, OR when already past the
          // ceiling — sharper numbers past 100 don't change the alarm.
          if (!next || count >= VERCEL_DAILY_QUOTA) break;
          nextCursor = next;
        }
      } catch {
        return { ok: false, reason: "transport", detail: "vercel-fetch" };
      }

      return {
        ok: true,
        snapshot: {
          count,
          ceiling: VERCEL_DAILY_QUOTA,
          unit: "deploys/day",
          platformDetail: { projectId: vercelProjectId, since },
        },
      };
    },
  };
}
