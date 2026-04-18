// Phase 6B / Item 2 — minimal test harness.
//
// Scope: node-only, pure-function tests under `src/lib/**/*.test.ts`.
// Intentionally NOT configured for React Testing Library, jsdom,
// Playwright, or Prisma integration — those belong to later phases.
//
// The `@` alias mirrors tsconfig.json so test files can import from
// `@/lib/...` the same way app code does. `setupFiles` primes the
// minimum env vars that `src/lib/env.ts` refuses to start without, so
// test modules that transitively touch the env schema (rate-limit,
// invitations) can import cleanly without a real `.env` on disk.
//
// §5.29 (audit v1.1) — coverage scaffold.
// Thresholds are floors (fail below). The scaffold landed with zeros;
// the baseline was measured 2026-04-18 (v1.1.2-coverage-baseline) with
// `npx vitest run --coverage`, producing the following `coverage-summary.json`
// totals across src/** excluding generated + tests + e2e:
//   lines:      3.23%   (3054 / 94464)
//   statements: 3.23%   (3054 / 94464)
//   functions: 20.22%   ( 181 /   895)
//   branches:  46.15%   ( 691 /  1497)
// Floors below sit a hair under those numbers — enough buffer for
// measurement flake (e.g. pure-function files drifting by one line)
// but too tight for a real regression to slip through unseen. The goal
// is a one-way ratchet: every PR that adds coverage should be paired
// with a floor bump in a follow-up commit so the ratchet never loosens.
// Run locally: `npx vitest run --coverage`.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/generated/**",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.d.ts",
        "e2e/**",
        "node_modules/**",
      ],
      thresholds: {
        lines: 3,
        branches: 45,
        functions: 19,
        statements: 3,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
