/**
 * P1-6 (audit v1.0 §5.12) — Single source of truth for the app version
 * label rendered in the sidebar footer and anywhere else we need to
 * surface "what build is this".
 *
 * Before: the sidebar hardcoded `"v0.1.0"` and the statusLine read
 * `"Sprint 0 scaffold"`. Customers saw "Sprint 0 scaffold" on every
 * page even though we were selling the product as production-ready.
 *
 * After: the version string is pulled at build time from
 * `NEXT_PUBLIC_APP_VERSION` (set by CI / `scripts/version.sh` from
 * the current git tag) with `package.json#version` as the fallback
 * for local dev. No runtime DB query, no secret — this is safe to
 * inline into the client bundle via `NEXT_PUBLIC_*`.
 *
 * The statusLine is retired. The SidebarLabels type still carries a
 * `statusLine?: string` slot so callers that previously set it
 * compile without changes, but we never populate it by default.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
import pkg from "../../package.json";

const PACKAGE_VERSION: string =
  typeof (pkg as { version?: unknown }).version === "string"
    ? (pkg as { version: string }).version
    : "0.0.0";

const ENV_VERSION: string | undefined = process.env.NEXT_PUBLIC_APP_VERSION;

/**
 * The resolved app version. Prefer the env-injected value (set at
 * build time by CI) and fall back to package.json for local dev.
 */
export const APP_VERSION: string =
  ENV_VERSION && ENV_VERSION.length > 0 ? ENV_VERSION : PACKAGE_VERSION;

/**
 * Human-readable label for the sidebar footer. Shape:
 *   "OneAce · v1.0.0-rc13"
 * The brand is passed in so i18n can translate it.
 */
export function getAppVersionLine(brand: string): string {
  return `${brand} · v${APP_VERSION}`;
}
