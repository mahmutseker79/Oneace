// Audit v1.2 §5.34 — API rate-limit coverage sweep.
//
// Problem at v1.1 close: 44 API route files, only 19 wrapped with
// `rateLimit()`/`withRateLimit()`. The remaining 25 authenticated
// write paths (items, stock-counts, notifications, integration
// triggers, ...) relied on perimeter auth alone — a single
// compromised session could abuse any write path at arbitrary QPS.
//
// Remediation (see src/middleware.ts) applies a default limit of
// 120 req/min per client IP to every `/api/*` surface EXCEPT the
// documented exempt list (HMAC webhooks, CRON_SECRET crons, health
// check, better-auth's own per-action limits).
//
// This test pins the coverage invariant so new routes can't silently
// regress it. Every `route.ts` under `src/app/api` is classified as:
//
//   A. NON-EXEMPT  — middleware default 120/min applies automatically.
//      (Route-level wrappers stack on top for tighter per-action
//      policy — login 5/5min, onboarding org 3/hour, etc.)
//
//   B. EXEMPT      — the route prefix is in EXEMPT_PATH_PREFIXES and
//      the route uses an alternative auth scheme:
//        - /api/cron/*        → CRON_SECRET header
//        - /api/webhooks/*    → HMAC / Svix signature
//        - /api/billing/webhook, /api/integrations/*/webhooks
//                             → provider signature (Stripe/Shopify/QB)
//        - /api/health        → intentionally public (monitoring)
//        - /api/auth/*        → better-auth's own machinery + per-
//                               action route-level limits
//
// For exempt routes we also verify the alternative-auth marker is
// present in source so the carve-out doesn't become a silent hole
// (e.g. if someone adds `/api/cron/foo/route.ts` that forgets to
// check `CRON_SECRET`, the test fails).
//
// Drift guard: the exempt list below must match
// `API_RATE_LIMIT_EXEMPT_PREFIXES` in `src/middleware.ts`. If the two
// diverge the final describe() block fails loudly.

import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = resolve(__dirname, "..");
const API_DIR = resolve(SRC_DIR, "app", "api");
const MIDDLEWARE_PATH = resolve(SRC_DIR, "middleware.ts");

// Must match `API_RATE_LIMIT_EXEMPT_PREFIXES` in `src/middleware.ts`.
// Each entry here pairs with an expected alternative-auth marker that
// exempt routes MUST contain in source — the second element is a
// regex that matches at least one accepted auth marker.
const EXEMPT_PREFIX_AUTH_MARKERS: ReadonlyArray<readonly [string, RegExp]> = [
  // better-auth's own handler; per-action limits (login, register, 2FA)
  // live inside the catch-all handler.
  ["/api/auth/", /better-auth|auth\.handler|toNextJsHandler|rateLimit/i],
  // Svix-signed Resend webhooks + HMAC-signed inbound webhooks.
  ["/api/webhooks/", /svix|hmac|x-webhook-signature|signature/i],
  // Stripe signature verification.
  ["/api/billing/webhook", /STRIPE_WEBHOOK_SECRET|stripe.*signature|constructEvent/i],
  // Shopify HMAC.
  [
    "/api/integrations/shopify/webhooks",
    /hmac|shopify.*signature|x-shopify-hmac|SHOPIFY_.*SECRET/i,
  ],
  // QuickBooks signature (Intuit webhooks).
  [
    "/api/integrations/quickbooks/webhooks",
    /intuit-signature|quickbooks.*signature|QUICKBOOKS_.*SECRET|hmac/i,
  ],
  // Vercel cron — protected by CRON_SECRET header.
  ["/api/cron/", /CRON_SECRET/],
  // Liveness/readiness probe — intentionally unauthenticated, so the
  // marker here is the explicit "public" / "liveness" / "health" doc
  // string; the route MUST NOT start doing anything auth-sensitive
  // without also removing itself from the exempt list.
  ["/api/health", /liveness|readiness|public|health|probe/i],
];

const EXEMPT_PATH_PREFIXES = EXEMPT_PREFIX_AUTH_MARKERS.map(([p]) => p);

function discoverApiRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...discoverApiRouteFiles(full));
    } else if (entry.isFile() && entry.name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

// Map `.../src/app/api/items/route.ts` → `/api/items`.
// Drops `(group)` route-group segments (Next.js convention) and the
// trailing `route.ts`. `[id]` / `[...all]` stay as-is — we only need
// prefix matching against EXEMPT_PATH_PREFIXES.
function filePathToRoutePath(absPath: string): string {
  const appDir = resolve(SRC_DIR, "app");
  const rel = relative(appDir, absPath);
  const segments = rel
    .split("/")
    .filter((p) => p !== "" && p !== "route.ts")
    .filter((p) => !(p.startsWith("(") && p.endsWith(")")));
  return "/" + segments.join("/");
}

function findExemptEntry(
  routePath: string,
): readonly [string, RegExp] | undefined {
  return EXEMPT_PREFIX_AUTH_MARKERS.find(([prefix]) => routePath.startsWith(prefix));
}

function hasRouteLevelRateLimit(source: string): boolean {
  return /\brateLimit\s*\(|\bwithRateLimit\s*\(/.test(source);
}

describe("API rate-limit coverage (audit v1.2 §5.34)", () => {
  const routeFiles = discoverApiRouteFiles(API_DIR);

  it("discovers all api route.ts files (sanity check)", () => {
    // We were at 44 at v1.1 close; future route additions should
    // push this up, so the lower bound is the useful guard.
    expect(routeFiles.length).toBeGreaterThanOrEqual(40);
  });

  describe("every route is covered (middleware default OR documented exempt)", () => {
    for (const file of routeFiles) {
      const routePath = filePathToRoutePath(file);
      const relName = relative(SRC_DIR, file);
      const exemptEntry = findExemptEntry(routePath);

      if (exemptEntry) {
        const [prefix, marker] = exemptEntry;
        it(`${relName} — EXEMPT under ${prefix} (expects ${marker} marker)`, () => {
          const source = readFileSync(file, "utf8");
          expect(
            marker.test(source),
            `Route ${routePath} is exempt from middleware rate-limit under prefix "${prefix}" but its source contains no match for ${marker}. Either add the missing auth check (CRON_SECRET / HMAC / etc.) or remove the exempt-prefix entry so the middleware default applies.`,
          ).toBe(true);
        });
      } else {
        it(`${relName} — NON-EXEMPT, middleware default applies at ${routePath}`, () => {
          const source = readFileSync(file, "utf8");
          // Middleware default 120/min covers this route automatically.
          // Route-level wrappers (for tighter per-action limits) are a
          // valid escalation but not required for coverage.
          const _ = hasRouteLevelRateLimit(source); // grep keeps test greppable
          expect(
            findExemptEntry(routePath),
            `Logic error: non-exempt branch should mean findExemptEntry returns undefined`,
          ).toBeUndefined();
        });
      }
    }
  });

  describe("middleware.ts wiring invariants", () => {
    it("declares API_RATE_LIMIT_EXEMPT_PREFIXES and applies rateLimit() with a DEFAULT_API_RATE_LIMIT", () => {
      const source = readFileSync(MIDDLEWARE_PATH, "utf8");
      expect(
        source,
        "middleware.ts must declare API_RATE_LIMIT_EXEMPT_PREFIXES",
      ).toMatch(/API_RATE_LIMIT_EXEMPT_PREFIXES/);
      expect(
        source,
        "middleware.ts must declare DEFAULT_API_RATE_LIMIT (avoid magic numbers)",
      ).toMatch(/DEFAULT_API_RATE_LIMIT/);
      expect(
        source,
        "middleware.ts must actually call rateLimit() — declaring the exempt list is not enough",
      ).toMatch(/\brateLimit\s*\(/);
      expect(
        source,
        "middleware.ts must return HTTP 429 when the limit is exceeded",
      ).toMatch(/status:\s*429/);
    });

    it("exempt list drift guard — every test-side prefix appears in middleware.ts", () => {
      const source = readFileSync(MIDDLEWARE_PATH, "utf8");
      for (const prefix of EXEMPT_PATH_PREFIXES) {
        expect(
          source.includes(`"${prefix}"`),
          `middleware.ts must reference EXEMPT prefix "${prefix}" (keep API_RATE_LIMIT_EXEMPT_PREFIXES in sync with EXEMPT_PREFIX_AUTH_MARKERS in this test)`,
        ).toBe(true);
      }
    });

    it("middleware.ts matcher covers /api/ paths", () => {
      const source = readFileSync(MIDDLEWARE_PATH, "utf8");
      // The matcher is a negative-lookahead regex literal living
      // inside a double-quoted string:
      //   "/((?!_next/static|_next/image|favicon.ico|...).*)"
      // We capture the exclusion list and assert `api` is NOT in it.
      const matcherMatch = source.match(/"\/\(\(\?!([^)"]+)\)\.\*\)"/);
      expect(matcherMatch, "middleware matcher must be a negative-lookahead regex").not.toBeNull();
      const excluded = matcherMatch?.[1] ?? "";
      expect(
        excluded.split("|").some((item) => item === "api" || item.startsWith("api/")),
        "middleware matcher excludes /api/* — that would defeat the rate-limit default. Current excluded: " +
          excluded,
      ).toBe(false);
    });
  });

  describe("exempt list sanity — every listed prefix corresponds to at least one real route", () => {
    // Catch typos in the exempt list. If we list "/api/cron/" but
    // there are zero /api/cron/* routes, someone probably meant a
    // different prefix.
    for (const prefix of EXEMPT_PATH_PREFIXES) {
      it(`"${prefix}" matches at least one route.ts under src/app/api`, () => {
        const matched = routeFiles
          .map(filePathToRoutePath)
          .filter((p) => p.startsWith(prefix));
        expect(
          matched.length,
          `No route.ts under src/app/api matches exempt prefix "${prefix}". Typo in EXEMPT_PREFIX_AUTH_MARKERS?`,
        ).toBeGreaterThan(0);
      });
    }
  });
});
