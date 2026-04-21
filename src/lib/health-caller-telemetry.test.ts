/**
 * Audit v1.3 §5.46 F-02 — /api/health caller telemetry pin.
 *
 * What this guards
 * ----------------
 * `/api/health` gets polled by a bounded-but-unlabelled set of infra
 * callers (Vercel uptime, external monitoring, push helper post-push
 * probe, internal crons, …). Before v1.5.26 the route had no "who
 * called" signal, which turned the 2026-04-18 prod-hotfix incident
 * into an archaeology dig: "is the main webhook actually probing?"
 * was answerable only by redeploying with an ad-hoc log line.
 *
 * This suite pins the three pieces that close that gap and that
 * MUST stay intact as future PRs touch the health route:
 *
 *   1. The GET handler takes a request argument (was arg-less).
 *   2. `extractCallerMarkers()` is exported and reads the four
 *      canonical headers (ua, x-forwarded-for, x-vercel-id, referer).
 *   3. Every probe emits a structured log with `tag:
 *      "health.probe.caller"` BEFORE the first DB round-trip, so
 *      even a probe that times out inside SELECT 1 leaves a trail.
 *
 * Static-analysis only (feedback_pinned_tests.md): reads the route
 * source text + one runtime check on the extractCallerMarkers helper.
 * No DB, no HTTP, no Next.js test harness — runs in <10ms.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTE_PATH = resolve(process.cwd(), "src/app/api/health/route.ts");

function readRoute(): string {
  return readFileSync(ROUTE_PATH, "utf8");
}

describe("§5.46 F-02 — /api/health caller telemetry", () => {
  it("route imports NextRequest (GET signature)", () => {
    const text = readRoute();
    // Pre-v1.5.26 the import was `import { NextResponse } ...` — GET
    // took no args. After v1.5.26 the import must include NextRequest
    // so the handler can read caller headers.
    expect(text).toMatch(/import\s*\{[^}]*type NextRequest[^}]*\}\s*from\s*["']next\/server["']/);
  });

  it("GET handler accepts a request argument", () => {
    const text = readRoute();
    // Pin the exact arg signature so a future refactor that drops it
    // (or renames it to `_request`) fails loud.
    expect(text).toMatch(/export async function GET\(\s*request:\s*NextRequest\s*\)/);
  });

  it("exports extractCallerMarkers with the 4 canonical fields", () => {
    const text = readRoute();
    // Function signature pin — source-level so the guard runs even
    // if the module has side-effect import failures.
    expect(text).toMatch(/export function extractCallerMarkers\(/);
    // Every canonical header must appear in the implementation.
    // Changing one of these names (e.g. dropping "x-vercel-id")
    // silently blinds the log-drain filter, which is the failure
    // mode this guard catches.
    expect(text).toContain('"user-agent"');
    expect(text).toContain('"x-forwarded-for"');
    expect(text).toContain('"x-vercel-id"');
    expect(text).toContain('"referer"');
  });

  it("HealthCallerMarkers type declares the 4 fields", () => {
    const text = readRoute();
    expect(text).toMatch(/export type HealthCallerMarkers\s*=\s*\{/);
    // All four fields mentioned in the type block — catches a partial
    // rename (e.g. `ua -> userAgent`) that breaks log-drain filters.
    const typeBlockMatch = text.match(/export type HealthCallerMarkers\s*=\s*\{([\s\S]*?)\n\};/);
    const body = typeBlockMatch?.[1] ?? "";
    expect(body).toMatch(/ua:\s*string/);
    expect(body).toMatch(/ip:\s*string/);
    expect(body).toMatch(/vercelId:\s*string/);
    expect(body).toMatch(/referer:\s*string/);
  });

  it("GET emits logger.info with tag 'health.probe.caller' before DB probe", () => {
    const text = readRoute();
    // Source-order check: the `tag: "health.probe.caller"` literal
    // must appear BEFORE the actual `$queryRaw\`SELECT 1\`` template
    // literal so a connectivity timeout still leaves a caller
    // breadcrumb in the log drain.
    //
    // We anchor on `$queryRaw\`SELECT 1\`` specifically so line
    // comments that *mention* "SELECT 1" in the file header don't
    // confuse the ordering.
    const tagIdx = text.indexOf('tag: "health.probe.caller"');
    const selectIdx = text.indexOf("$queryRaw`SELECT 1`");
    expect(tagIdx, "tag literal must be present in route").toBeGreaterThan(-1);
    expect(selectIdx, "$queryRaw SELECT 1 probe must still be present").toBeGreaterThan(-1);
    expect(tagIdx, "caller log must fire before DB probe").toBeLessThan(selectIdx);
  });

  it("caller log payload carries all 4 markers", () => {
    const text = readRoute();
    const code = stripBlockComments(text);
    // We're checking the structured call shape: `logger.info(..., {
    //   tag: "health.probe.caller", ua, ip, vercelId, referer, ... })`.
    // A slice around the tag string within the stripped code is
    // enough to catch drift without binding to exact whitespace.
    const tagWindow = extractWindow(code, '"health.probe.caller"', 300);
    expect(tagWindow).toContain("ua:");
    expect(tagWindow).toContain("ip:");
    expect(tagWindow).toContain("vercelId:");
    expect(tagWindow).toContain("referer:");
  });

  it("extractCallerMarkers handles a plain Web Request (no Next at runtime)", async () => {
    // Import via the actual route module. This is the one runtime
    // check in the suite — without it, a future refactor could break
    // the helper signature and only the static-text guards would
    // pass silently. We use a plain `Request` from the Web Fetch API
    // to prove the helper doesn't secretly require a NextRequest.
    const mod = await import("@/app/api/health/route");
    const { extractCallerMarkers } = mod as unknown as {
      extractCallerMarkers: (req: Request) => {
        ua: string;
        ip: string;
        vercelId: string;
        referer: string;
      };
    };
    expect(typeof extractCallerMarkers).toBe("function");

    const req = new Request("https://example.test/api/health", {
      headers: {
        "user-agent": "vercel-probe/1.0",
        "x-forwarded-for": "1.2.3.4, 10.0.0.1",
        "x-vercel-id": "iad1::abcd-1700000000000-deadbeef",
        referer: "https://vercel.com",
      },
    });
    const markers = extractCallerMarkers(req);
    expect(markers).toEqual({
      ua: "vercel-probe/1.0",
      ip: "1.2.3.4", // first XFF entry only
      vercelId: "iad1::abcd-1700000000000-deadbeef",
      referer: "https://vercel.com",
    });
  });

  it("extractCallerMarkers returns 'unknown' for missing headers", async () => {
    const mod = await import("@/app/api/health/route");
    const { extractCallerMarkers } = mod as unknown as {
      extractCallerMarkers: (req: Request) => {
        ua: string;
        ip: string;
        vercelId: string;
        referer: string;
      };
    };
    const req = new Request("https://example.test/api/health");
    const markers = extractCallerMarkers(req);
    expect(markers.ua).toBe("unknown");
    expect(markers.ip).toBe("unknown");
    expect(markers.vercelId).toBe("unknown");
    expect(markers.referer).toBe("unknown");
  });
});

function extractWindow(text: string, anchor: string, radius: number): string {
  const idx = text.indexOf(anchor);
  if (idx === -1) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + anchor.length + radius);
  return text.slice(start, end);
}

/**
 * Drop `/* … *\/` block comments (including JSDoc) from TypeScript
 * source. We don't care about line comments here — the assertions
 * that use this helper anchor on strings unlikely to appear in `//`.
 * Regex is deliberately simple; it mis-handles comments inside
 * string literals but none of our route.ts strings contain `/*`.
 */
function stripBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}
