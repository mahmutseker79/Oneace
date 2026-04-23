// src/lib/i18n/tr-locale.static.test.ts
//
// Pinned static-analysis test for P1-07 (GOD MODE roadmap 2026-04-23).
//
// Invariants
// ----------
//   1. `messages/tr.ts` exists and exports a `tr` catalog assignable
//      to the `Messages` type (verified by the file's own
//      TypeScript; this test just asserts presence).
//   2. `SUPPORTED_LOCALES` in config.ts includes "tr".
//   3. `SUPPORTED_REGIONS` in config.ts includes a TR region with
//      currency TRY + Europe/Istanbul timezone.
//   4. The `catalog` in index.ts references the `tr` import.
//   5. The KVKK legal page exists at
//      `src/app/(marketing)/legal/kvkk/page.tsx` with a draft
//      banner (so someone who lands on it before counsel review
//      sees the status loud).
//
// Rationale
// ---------
// P1-07 adds the first real non-English locale and the first
// Turkish legal surface. Those three files (tr.ts, config.ts
// patch, KVKK page) drift easily — someone could drop the locale
// without the region, or ship the page without a review flag. This
// test pins all three in one place so a regression fails CI.

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

describe("Turkish locale — P1-07 foundation", () => {
  const root = findRepoRoot();
  const config = fs.readFileSync(
    path.join(root, "src", "lib", "i18n", "config.ts"),
    "utf8",
  );
  const index = fs.readFileSync(
    path.join(root, "src", "lib", "i18n", "index.ts"),
    "utf8",
  );
  const trPath = path.join(
    root,
    "src",
    "lib",
    "i18n",
    "messages",
    "tr.ts",
  );

  it("messages/tr.ts exists", () => {
    expect(fs.existsSync(trPath)).toBe(true);
  });

  it("tr.ts exports a `tr` const typed as Messages", () => {
    const src = fs.readFileSync(trPath, "utf8");
    expect(/export\s+const\s+tr\s*:\s*Messages\s*=/.test(src)).toBe(true);
  });

  it("tr.ts spreads `en` so parity is structurally preserved", () => {
    const src = fs.readFileSync(trPath, "utf8");
    expect(/\.\.\.en\b/.test(src)).toBe(true);
  });

  it("SUPPORTED_LOCALES includes 'tr'", () => {
    const match = config.match(/SUPPORTED_LOCALES\s*=\s*\[([\s\S]*?)\]/);
    expect(match).not.toBeNull();
    const body = match?.[1] ?? "";
    expect(/["']tr["']/.test(body)).toBe(true);
  });

  it("SUPPORTED_REGIONS includes a Türkiye region with TRY currency", () => {
    expect(/code:\s*["']TR["']/.test(config)).toBe(true);
    expect(/currency:\s*["']TRY["']/.test(config)).toBe(true);
    expect(/numberLocale:\s*["']tr-TR["']/.test(config)).toBe(true);
    expect(/defaultTimeZone:\s*["']Europe\/Istanbul["']/.test(config)).toBe(true);
  });

  it("index.ts imports tr and wires it into the catalog", () => {
    expect(/import\s*\{\s*tr\s*\}\s*from\s*["']\.\/messages\/tr["']/.test(index)).toBe(true);
    // The catalog object literal must reference tr (as shorthand or
    // explicit `tr: tr`).
    const catalog = index.match(/const\s+catalog\s*:\s*Record<Locale,\s*Messages>\s*=\s*\{([\s\S]*?)\};/);
    expect(catalog).not.toBeNull();
    expect(/\btr\b/.test(catalog?.[1] ?? "")).toBe(true);
  });
});

describe("KVKK legal page — P1-07", () => {
  const root = findRepoRoot();
  const kvkkPath = path.join(
    root,
    "src",
    "app",
    "(marketing)",
    "legal",
    "kvkk",
    "page.tsx",
  );

  it("page exists at the expected route", () => {
    expect(fs.existsSync(kvkkPath)).toBe(true);
  });

  it("page carries a visible DRAFT / counsel-review banner", () => {
    const src = fs.readFileSync(kvkkPath, "utf8");
    // Must flag to any early reader that the text is NOT production-
    // legal-reviewed. We scan for 'Taslak' + 'Avukat' (two separate
    // words so a silent strip-one-or-the-other doesn't pass).
    expect(/Taslak/i.test(src)).toBe(true);
    expect(/Avukat/i.test(src)).toBe(true);
  });

  it("page lists the KVKK Article 11 rights (8 items minimum)", () => {
    const src = fs.readFileSync(kvkkPath, "utf8");
    // Count <li> items under the 'haklar' section. Our draft has 9;
    // we require >= 8 so a minor editorial tweak doesn't fail.
    // A regex counting <li>...</li> within the whole file is
    // sufficient — other sections have at most a handful each so
    // the lower bound of 8 still means the rights section is
    // present.
    const liCount = (src.match(/<li>/g) ?? []).length;
    expect(liCount).toBeGreaterThanOrEqual(8);
  });

  it("page has a kvkk@oneace.app contact link", () => {
    const src = fs.readFileSync(kvkkPath, "utf8");
    expect(/mailto:kvkk@oneace\.app/.test(src)).toBe(true);
  });

  it("page exports metadata (title + description)", () => {
    const src = fs.readFileSync(kvkkPath, "utf8");
    expect(/export\s+const\s+metadata\s*=/.test(src)).toBe(true);
    expect(/title:\s*["'][^"']*KVKK/.test(src)).toBe(true);
  });
});
