import type { NextConfig } from "next";

// Phase 6A / P3 — security headers expansion.
//
// The pre-Phase-6A header set was a bare-minimum starter: nosniff,
// frame-options (SAMEORIGIN), and referrer-policy. This block extends
// it with HSTS, a starter Content-Security-Policy, a
// Permissions-Policy, Cross-Origin-Opener-Policy, and
// X-DNS-Prefetch-Control. The goal is "meaningfully better than
// default Next.js" without introducing a nonce pipeline — that is
// deliberately deferred because wiring per-request CSP nonces
// requires touching the server component render path and the
// service-worker cache keys, which is well out of scope for Phase
// 6A.
//
// Starter CSP note — IMPORTANT
// ----------------------------
// The `script-src` directive below includes `'unsafe-inline'` and
// `'unsafe-eval'`. Next.js 15's client bootstrap inlines small
// hydration scripts and the dev-mode React runtime uses `eval` for
// HMR. A nonce-based CSP is the correct long-term fix (it lets us
// drop both unsafe-* tokens), but requires Next middleware edits to
// set a per-request nonce header and the metadata layer to propagate
// it into every inline <script> — a Phase 6B patch. Until then this
// starter policy still provides real value: it blocks remote
// script loading from arbitrary origins, which is the #1 vector for
// stored-XSS exploitation, and it locks down `frame-ancestors`,
// `base-uri`, and `form-action` — none of which Next's defaults set.
//
// HSTS note
// ---------
// `max-age=31536000; includeSubDomains; preload` is the three-part
// value the HSTS preload list requires. We include `preload` so the
// app is submission-ready once it goes behind a stable domain, but
// submission itself is a Post-MVP action and does not affect this
// commit.

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Phase 6A / P3 additions below. Existing headers above intentionally
  // preserved byte-for-byte.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      // Image sources: self + data: (for inlined thumbnails and
      // avatars) + https: (for the two remotePatterns above and
      // any Next/image optimization CDNs).
      "img-src 'self' data: https:",
      // Next 15 emits runtime styles inline at the top of each
      // response; without 'unsafe-inline' the first paint breaks.
      "style-src 'self' 'unsafe-inline'",
      // 'unsafe-inline' + 'unsafe-eval' only until we wire a
      // nonce-based CSP. See the starter-CSP note above.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Limit XHR/fetch to same-origin. If we ever add Sentry or
      // Upstash REST from the browser (not today), add those
      // origins explicitly.
      "connect-src 'self'",
      "font-src 'self' data:",
      "object-src 'none'",
      "worker-src 'self' blob:",
      // The manifest and service worker are served from the same
      // origin; manifest-src keeps a compromised extension from
      // swapping the PWA manifest out from under us.
      "manifest-src 'self'",
    ].join("; "),
  },
  {
    key: "Permissions-Policy",
    // Camera is allowed on same-origin because the scan surface (PWA
    // barcode flow) uses `getUserMedia`. Everything else is denied
    // by default; add to this allowlist with a commit message
    // referencing the feature that needed it.
    value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Isolates the browsing context so a popup from a third-party
    // domain cannot reach back into OneAce via `window.opener`.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    // Prefetching DNS for outbound links is a small perf win with
    // no privacy downside because all links the app renders are
    // already visible to the browser.
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
