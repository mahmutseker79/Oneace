/**
 * P3-4 (audit v1.0 §14.8) — regression fence around the security
 * headers configured in `next.config.ts`.
 *
 * Phase 6A shipped a meaningful starter CSP plus HSTS,
 * Permissions-Policy, COOP, and a beefed-up header set. The audit
 * flagged two risks:
 *
 *  1. Someone "quick-fixes" a CSP violation by dropping the
 *     directive (e.g. removes `frame-ancestors 'none'` because a
 *     marketing iframe broke) instead of allow-listing properly.
 *  2. A later refactor switches to a nonce-based CSP and
 *     accidentally drops the `'unsafe-eval'` → `'unsafe-inline'`
 *     transition plan, or re-introduces one of the now-required
 *     directives (object-src, base-uri, form-action, frame-ancestors).
 *
 * A real "does Vercel send these headers" probe lives in
 * `scripts/verify.sh deploy`. This test is the *contract* layer:
 * it reads `next.config.ts` as text and pins the directives that
 * must stay. Static analysis is cheap, deterministic, and catches
 * the regression the moment the config changes — well before a
 * deploy.
 *
 * The assertions below are intentionally anchored to directive
 * *content*, not string shape. We match `frame-ancestors 'none'`
 * as a whole token rather than counting quotes or whitespace so
 * a trivial reformat (different indentation, single vs. double
 * quotes inside the string literal) does not trigger a false
 * failure.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const NEXT_CONFIG = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

/** Yank a header's `value:` string out of the config source. */
function headerValue(headerName: string): string {
  // Matches: key: "X-Frame-Options", value: "SAMEORIGIN"
  // and the multi-line CSP form where `value:` is followed by an
  // array whose pieces are `.join("; ")`-ed together.
  const single = new RegExp(
    `key:\\s*"${headerName}",\\s*(?:\\n\\s*//[^\\n]*)*\\s*value:\\s*"([^"]+)"`,
  );
  const m = NEXT_CONFIG.match(single);
  if (m) return m[1];

  // Array form (used for CSP).
  const arrayRegex = new RegExp(
    `key:\\s*"${headerName}",\\s*(?:\\n\\s*//[^\\n]*)*\\s*value:\\s*\\[([\\s\\S]*?)\\]\\.join\\(`,
  );
  const arr = NEXT_CONFIG.match(arrayRegex);
  if (arr) {
    // Re-join with "; " to simulate runtime value.
    return arr[1]
      .split(/,\s*\n/)
      .map((line) =>
        line
          .trim()
          .replace(/^\/\/.*$/, "")
          .replace(/^"|",?$/g, "")
          .trim(),
      )
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

describe("Security headers — static contract (§14.8)", () => {
  it("exports a `headers()` function that registers the security header set", () => {
    expect(NEXT_CONFIG).toMatch(/async\s+headers\s*\(\s*\)/);
    expect(NEXT_CONFIG).toMatch(/source:\s*"\/\(\.\*\)"/);
    expect(NEXT_CONFIG).toMatch(/headers:\s*securityHeaders/);
  });

  it("registers the security headers for every route (wildcard source)", () => {
    // `source: "/(.*)"` means the header set hits every request,
    // including /api and /_next. If someone scopes it to `/`
    // by mistake, the API routes drop to bare Next defaults.
    const matches = NEXT_CONFIG.match(/source:\s*"\/\(\.\*\)"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Baseline X-* and Referrer headers (§14.8)", () => {
  it("X-Content-Type-Options is nosniff", () => {
    expect(headerValue("X-Content-Type-Options")).toBe("nosniff");
  });

  it("X-Frame-Options is SAMEORIGIN", () => {
    expect(headerValue("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("Referrer-Policy is strict-origin-when-cross-origin", () => {
    expect(headerValue("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});

describe("HSTS (§14.8)", () => {
  const hsts = headerValue("Strict-Transport-Security");

  it("sets a max-age of at least one year", () => {
    // The HSTS preload list requires >= 31536000 (1 year).
    const match = hsts.match(/max-age\s*=\s*(\d+)/);
    expect(match, `HSTS header missing max-age directive: "${hsts}"`).not.toBeNull();
    if (match) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(31_536_000);
    }
  });

  it("applies to subdomains", () => {
    expect(hsts).toMatch(/includeSubDomains/);
  });

  it("is preload-eligible", () => {
    // `preload` is the signal we want to submit to the HSTS
    // preload list. Dropping it silently disqualifies the domain.
    expect(hsts).toMatch(/preload/);
  });
});

describe("Content-Security-Policy directives (§14.8)", () => {
  const csp = headerValue("Content-Security-Policy");

  it("pins default-src to 'self'", () => {
    expect(csp).toMatch(/default-src\s+'self'/);
  });

  it("blocks same-origin object embeds (object-src 'none')", () => {
    expect(csp).toMatch(/object-src\s+'none'/);
  });

  it("locks frame-ancestors to 'none' (click-jack hard stop)", () => {
    // This is the CSP equivalent of X-Frame-Options: DENY and is
    // strictly stronger; browsers give CSP frame-ancestors
    // priority when both are present.
    expect(csp).toMatch(/frame-ancestors\s+'none'/);
  });

  it("locks base-uri to 'self' (base-tag injection hard stop)", () => {
    expect(csp).toMatch(/base-uri\s+'self'/);
  });

  it("locks form-action to 'self' (form-exfil hard stop)", () => {
    expect(csp).toMatch(/form-action\s+'self'/);
  });

  it("restricts script-src to 'self' + documented unsafe tokens", () => {
    expect(csp).toMatch(/script-src\s+'self'\s+'unsafe-inline'\s+'unsafe-eval'/);
    // Regression fence: if we ever drop 'unsafe-eval' (i.e. the
    // nonce pipeline lands), update this test deliberately so a
    // reviewer notices the CSP tightening. Until then we pin it
    // so a drive-by `'none'` doesn't break Next's HMR bootstrap.
  });

  it("allows self + Sentry ingest for connect-src", () => {
    expect(csp).toMatch(/connect-src[^;]+'self'/);
    expect(csp).toMatch(/connect-src[^;]+https:\/\/\*\.ingest\.sentry\.io/);
  });

  it("allows worker blob URLs (PWA service worker needs them)", () => {
    expect(csp).toMatch(/worker-src\s+'self'\s+blob:/);
  });

  it("pins manifest-src to 'self' (prevents PWA manifest swap)", () => {
    expect(csp).toMatch(/manifest-src\s+'self'/);
  });

  it("restricts font-src to 'self' and data: only", () => {
    // If someone pulls in a remote font CDN, the commit must
    // update this test and justify the expansion.
    expect(csp).toMatch(/font-src\s+'self'\s+data:/);
  });

  it("allows inline styles (Next 15 first-paint requires it)", () => {
    // Documented-gap directive. When a nonce-based CSP lands,
    // update this assertion to require nonces instead.
    expect(csp).toMatch(/style-src[^;]+'unsafe-inline'/);
  });

  it("does NOT globally allow wildcard scripts or objects", () => {
    expect(csp).not.toMatch(/script-src[^;]*\*[;\s]/);
    expect(csp).not.toMatch(/object-src[^;]*\*[;\s]/);
    expect(csp).not.toMatch(/default-src[^;]*\*[;\s]/);
  });
});

describe("Permissions-Policy (§14.8)", () => {
  const perms = headerValue("Permissions-Policy");

  it("allows camera only on same-origin (barcode scan surface)", () => {
    expect(perms).toMatch(/camera=\(self\)/);
  });

  it("denies microphone access", () => {
    expect(perms).toMatch(/microphone=\(\)/);
  });

  it("denies geolocation access", () => {
    expect(perms).toMatch(/geolocation=\(\)/);
  });

  it("denies FLoC / Topics API (interest-cohort)", () => {
    expect(perms).toMatch(/interest-cohort=\(\)/);
  });
});

describe("Cross-Origin isolation (§14.8)", () => {
  it("sets Cross-Origin-Opener-Policy: same-origin", () => {
    expect(headerValue("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });
});
