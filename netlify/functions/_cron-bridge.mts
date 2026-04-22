// Shared helper for Netlify Scheduled Function cron bridges.
//
// Netlify Scheduled Functions run outside the Next.js request pipeline, so
// we can't invoke a Next.js route handler directly from here. Instead, each
// cron bridge HTTPS-calls the corresponding `/api/cron/*` route on the same
// deployment, passing the same `Authorization: Bearer ${CRON_SECRET}` header
// that Vercel Cron uses. That keeps the cron handlers 100% identical between
// platforms — the only new surface is this outbound fetch.
//
// Why not use `@netlify/functions`' `next()` or similar? That would require
// the route to be a Netlify Function itself. The Next.js Runtime plugin
// wraps each App Router route into its own function; calling into that
// function directly (by-reference) isn't supported. HTTPS self-call is the
// documented pattern in Netlify's Next.js + scheduled functions recipe.
//
// Environment:
//   - URL            : Netlify-provided full deploy URL (e.g. https://oneace-next-local.netlify.app)
//   - DEPLOY_PRIME_URL: preview/branch deploy URL (used during POC)
//   - CRON_SECRET    : shared secret with /api/cron/* routes

const SELF_URL =
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  "https://oneace-next-local.netlify.app";

export async function callCronRoute(
  path: string,
  opts: { timeoutMs?: number } = {},
): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "CRON_SECRET not set on Netlify — configure via Site settings → Environment variables",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const url = new URL(path, SELF_URL).toString();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 55_000, // Netlify scheduled function timeout is 60s
  );

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "User-Agent": "netlify-scheduled-cron/1.0",
      },
      signal: controller.signal,
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type":
          res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Cron bridge fetch failed",
        path,
        detail: message,
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  } finally {
    clearTimeout(timer);
  }
}
