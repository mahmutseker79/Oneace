// src/lib/auth-rate-limit.static.test.ts
//
// Pinned static-analysis test for P2-03 (GOD MODE roadmap 2026-04-23).
//
// Invariant
// ---------
//   src/lib/auth.ts's `sendResetPassword` hook MUST call the
//   shared rateLimit helper with the `forgot-password:{email}` key
//   shape BEFORE dispatching the reset email. If the guard is
//   accidentally removed, this test fails CI.
//
// Why
// ---
// The middleware-level IP limit already covers the route, but IP
// alone is the wrong dimension: one attacker from many IPs can
// flood a single victim's inbox, and a shared-NAT cohort can
// benignly lock each other out at 120/min. Per-email is the right
// bucket for "please stop spamming my inbox" and anti-enumeration
// in the same stroke.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found");
}

describe("auth.ts — P2-03 forgot-password per-email rate limit", () => {
  const root = findRepoRoot();
  const src = fs.readFileSync(path.join(root, "src", "lib", "auth.ts"), "utf8");

  it("imports rateLimit + RATE_LIMITS from @/lib/rate-limit", () => {
    expect(
      /import\s*\{[^}]*\b(?:rateLimit|RATE_LIMITS)\b[^}]*\}\s*from\s*["']@\/lib\/rate-limit["']/.test(
        src,
      ),
    ).toBe(true);
  });

  it("calls rateLimit(...) inside sendResetPassword", () => {
    const hookMatch = src.match(
      /sendResetPassword\s*:\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{4}\}/,
    );
    expect(hookMatch, "failed to locate sendResetPassword hook body").not.toBeNull();
    const body = hookMatch?.[1] ?? "";
    expect(/\brateLimit\s*\(/.test(body)).toBe(true);
  });

  it("key is shaped `forgot-password:{lowercased email}`", () => {
    expect(/forgot-password:\$\{[^}]*\.email[\s\S]*?\}/.test(src)).toBe(true);
    expect(/\.trim\(\)\.toLowerCase\(\)/.test(src)).toBe(true);
  });

  it("uses the canonical RATE_LIMITS.forgotPassword bucket", () => {
    expect(/RATE_LIMITS\.forgotPassword/.test(src)).toBe(true);
  });

  it("gates the email send on the rateLimit result and early-returns (anti-enumeration)", () => {
    // `if (!gate.ok) { ... return; }` — the form still shows a
    // generic ok message so the attacker can't infer whether the
    // email existed. We assert BOTH halves:
    //   (a) the `if (!gate.ok)` check exists, AND
    //   (b) a `return;` appears within ~500 chars after that check.
    //
    // We don't try to parse the `if` body's braces — logger.warn
    // has a nested object literal whose `}` confuses a simple
    // lazy-match.
    const checkIdx = src.search(/if\s*\(\s*!\s*gate\.ok\s*\)/);
    expect(checkIdx, "`if (!gate.ok)` guard must exist").toBeGreaterThanOrEqual(0);
    const window = src.slice(checkIdx, checkIdx + 500);
    expect(
      /\breturn\s*;/.test(window),
      "a `return;` must follow the `if (!gate.ok)` guard (anti-enumeration short-circuit)",
    ).toBe(true);
  });

  it("logs the throttle event (warn level — operators want to see this)", () => {
    expect(/logger\.warn\s*\([^)]*forgot-password throttled/.test(src)).toBe(true);
  });
});
