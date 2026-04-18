/**
 * v1.5.13 hotfix — Edge Runtime safety guard for the server logger.
 *
 * Background: on 2026-04-18, every request to oneace-next-local.vercel.app
 * was returning `MIDDLEWARE_INVOCATION_FAILED` with the runtime error
 * `TypeError: Cannot read properties of undefined (reading 'write')`.
 *
 * Root cause: `src/middleware.ts` imports `@/lib/rate-limit`, whose
 * module-top-level `logger.warn("Rate limiter is running in in-process
 * mode...")` fires whenever Upstash Redis creds are not configured
 * AND `NODE_ENV === "production"` — i.e. the common production path.
 * The warn call dispatched through the production branch of
 * `src/lib/logger.ts:emit()`, which used
 *
 *     process.stderr.write(`${line}\n`);
 *     process.stdout.write(`${line}\n`);
 *
 * In Vercel's Edge Runtime, `process.stdout` and `process.stderr` are
 * undefined. Reading `.write` on either throws, the middleware
 * invocation fails, and Vercel returns a 500 to every request.
 *
 * Fix: the production branch now uses `console.error` / `console.log`,
 * which exist in every runtime (Edge, Node, test/JSDOM).
 *
 * This test is a static-analysis guard — it reads `logger.ts` as
 * text and asserts the module never re-introduces a direct
 * `process.stdout` / `process.stderr` reference. The guard is
 * intentionally string-based (not a runtime import) so it passes
 * under every Vitest runtime, and so a future maintainer that
 * "just uses process.stdout" gets a failing test before the code
 * ever ships.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const LOGGER_SRC_PATH = resolve(__dirname, "logger.ts");

describe("logger — Edge Runtime safety (v1.5.13 hotfix)", () => {
  const src = readFileSync(LOGGER_SRC_PATH, "utf8");

  it("must not reference process.stdout (undefined in Edge Runtime)", () => {
    // Strip comments before searching so the explanatory block quoting
    // the historical incident (`process.stderr.write(...)` as *prose*)
    // doesn't trip the guard. We only care about real code references.
    const codeOnly = stripComments(src);
    expect(codeOnly).not.toMatch(/process\.stdout/);
  });

  it("must not reference process.stderr (undefined in Edge Runtime)", () => {
    const codeOnly = stripComments(src);
    expect(codeOnly).not.toMatch(/process\.stderr/);
  });

  it("must use console.error for the warn/error production branch", () => {
    // Positive assertion: the fix is in place. If someone deletes the
    // console.error call without replacing it, this fires even if the
    // negative guards above still pass.
    expect(src).toMatch(/console\.error\(line\)/);
  });

  it("must use console.log for the info/debug production branch", () => {
    expect(src).toMatch(/console\.log\(line\)/);
  });
});

/**
 * Strip line (`// …`) and block (`/* … *​/`) comments from a TS
 * source string. Naive but sufficient for our logger.ts — the file
 * has no string literals containing `//` or `/*`, so we don't need
 * a real tokenizer.
 */
function stripComments(source: string): string {
  // Remove block comments first (non-greedy, dotall via [\s\S]).
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments. The regex anchors to start-of-line OR
  // whitespace so a URL like `https://…` in a string literal is
  // left alone — again, logger.ts has no such literals today.
  return withoutBlocks.replace(/(^|\s)\/\/.*$/gm, "$1");
}
