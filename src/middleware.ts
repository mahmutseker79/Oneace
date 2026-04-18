import { type NextRequest, NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";

// NOTE: We intentionally avoid importing better-auth/cookies here because
// its transitive dependency (jose) uses CompressionStream/DecompressionStream
// which are not available in Vercel's Edge Runtime. Instead we do a simple
// cookie-presence check — the actual session validation happens server-side
// in requireActiveMembership().

// Better Auth uses "__Secure-" prefixed cookie names when the request is
// served over HTTPS (i.e. production / Vercel). On plain HTTP (localhost)
// the un-prefixed name is used. We check both so the middleware gate works
// in every environment without importing better-auth/cookies.
const SESSION_COOKIE_CANDIDATES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const;

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  // Password-reset landing page — the link Better Auth emails points
  // here and MUST be reachable without an existing session cookie
  // (the whole point of the flow is that the user cannot sign in).
  "/reset-password",
  // Phase 12 — public marketing pages
  "/pricing",
];

// Prefix-based public paths (all sub-routes are public)
const PUBLIC_PREFIXES = [
  "/docs",
  // Phase 14 remediation (God-Mode v2):
  // - /invite/[token] renders a "sign in to accept" CTA for signed-out
  //   users. Before this entry existed, the middleware redirected
  //   invitees to /login without the invite token in the query, breaking
  //   the invitation flow for any user who wasn't already signed in.
  // - /legal/* are public marketing pages (terms of service, privacy
  //   policy). The register form links to them and they are legally
  //   required to be reachable without an account.
  "/invite/",
  "/legal/",
  // Stripe webhook must be publicly accessible — Stripe POSTs from outside.
  "/api/billing/webhook",
  // External integration webhooks (Shopify, QuickBooks) and health check
  "/api/integrations/shopify/webhooks",
  "/api/integrations/quickbooks/webhooks",
  "/api/webhooks/inbound",
  "/api/health",
  // Cron jobs use Vercel CRON_SECRET header, not session cookies
  "/api/cron",
];

/**
 * God-Mode v2 remediation — centralised public-route classifier so
 * tests can pin the policy without re-implementing it. Keep this in
 * lock-step with the `PUBLIC_PATHS` / `PUBLIC_PREFIXES` lists above.
 */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.includes(".")) return true;
  return false;
}

// --- Audit v1.2 §5.34 — API rate-limit default ---------------------------
//
// Problem at v1.1 close: 44 API routes total, only 19 wrapped with
// `rateLimit()`. The other 25 (authenticated CRUD: items, stock-counts,
// notifications, integrations/* trigger endpoints, ...) were gated by
// perimeter auth but not rate-limited — one compromised session or a
// single abusive tenant could spam write paths at arbitrary QPS.
//
// We apply a default limit of 120 requests/minute per client IP at the
// middleware layer so coverage is guaranteed without per-route
// boilerplate. Routes that need a tighter policy (login 5/5min,
// register 3/hour, onboarding org-create 3/hour, etc.) keep their
// existing per-action route-level wrappers on top — the middleware
// check fires first with the generous default, and the route-level
// check enforces the stricter policy on a per-action key.
//
// The exempt list below covers every `/api/*` surface that either
// uses a DIFFERENT auth scheme (HMAC-signed webhooks, CRON_SECRET
// header) or has its own tighter route-level policy that shouldn't be
// preempted by the generic IP limit. Keep this list in sync with
// EXEMPT_PATH_PREFIXES in `src/lib/api-rate-limit-coverage.test.ts` —
// the test has a drift guard that fails if the two diverge.
const API_RATE_LIMIT_EXEMPT_PREFIXES = [
  // Better-auth endpoints — route-level per-action limits
  // (login 5/5min, register 3/hour, 2FA verify 5/5min) are tighter
  // than our IP-default would be, and they key on user id, not IP,
  // so a shared NAT doesn't lock everyone out at 120/min.
  "/api/auth/",
  // HMAC-signed webhooks — Stripe, Shopify, QuickBooks, Resend
  "/api/webhooks/",
  "/api/billing/webhook",
  "/api/integrations/shopify/webhooks",
  "/api/integrations/quickbooks/webhooks",
  // Cron jobs — protected by Vercel CRON_SECRET header
  "/api/cron/",
  // Health check — monitoring pings, must be rate-limit-free
  "/api/health",
] as const;

const DEFAULT_API_RATE_LIMIT = { max: 120, windowSeconds: 60 } as const;

function getClientIp(request: NextRequest): string {
  // Vercel sets x-forwarded-for; the first entry is the client.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  // Fallback — every real request on Vercel has x-forwarded-for, so
  // "unknown" only shows up in local-dev curl against the raw origin.
  return "unknown";
}

function isApiRateLimitExempt(pathname: string): boolean {
  return API_RATE_LIMIT_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // P0-3: expose the request pathname to Server Components via a request
  // header so the app layout can tell whether it is rendering the
  // onboarding page (which must opt out of the membership gate to avoid
  // a redirect loop for first-run users). Set on every response.
  const passthroughHeaders = new Headers(request.headers);
  passthroughHeaders.set("x-pathname", pathname);

  // --- §5.34 API rate-limit default ---
  // Runs BEFORE the public-path pass-through so it catches every
  // `/api/*` surface (including unauthenticated ones like login POST)
  // except the documented exempt list. Running before the session
  // cookie check is deliberate: otherwise an attacker could hammer
  // session-gated endpoints with no cookie and the 401s would go
  // un-rate-limited, which defeats the point of brute-force defense.
  if (pathname.startsWith("/api/") && !isApiRateLimitExempt(pathname)) {
    const ip = getClientIp(request);
    const rl = await rateLimit(`api:default:ip:${ip}`, DEFAULT_API_RATE_LIMIT);
    if (!rl.ok) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const retryAfter = Math.max(0, rl.reset - nowSeconds);
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rl.reset),
          },
        },
      );
    }
  }

  // Public pages and static assets pass through untouched.
  if (isPublicPath(pathname)) {
    return NextResponse.next({
      request: { headers: passthroughHeaders },
    });
  }

  // Cheap cookie check — skips DB hit until the request actually needs auth state.
  // We check for the session cookie directly instead of using better-auth's
  // getSessionCookie helper to avoid Edge Runtime incompatibility.
  const hasSession = SESSION_COOKIE_CANDIDATES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );
  if (!hasSession) {
    // Validate redirect parameter: must be relative (starts with / and NOT //)
    const safeRedirect = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", safeRedirect);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({
    request: { headers: passthroughHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
