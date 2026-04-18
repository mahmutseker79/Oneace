// v1.2 P2 §5.37 — shared marketing-page metadata builder.
//
// Before this helper, every marketing `page.tsx` under
// `src/app/(marketing)/` exported its own `Metadata` literal with
// only `title` + `description`. None of them overrode `openGraph` or
// `twitter`, so public social previews fell back to the root layout's
// site-wide defaults. LinkedIn / X / Slack unfurl of a specific doc
// page showed the generic "OneAce — Inventory management…" card
// rather than the page-specific content — the audit (§5.37) called
// this "OG/Twitter metadata sparse — 3 pages only".
//
// `buildMarketingMetadata` concentrates the OG + Twitter shape in one
// place so a future tweak (adding `images`, switching the card type,
// wiring a canonical URL) lands once instead of in N files. Each
// marketing page calls this helper with its own title + description
// + path; the helper returns the full `Metadata` object to export.
//
// Contract pinned by `src/lib/seo-metadata.test.ts`.

import type { Metadata } from "next";

/**
 * Options for a marketing page's metadata block.
 *
 * - `title`: the page-specific title *without* the "— OneAce" suffix.
 *   The helper appends the brand so every page stays consistent.
 * - `description`: user-facing description used in search results and
 *   social unfurls. 120–180 chars is the safe zone for Twitter and
 *   LinkedIn previews.
 * - `path`: the route path without the origin (e.g. "/docs/warehouses").
 *   Used to build an absolute `openGraph.url` from `NEXT_PUBLIC_APP_URL`
 *   when set. The helper degrades gracefully to a relative path when
 *   `NEXT_PUBLIC_APP_URL` is missing (local dev).
 */
export interface MarketingMetadataInput {
  title: string;
  description: string;
  path: string;
}

const BRAND = "OneAce";
const TITLE_SUFFIX = ` — ${BRAND}`;

/**
 * Decide whether to append `TITLE_SUFFIX` to a caller-supplied title.
 *
 * The brand should appear exactly once. We skip the append when the
 * title already ends with the suffix (trailing brand, the default
 * shape) OR starts with `"OneAce "` / `"OneAce—"` / `"OneAce –"`
 * (leading brand — e.g. the landing page `"OneAce — Inventory
 * Management…"`). We use a word-boundary check so `"OneAce2"` would
 * still trigger the append, keeping the guard tight.
 */
function shouldAppendSuffix(title: string): boolean {
  if (title.endsWith(TITLE_SUFFIX)) return false;
  // Leading-brand shape — trimmed, then followed by a non-alphanumeric
  // (space, em/en dash, colon). `^BRAND(\W|$)` in one line.
  if (title.startsWith(BRAND)) {
    const nextChar = title.charAt(BRAND.length);
    if (nextChar === "" || !/[A-Za-z0-9]/.test(nextChar)) return false;
  }
  return true;
}

/**
 * Resolve the absolute URL for a marketing page. Falls back to the
 * relative path when the public origin is not configured — keeps the
 * helper safe to import in unit tests that don't stub env.
 */
function resolveCanonicalUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!origin) {
    return path;
  }
  // Trim a trailing slash on the origin so we don't emit `//`.
  const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedOrigin}${normalizedPath}`;
}

/**
 * Build the `Metadata` export for a marketing page. The returned
 * object always carries:
 *   - `title` (with " — OneAce" suffix appended once)
 *   - `description`
 *   - `alternates.canonical` (absolute when origin env is set)
 *   - `openGraph.{type,siteName,url,title,description}`
 *   - `twitter.{card,title,description}`
 *
 * Pages can still merge additional fields post-hoc (`{ ...base,
 * robots: { index: false } }`) — the helper is additive, not
 * prescriptive.
 */
export function buildMarketingMetadata({
  title,
  description,
  path,
}: MarketingMetadataInput): Metadata {
  const fullTitle = shouldAppendSuffix(title) ? `${title}${TITLE_SUFFIX}` : title;
  const url = resolveCanonicalUrl(path);
  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      siteName: BRAND,
      url,
      title: fullTitle,
      description,
    },
    twitter: {
      // `summary_large_image` is the preferred card for content pages
      // that will eventually carry a per-page hero image. The root
      // layout defaults to plain `summary`; marketing overrides step
      // up to `summary_large_image` so docs/legal unfurls use the
      // larger preview slot even before we ship per-page images.
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}
