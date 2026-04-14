/**
 * Phase 14.5 — Vercel Analytics integration.
 *
 * @vercel/analytics tracks pageviews and Web Vitals automatically.
 * It is privacy-respecting (no PII, no cookies), GDPR-friendly, and
 * gracefully no-ops outside the Vercel deployment environment.
 *
 * Requires `pnpm install` to install the @vercel/analytics package.
 * The app boots without it — analytics are enhancement-only.
 */

// @ts-expect-error @vercel/analytics is in package.json; run `pnpm install` to resolve.
import { Analytics } from "@vercel/analytics/next";

export function VercelAnalytics() {
  // Only enable in production. No-op in dev/CI.
  if (process.env.NODE_ENV !== "production") return null;
  return <Analytics />;
}
