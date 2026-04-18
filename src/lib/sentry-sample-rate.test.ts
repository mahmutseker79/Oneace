// v1.2 P3 §5.42 — Sentry trace sample rate pin.
//
// Two halves:
//
//   1. Unit tests for `getTracesSampleRate` — every branch of the
//      resolution order (env var wins, malformed env var falls
//      through, NODE_ENV matrix).
//   2. Static-analysis pin that all three `sentry.*.config.ts`
//      files import the helper and call it for `tracesSampleRate`
//      — catches a future drive-by that re-hardcodes 0.1.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getTracesSampleRate } from "./sentry-sample-rate";

const REPO_ROOT = join(__dirname, "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

// ──────────────────────────────────────────────────────────────────
// 1. Unit — resolution order
// ──────────────────────────────────────────────────────────────────

describe("§5.42 — getTracesSampleRate resolution order", () => {
  it("env var wins when set to a valid rate", () => {
    expect(getTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "0.42" })).toBe(0.42);
    expect(getTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "0" })).toBe(0);
    expect(getTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "1" })).toBe(1);
  });

  it("env var trumps NODE_ENV", () => {
    // Without env var a development runtime would return 1.0; with
    // an explicit 0.2 it must respect the override.
    expect(
      getTracesSampleRate({
        SENTRY_TRACES_SAMPLE_RATE: "0.2",
        NODE_ENV: "development",
      }),
    ).toBe(0.2);
  });

  it("malformed env var falls through to the NODE_ENV default", () => {
    // Prevents a typo'd `SENTRY_TRACES_SAMPLE_RATE=foo` from
    // pushing NaN into the SDK (which treats NaN as 0 — silent
    // loss of all traces).
    for (const bad of ["foo", "", "  ", "NaN", "-0.1", "1.5"]) {
      expect(getTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: bad, NODE_ENV: "production" })).toBe(
        0.1,
      );
    }
  });

  it("NODE_ENV=development → full tracing", () => {
    expect(getTracesSampleRate({ NODE_ENV: "development" })).toBe(1.0);
  });

  it("NODE_ENV=test → never upload", () => {
    // Unit tests setting NODE_ENV=test must not ping Sentry even
    // when a DSN is in the env (rare in CI but possible).
    expect(getTracesSampleRate({ NODE_ENV: "test" })).toBe(0.0);
  });

  it("NODE_ENV=production → 0.1 (quota-safe default)", () => {
    expect(getTracesSampleRate({ NODE_ENV: "production" })).toBe(0.1);
  });

  it("unknown NODE_ENV → prod-safe 0.1", () => {
    // An ops-time typo (NODE_ENV=produciton) shouldn't flip the
    // default to dev-mode full tracing.
    expect(getTracesSampleRate({ NODE_ENV: "staging" })).toBe(0.1);
    expect(getTracesSampleRate({ NODE_ENV: undefined })).toBe(0.1);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. Static-analysis pin for the three Sentry configs
// ──────────────────────────────────────────────────────────────────

const CONFIGS = ["sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts"];

describe("§5.42 — sentry.*.config.ts uses the shared helper", () => {
  for (const rel of CONFIGS) {
    const src = read(rel);

    it(`${rel} imports getTracesSampleRate from @/lib/sentry-sample-rate`, () => {
      expect(src).toMatch(
        /import\s*\{\s*getTracesSampleRate\s*\}\s*from\s*["']@\/lib\/sentry-sample-rate["']/,
      );
    });

    it(`${rel} wires tracesSampleRate through the helper`, () => {
      // Pin both that the key is called and that the helper is the
      // source of the value. Blocks a drive-by regression to a
      // literal like `tracesSampleRate: 0.1`.
      expect(src).toMatch(/tracesSampleRate:\s*getTracesSampleRate\s*\(/);
    });

    it(`${rel} does not hardcode a numeric tracesSampleRate`, () => {
      // The helper call is the only accepted shape. This regex
      // matches `tracesSampleRate: <digit>` which would only
      // appear if someone reverts to the old literal form.
      expect(src).not.toMatch(/tracesSampleRate:\s*[0-9]/);
    });

    it(`${rel} does not keep the old Number(process.env ...) literal`, () => {
      expect(src).not.toMatch(/tracesSampleRate:\s*Number\s*\(\s*process\.env/);
    });
  }
});
