import { type NextRequest, NextResponse } from "next/server";

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
  // Phase 12 — public marketing pages
  "/pricing",
];

// Prefix-based public paths (all sub-routes are public)
const PUBLIC_PREFIXES = [
  "/docs",
  // Stripe webhook must be publicly accessible — Stripe POSTs from outside.
  "/api/billing/webhook",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public pages and static assets pass through untouched.
  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
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

  return NextResponse.next();
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
