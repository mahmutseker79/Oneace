// src/lib/ci/deploy-hygiene.static.test.ts
//
// Pinned static-analysis tests for P2-02 + P2-10.
//
// P2-02 — UPSTASH_REDIS_REST_{URL,TOKEN} are hard-required in
//         production. The env.ts superRefine enforces this; this
//         test fails CI if the refinement is accidentally reverted.
//
// P2-10 — .netlifyignore exists AND carries every entry .vercelignore
//         does (parity guard while both hosting targets are live
//         during the Faz-3 cutover window).
//
// Both are lightweight file-scan asserts; no runtime booted.

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

describe("env.ts — P2-02 Redis hard-required in production", () => {
  const root = findRepoRoot();
  const src = fs.readFileSync(path.join(root, "src", "lib", "env.ts"), "utf8");

  it("superRefine guards NODE_ENV === 'production'", () => {
    expect(/NODE_ENV\s*===\s*["']production["']/.test(src)).toBe(true);
  });

  it("issues a schema error when URL is missing in prod", () => {
    expect(/isProduction\s*&&\s*!hasRedisUrl/.test(src)).toBe(true);
    expect(/UPSTASH_REDIS_REST_URL is required in production/.test(src)).toBe(true);
  });

  it("issues a schema error when TOKEN is missing in prod", () => {
    expect(/isProduction\s*&&\s*!hasRedisToken/.test(src)).toBe(true);
    expect(/UPSTASH_REDIS_REST_TOKEN is required in production/.test(src)).toBe(true);
  });

  it("does NOT change the dev/test posture (in-memory fallback still allowed)", () => {
    // Both guards must be gated by isProduction — if someone drops
    // the guard, local dev + CI would start failing without Upstash,
    // which is the wrong trade.
    const matches = src.match(/isProduction\s*&&\s*!hasRedis(Url|Token)/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("retains the pre-existing pair-mismatch check (both or neither)", () => {
    // The legacy refinement — if only one of the pair is set, fail.
    expect(/hasRedisUrl\s*!==\s*hasRedisToken/.test(src)).toBe(true);
  });
});

describe(".netlifyignore — P2-10 parity with .vercelignore", () => {
  const root = findRepoRoot();
  const vercelPath = path.join(root, ".vercelignore");
  const netlifyPath = path.join(root, ".netlifyignore");

  it(".netlifyignore exists", () => {
    expect(fs.existsSync(netlifyPath)).toBe(true);
  });

  it(".vercelignore exists (pre-existing; sanity)", () => {
    expect(fs.existsSync(vercelPath)).toBe(true);
  });

  it("every non-comment entry in .vercelignore is also in .netlifyignore", () => {
    const entries = (src: string) =>
      src
        .split("\n")
        .map((line) => line.split("#")[0]?.trim())
        .filter((line) => line.length > 0);

    const vercel = entries(fs.readFileSync(vercelPath, "utf8"));
    const netlify = entries(fs.readFileSync(netlifyPath, "utf8"));
    const missing = vercel.filter((v) => !netlify.includes(v));

    expect(
      missing,
      [
        "",
        ".netlifyignore is missing entries present in .vercelignore:",
        ...missing.map((m) => `  - ${m}`),
        "",
        "Add them to .netlifyignore so the two hosting targets have",
        "the same upload allowlist during the Faz-3 cutover window.",
        "",
      ].join("\n"),
    ).toEqual([]);
  });

  it("symmetric: every entry in .netlifyignore is also in .vercelignore", () => {
    const entries = (src: string) =>
      src
        .split("\n")
        .map((line) => line.split("#")[0]?.trim())
        .filter((line) => line.length > 0);

    const vercel = entries(fs.readFileSync(vercelPath, "utf8"));
    const netlify = entries(fs.readFileSync(netlifyPath, "utf8"));
    const extra = netlify.filter((n) => !vercel.includes(n));

    expect(
      extra,
      [
        "",
        ".netlifyignore has entries NOT in .vercelignore:",
        ...extra.map((m) => `  - ${m}`),
        "",
        "Either add them to .vercelignore or remove them from",
        ".netlifyignore. Drift between the two is a footgun.",
        "",
      ].join("\n"),
    ).toEqual([]);
  });
});
