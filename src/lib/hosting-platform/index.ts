/**
 * Hosting platform abstraction (audit v1.3 F-01 / F-04 closure).
 *
 * Motivation — the Faz 1 Netlify POC scaffold made it painfully obvious
 * that our "vercel-*" cron routes bake the platform into both the
 * function name AND the API it calls. A silent webhook or quota alarm
 * on Netlify was therefore either misleading ("vercel-quota-health"
 * on a Netlify site is a lie) or dead ("vercel-quota-health" can't
 * reach Vercel's API from a Netlify function without a token it has
 * no reason to own).
 *
 * This module centralizes:
 *
 *   1. `detectPlatform()` — resolves the active hosting platform from
 *      env hints. Explicit `HOSTING_PLATFORM` always wins; otherwise
 *      Netlify/Vercel flags disambiguate; otherwise `unknown`. This is
 *      the same dispatch `scripts/netlify-env-shim.mjs` uses in reverse.
 *   2. `QuotaProvider` interface — the contract a platform adapter
 *      fulfils. Each adapter returns a normalized `{count, ceiling,
 *      warnAt}` triple, plus a platform-specific detail object that
 *      the route can surface for debuggability without needing to
 *      branch on platform itself.
 *   3. `getQuotaProvider(platform)` — factory returning the adapter.
 *      Platforms we don't have adapters for (self-host, Cloudflare
 *      Pages) return `null` → route logs `skipped: config` and 200s.
 *
 * Non-goals:
 *   - No global state. The detection is stateless — every call reads
 *     process.env fresh so unit tests can override with `vi.stubEnv`.
 *   - No alarm thresholds live here. `DAILY_QUOTA` / `WARN_THRESHOLD`
 *     are policy that lives on the route; the adapter just returns the
 *     raw count. This keeps adapter logic testable without the route.
 *
 * When to extend:
 *   - Adding a new platform (e.g. Cloudflare Pages): add the string to
 *     `HostingPlatform`, add a detect branch, write a `cloudflare.ts`
 *     adapter, add it to `getQuotaProvider`'s switch, and extend the
 *     pinned test with a stubEnv case.
 */

export type HostingPlatform = "vercel" | "netlify" | "unknown";

/**
 * Resolve the active hosting platform from env. Order of precedence:
 *   1. `HOSTING_PLATFORM` — explicit override. Always wins when set to
 *      a known platform string.
 *   2. `VERCEL === "1"` — native flag injected by Vercel build + runtime.
 *   3. `NETLIFY === "true"` — native flag injected by Netlify build.
 *   4. Fall through to `"unknown"` — local dev or self-host.
 *
 * Note: both `VERCEL` and `NETLIFY` can co-exist in rare misconfig
 * scenarios (e.g. a local shell that has both set). The explicit
 * `HOSTING_PLATFORM` override is the escape hatch for that case —
 * otherwise `VERCEL` is preferred over `NETLIFY` because Vercel was
 * the original host and any legacy env is more likely to have it set
 * than Netlify.
 */
export function detectPlatform(): HostingPlatform {
  const override = process.env.HOSTING_PLATFORM?.toLowerCase();
  if (override === "vercel" || override === "netlify") return override;

  if (process.env.VERCEL === "1") return "vercel";
  if (process.env.NETLIFY === "true") return "netlify";

  return "unknown";
}

export interface QuotaSnapshot {
  /** Raw count of billable units used this period (deploys, build-minutes, ...) */
  readonly count: number;
  /** Platform's hard ceiling for the billing period. */
  readonly ceiling: number;
  /**
   * Human-readable unit string — `"deploys/day"`, `"build-minutes/month"`, etc.
   * Used in structured log payloads so alert consumers don't have to guess.
   */
  readonly unit: string;
  /**
   * Platform-specific raw payload. Routes MUST NOT read fields from
   * this in decision logic — it's for diagnostic logging only. The
   * normalized `count` / `ceiling` / `unit` triple is the decision
   * surface.
   */
  readonly platformDetail?: Record<string, unknown>;
}

export type QuotaFetchResult =
  | { ok: true; snapshot: QuotaSnapshot }
  | {
      ok: false;
      reason: "config" | "transport";
      /** Short identifier the route can put in the log payload, e.g. "vercel:401". */
      detail?: string;
    };

export interface QuotaProvider {
  /**
   * Identifier included in log tags so the same alert rule can split
   * by platform. Values: `"vercel" | "netlify"`.
   */
  readonly platform: Exclude<HostingPlatform, "unknown">;
  /**
   * Fetch the current quota snapshot. Implementations must not throw —
   * transport failures return `{ok:false, reason:"transport"}`.
   */
  fetchSnapshot(): Promise<QuotaFetchResult>;
}

/**
 * Resolve the quota adapter for the active platform, or null if we
 * don't have an adapter for it. `null` is the expected value on
 * `unknown` — local dev doesn't need a quota watchdog.
 */
export async function getQuotaProvider(
  platform: HostingPlatform = detectPlatform(),
): Promise<QuotaProvider | null> {
  switch (platform) {
    case "vercel": {
      const mod = await import("./vercel");
      return mod.createVercelQuotaProvider();
    }
    case "netlify": {
      const mod = await import("./netlify");
      return mod.createNetlifyQuotaProvider();
    }
    case "unknown":
      return null;
  }
}
