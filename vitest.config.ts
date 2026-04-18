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
// Thresholds are floors (fail below). Start at conservative zeros and
// ramp up per tier as baseline measurement lands in CI. The goal is
// drift-prevention: once a slice measures > 0, its threshold is raised
// to that slice's floor (minus a small buffer) in a follow-up commit.
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
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
