// Phase 6B / Item 2 — minimal test harness.
//
// Scope: node-only, pure-function tests under `src/lib/**/*.test.ts`.
// Intentionally NOT configured for React Testing Library, jsdom,
// Playwright, Prisma integration, or coverage — those belong to later
// phases and would broaden the surface beyond the approved scope.
//
// The `@` alias mirrors tsconfig.json so test files can import from
// `@/lib/...` the same way app code does. `setupFiles` primes the
// minimum env vars that `src/lib/env.ts` refuses to start without, so
// test modules that transitively touch the env schema (rate-limit,
// invitations) can import cleanly without a real `.env` on disk.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
