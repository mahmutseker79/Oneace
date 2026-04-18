// v1.2 P3 follow-up — "use server" export-shape pin.
//
// The Vercel build for `1da802c` (the v1.2 P3 closing commit) failed
// with:
//
//   Error: Only async functions are allowed to be exported in a
//   "use server" file.
//   ./src/app/(app)/migrations/actions.ts:328:1
//     export class MigrationRollbackNotImplementedError extends Error
//
// Root cause: Next.js 15's server-action compiler (React RSC) treats
// every export of a `"use server"` module as a remotely-callable
// action, so only `export async function` / `export default async
// function` is legal. A plain `export class` / `export const` / sync
// `export function` compiles under Webpack locally (we don't have
// RSC analysis on in `vitest`/`tsc --noEmit`) but blows up the
// Vercel build.
//
// This test walks every file that declares `"use server"` and pins
// the shape:
//
//   1. No `export class …`
//   2. No `export const …` (including `export const foo = async …`
//      — the RSC compiler still refuses these)
//   3. No plain `export function foo` that isn't `async`
//   4. `export default` must be an async function
//   5. No `export { … }` re-exports (the RSC compiler can't prove
//      the target is an async function). `export type { … }` is
//      fine because the TS compiler erases it before RSC runs.
//
// This is a source-level check, not a runtime one — vitest can't
// invoke Next.js' action compiler. The regex-based walker trades
// precision for speed and deliberately errs on the side of flagging
// anything ambiguous.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const SRC = join(REPO_ROOT, "src");

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    // Skip generated code, node_modules, and .next — none should
    // ever carry `"use server"`, and scanning them adds noise.
    if (name === "generated" || name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (
      /\.(ts|tsx)$/.test(name) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      yield full;
    }
  }
}

function hasUseServerHeader(source: string): boolean {
  // The directive must be the first non-comment, non-blank statement
  // of the file. We don't try to out-parse the compiler — we just
  // check the first 80 lines for a `"use server"` at statement
  // position.
  const lines = source.split("\n").slice(0, 80);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    return /^["']use server["']\s*;?/.test(trimmed);
  }
  return false;
}

type Violation = { file: string; line: number; text: string; rule: string };

function scanExports(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimStart();
    if (line.startsWith("//") || line.startsWith("*")) continue;

    // 1. No `export class …`
    if (/^export\s+class\b/.test(line)) {
      violations.push({ file, line: i + 1, text: raw, rule: "export class" });
      continue;
    }

    // 2. No `export const …` — even `export const foo = async () =>
    //    {}` is rejected by the RSC compiler.
    if (/^export\s+const\b/.test(line)) {
      violations.push({ file, line: i + 1, text: raw, rule: "export const" });
      continue;
    }

    // 3. Plain `export function` without `async` is not allowed.
    //    (`export async function` is fine.)
    if (/^export\s+function\b/.test(line)) {
      violations.push({ file, line: i + 1, text: raw, rule: "export function (non-async)" });
      continue;
    }

    // 4. `export default` must be an async function. Accept
    //    `export default async function` and `export default async (`.
    if (/^export\s+default\b/.test(line)) {
      const isAsyncFn =
        /^export\s+default\s+async\s+function\b/.test(line) ||
        /^export\s+default\s+async\s*\(/.test(line);
      if (!isAsyncFn) {
        violations.push({ file, line: i + 1, text: raw, rule: "export default (non-async)" });
      }
      continue;
    }

    // 5. Re-exports — illegal except for `export type { … }` (type-
    //    only re-exports are erased before RSC runs).
    if (/^export\s*\{/.test(line)) {
      if (!/^export\s+type\s*\{/.test(line)) {
        violations.push({ file, line: i + 1, text: raw, rule: "export { … } re-export" });
      }
    }
  }
  return violations;
}

describe("`use server` modules export async functions only (Vercel RSC build)", () => {
  const files: Array<{ path: string; source: string }> = [];
  for (const path of walk(SRC)) {
    const source = readFileSync(path, "utf8");
    if (hasUseServerHeader(source)) files.push({ path, source });
  }

  it("at least one `use server` module exists (sanity pin)", () => {
    // If this sanity check ever returns zero we want to know — it
    // means the walker is broken, not that the codebase has no
    // server actions.
    expect(files.length).toBeGreaterThan(0);
  });

  it("every `use server` module has only async-function exports", () => {
    const allViolations: Violation[] = [];
    for (const { path, source } of files) {
      allViolations.push(...scanExports(path, source));
    }
    const summary = allViolations.map(
      (v) => `${relative(REPO_ROOT, v.file)}:${v.line}  [${v.rule}]  ${v.text.trim()}`,
    );
    expect(
      summary,
      `Next.js "use server" modules may only export async functions. Move non-async exports into a sibling non-"use server" file and import them back.\n\n${summary.join("\n")}`,
    ).toEqual([]);
  });

  it("the migrations/actions.ts file is in scope (specific regression pin)", () => {
    // v1.2 Vercel build regression — `actions.ts` used to export
    // `MigrationRollbackNotImplementedError` inline. The walker must
    // pick it up so future regressions on that exact file trip this
    // test before Vercel does.
    const paths = files.map((f) => relative(REPO_ROOT, f.path).replace(/\\/g, "/"));
    expect(paths).toContain("src/app/(app)/migrations/actions.ts");
  });
});
