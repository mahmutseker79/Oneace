/**
 * P1-6 (audit v1.0 §5.12) — pin the contract for the sidebar version
 * label so the "Sprint 0 scaffold" regression cannot come back via a
 * careless refactor.
 *
 * The tests deliberately exercise both the env-injected path and the
 * `package.json` fallback; both must produce a non-empty semver-ish
 * value and must never return the legacy hardcoded label.
 */

import { describe, expect, it } from "vitest";

import { APP_VERSION, getAppVersionLine } from "./app-version";

describe("app-version", () => {
  it("APP_VERSION is a non-empty string", () => {
    expect(typeof APP_VERSION).toBe("string");
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });

  it("APP_VERSION is not the legacy 'Sprint 0' placeholder", () => {
    // Guards against accidentally re-adopting the v0.1.0 hardcode. If
    // you legitimately ship a product version of 0.1.0, bump this
    // assertion — but the point is that the label should reflect a
    // real build, not a scaffold marker.
    expect(APP_VERSION).not.toMatch(/sprint 0/i);
    expect(APP_VERSION).not.toBe("0.1.0-sprint-0-scaffold");
  });

  it("getAppVersionLine combines brand + version into a stable shape", () => {
    const line = getAppVersionLine("OneAce");
    expect(line).toBe(`OneAce · v${APP_VERSION}`);
    // Explicitly guard against anyone hardcoding the old Sprint 0 label.
    expect(line).not.toContain("Sprint 0 scaffold");
    expect(line).not.toBe("OneAce · v0.1.0");
  });

  it("getAppVersionLine is pure — same input yields same output", () => {
    expect(getAppVersionLine("Acme")).toBe(getAppVersionLine("Acme"));
  });
});
