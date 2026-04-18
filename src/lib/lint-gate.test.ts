// God-Mode v2 §3 — lint gate.
//
// The audit flagged `pnpm lint` as a non-gate because 96 error-level
// Biome diagnostics were tolerated and `next.config.ts` further
// disables ESLint during build with `eslint.ignoreDuringBuilds: true`.
// In Phase 3 we drove the error count to zero (warnings remain and
// are triaged on their own cadence — they don't break CI). This pin
// ensures a future commit that introduces a new error-level
// diagnostic fails `pnpm test` before it fails CI lint, which gives
// reviewers a clearer signal than a raw biome stderr dump.
//
// We shell out to `biome check --diagnostic-level=error` via pnpm
// exec rather than importing Biome's API because:
//   - the CLI is the ground truth — anything else is a simulation.
//   - Biome's API surface is not considered stable and we don't want
//     a Biome-SDK-version bump to break tests.
//
// The subprocess runs from the repo root (`cwd: process.cwd()`
// when the test is invoked via `pnpm test` from the repo root; vitest
// sets cwd to the nearest `package.json`). Timeout is 60s to give
// biome room on first run in the sandbox.

import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("lint gate (Biome error-level diagnostics)", () => {
  it("`biome check --diagnostic-level=error .` exits 0", () => {
    // `spawnSync` is the lowest-friction way to assert a subprocess's
    // exit code without mocking vitest's runner. `shell: true` is
    // intentional so the `pnpm` binary resolves via the project's
    // PATH rather than us hardcoding a path.
    const result = spawnSync("pnpm", ["exec", "biome", "check", "--diagnostic-level=error", "."], {
      stdio: "pipe",
      encoding: "utf8",
      timeout: 60_000,
      shell: true,
    });

    // If Biome itself blew up (spawn error, non-integer status), we
    // want the assertion message to show why rather than a bare
    // `expect(null).toBe(0)`.
    if (result.error) {
      throw result.error;
    }

    // Attach stdout/stderr to the failure message so a regression
    // is self-explanatory in CI logs.
    if (result.status !== 0) {
      const out = [result.stdout, result.stderr].filter(Boolean).join("\n");
      throw new Error(
        `Biome reported at least one error-level diagnostic. Fix the errors below or justify a suppression with a biome-ignore comment.\n\n${out}`,
      );
    }

    expect(result.status).toBe(0);
  }, 90_000);
});
