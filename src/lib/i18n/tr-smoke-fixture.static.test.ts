// Sprint 33 — TR coverage segment kickoff (foundation).
//
// Static-analysis pin for the Playwright TR smoke fixture + spec.
//
// The actual e2e run is gated on a live Next.js server (CI uses
// E2E_BASE_URL or boots `npx next dev`). This static test asserts
// the spec/fixture contract WITHOUT booting anything, so a regex
// regression — someone renames the cookie, drops the nav.dashboard
// assertion, or breaks the fixture import chain — fails the cheap
// vitest job long before the slow e2e job catches it.
//
// Lock-step contract
// ------------------
//   1. `e2e/fixtures/tr-auth.ts` exists and pins LOCALE_COOKIE to
//      the same string the runtime uses (`oneace-locale`).
//   2. The fixture sets the cookie via `addCookies` and re-navigates
//      to /dashboard.
//   3. `e2e/tr-smoke.spec.ts` exists and references the canonical
//      Sprint 7 TR translations:
//        - auth.login.submit = "Giriş yap"
//        - nav.dashboard     = "Pano"
//      Drift on either side of the contract fails here.
//   4. Negative guard for English "Dashboard" link is present (so a
//      hardcoded EN string regression also fails the smoke).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function findRepoRoot(): string {
  let dir = resolve(__dirname);
  while (dir !== resolve(dir, "..")) {
    if (existsSync(resolve(dir, "package.json"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("repo root not found");
}

const ROOT = findRepoRoot();
const FIXTURE_PATH = resolve(ROOT, "e2e", "fixtures", "tr-auth.ts");
const SPEC_PATH = resolve(ROOT, "e2e", "tr-smoke.spec.ts");
const I18N_INDEX = resolve(ROOT, "src", "lib", "i18n", "index.ts");

describe("Sprint 33 — TR smoke fixture + spec static pin", () => {
  it("e2e/fixtures/tr-auth.ts exists", () => {
    expect(existsSync(FIXTURE_PATH)).toBe(true);
  });

  it("e2e/tr-smoke.spec.ts exists", () => {
    expect(existsSync(SPEC_PATH)).toBe(true);
  });

  it("fixture pins LOCALE_COOKIE to 'oneace-locale' (runtime parity)", () => {
    const fixture = readFileSync(FIXTURE_PATH, "utf8");
    expect(fixture).toMatch(/LOCALE_COOKIE\s*=\s*["']oneace-locale["']/);

    // Runtime side — index.ts must also export LOCALE_COOKIE with
    // the same value (or import it from config.ts which does).
    const index = readFileSync(I18N_INDEX, "utf8");
    expect(index).toMatch(/LOCALE_COOKIE/);
  });

  it("fixture extends shared auth fixture, not base playwright test", () => {
    // We piggyback on `authedPage` so we don't fork the login flow.
    // A regression that imports `test as base` from `@playwright/test`
    // directly would silently skip the EN-locale login phase.
    const fixture = readFileSync(FIXTURE_PATH, "utf8");
    expect(fixture).toMatch(/from\s+["']\.\/auth["']/);
    expect(fixture).toMatch(/authTest\.extend</);
  });

  it("fixture sets the cookie via context().addCookies and re-navigates", () => {
    const fixture = readFileSync(FIXTURE_PATH, "utf8");
    expect(fixture).toMatch(/context\(\)\.addCookies\(/);
    expect(fixture).toMatch(/value:\s*["']tr["']/);
    expect(fixture).toMatch(/goto\(["']\/dashboard["']\)/);
  });

  it("spec references the canonical Sprint 7 TR translations", () => {
    const spec = readFileSync(SPEC_PATH, "utf8");
    // auth.login.submit = "Giriş yap"
    expect(spec).toMatch(/giriş yap/i);
    // auth.login.email = "E-posta"
    expect(spec).toMatch(/e-posta/i);
    // auth.login.password = "Şifre"
    expect(spec).toMatch(/şifre/i);
    // nav.dashboard = "Pano"
    expect(spec).toMatch(/pano/i);
  });

  it("spec has a negative guard for the English 'Dashboard' link", () => {
    // Without this, a hardcoded EN string in the sidebar wouldn't
    // fail the smoke — the EN "Dashboard" would happily render
    // alongside the (also-passing) "Pano" assertion.
    const spec = readFileSync(SPEC_PATH, "utf8");
    expect(spec).toMatch(/toHaveCount\(0\)/);
    expect(spec).toMatch(/\^dashboard\$/);
  });

  it("spec covers at least 2 surfaces (login + dashboard)", () => {
    // Foundation floor — Sprint 37 closure expands to >= 5 flows.
    const spec = readFileSync(SPEC_PATH, "utf8");
    const tests = spec.match(/\btest\s*\(/g) ?? [];
    expect(tests.length).toBeGreaterThanOrEqual(2);
  });
});
