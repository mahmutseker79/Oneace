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
// We shell out to `biome check --diagnostic-level=error` rather
// than importing Biome's API because:
//   - the CLI is the ground truth — anything else is a simulation.
//   - Biome's API surface is not considered stable and we don't want
//     a Biome-SDK-version bump to break tests.
//
// We call the local `node_modules/.bin/biome` binary directly (not
// through `pnpm exec` / `npx`). Rationale: if vitest is running, the
// `biome` dependency is already installed next to it, so the local
// binary is guaranteed to be resolvable. A `pnpm`-based invocation
// drags in a package-manager dependency that isn't present in every
// sandbox (e.g. CI runners that pre-install deps and then call
// vitest directly), which made the test fail for pm-less reasons
// rather than real lint errors — defeating the purpose of a gate.
//
// The subprocess runs from the repo root. Timeout is 60s to give
// biome room on a cold run.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("lint gate (Biome error-level diagnostics)", () => {
  it("`biome check --diagnostic-level=error .` exits 0", () => {
    // Platform-correct local binary path. `.cmd` on Windows, no
    // extension on POSIX. vitest runs from the nearest `package.json`
    // (the repo root here), so `node_modules/.bin/biome` is the
    // canonical location.
    const binName = process.platform === "win32" ? "biome.cmd" : "biome";
    const biomeBin = resolve(process.cwd(), "node_modules", ".bin", binName);
    expect(
      existsSync(biomeBin),
      `Biome binary not found at ${biomeBin}. Run \`pnpm install\` before \`pnpm test\`.`,
    ).toBe(true);

    const result = spawnSync(biomeBin, ["check", "--diagnostic-level=error", "."], {
      stdio: "pipe",
      encoding: "utf8",
      timeout: 60_000,
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
