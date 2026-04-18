/**
 * P1-7 (audit v1.0 §5.15) — pin the rate-limit policy for /api/auth/*
 * so nobody silently drops the guards later.
 *
 * Approach
 * --------
 * We don't spin up the Better Auth handler in unit tests — that would
 * need a DB and defeat the point. Instead we static-analyse the route
 * module source: it MUST
 *
 *   1. Import `rateLimit` from `@/lib/rate-limit`.
 *   2. Call it on the sign-in path with a window ≤ 5 minutes and max ≤ 5.
 *   3. Call it on the sign-up path with a window ≤ 1 hour and max ≤ 3.
 *   4. Return 429 on breach (checked via literal string match).
 *
 * These checks are deliberately coarse — they catch accidental deletion
 * or a copy-paste that changes "5" to "500" without requiring a live
 * server. Combined with the existing tests in `rate-limit.test.ts` that
 * exercise the underlying helper, we get end-to-end coverage for the
 * policy without a heavy integration harness.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROUTE_PATH = join(process.cwd(), "src/app/api/auth/[...all]/route.ts");
const source = readFileSync(ROUTE_PATH, "utf8");

describe("auth route rate-limit policy (§5.15)", () => {
  it("imports the rateLimit helper", () => {
    expect(source).toMatch(/from\s+["']@\/lib\/rate-limit["']/);
    expect(source).toMatch(/\brateLimit\b/);
  });

  it("rate-limits the sign-in path", () => {
    // The handler must branch on `/sign-in` and call rateLimit before
    // delegating to Better Auth. We don't pin the exact key shape — the
    // only guarantee is that SOME rateLimit call exists inside the
    // pathname-includes("/sign-in") branch.
    expect(source).toMatch(/pathname\.includes\(["']\/sign-in["']\)/);
    // Locate the guard block and assert rateLimit is invoked inside it.
    const branchMatch = source.match(
      /pathname\.includes\(["']\/sign-in["']\)\s*\)\s*\{([\s\S]*?)\n\s{2}\}/,
    );
    expect(branchMatch).not.toBeNull();
    expect(branchMatch?.[1] ?? "").toMatch(/rateLimit\s*\(/);
  });

  it("uses a tight sign-in window (≤5 attempts in ≤5 minutes)", () => {
    // Crude but effective: find the sign-in rateLimit call and assert
    // the literal shape. If someone bumps max to 50 we want to notice.
    const match = source.match(
      /login:ip:[^`]*`,\s*\{\s*max:\s*(\d+),\s*windowSeconds:\s*(\d+)\s*\}/,
    );
    expect(match).not.toBeNull();
    if (match) {
      const [, max, window] = match;
      expect(Number.parseInt(max ?? "", 10)).toBeLessThanOrEqual(5);
      expect(Number.parseInt(window ?? "", 10)).toBeLessThanOrEqual(300);
    }
  });

  it("rate-limits the sign-up path", () => {
    expect(source).toMatch(/pathname\.includes\(["']\/sign-up["']\)/);
    const branchMatch = source.match(
      /pathname\.includes\(["']\/sign-up["']\)\s*\)\s*\{([\s\S]*?)\n\s{2}\}/,
    );
    expect(branchMatch).not.toBeNull();
    expect(branchMatch?.[1] ?? "").toMatch(/rateLimit\s*\(/);
  });

  it("uses a tight sign-up per-IP window (≤3 registrations in ≤1 hour)", () => {
    const match = source.match(
      /register:ip:[^`]*`,\s*\{\s*max:\s*(\d+),\s*windowSeconds:\s*(\d+)\s*\}/,
    );
    expect(match).not.toBeNull();
    if (match) {
      const [, max, window] = match;
      expect(Number.parseInt(max ?? "", 10)).toBeLessThanOrEqual(3);
      expect(Number.parseInt(window ?? "", 10)).toBeLessThanOrEqual(3600);
    }
  });

  it("also rate-limits sign-up per email to thwart distributed abuse", () => {
    // Per-IP alone is defeated by rotating IPs; the helper must also
    // key on the email. If you remove this, attackers can spam a
    // target mailbox with registration emails.
    expect(source).toMatch(/register:email:/);
  });

  it("returns 429 + Retry-After on breach", () => {
    expect(source).toMatch(/status:\s*429/);
    expect(source).toMatch(/Retry-After/);
  });

  // Regression guard (audit v1.1.3 — sign-up UX bug).
  //
  // The rate-limit responses MUST surface a `message` field (not just
  // `error`) because better-auth's client reads the `message` key to
  // populate `signUpError.message`. When we shipped 429 responses with
  // only `{ error: ... }`, the register form fell back to its generic
  // i18n label ("Sign up failed.") and users had no idea they were
  // being throttled. Any future refactor of these rate-limit branches
  // must preserve the `message:` shape.
  it("surfaces a user-visible message on 429 breach (not just an `error` field)", () => {
    // Count how many JSON bodies inside a 429 branch carry `message:`.
    // There are three such branches today: sign-in, sign-up per-IP, and
    // sign-up per-email. We pin ≥3 to notice accidental regressions.
    const messageInResponses = source.match(/NextResponse\.json\(\s*\{\s*message:/g);
    expect(messageInResponses?.length ?? 0).toBeGreaterThanOrEqual(3);
    // Belt-and-braces: the old buggy shape `{ error: "Too many ..." }`
    // must not reappear. (A generic `error:` key elsewhere is fine —
    // this matches the specific throttle copy only.)
    expect(source).not.toMatch(/\{\s*error:\s*"Too many/);
  });
});
