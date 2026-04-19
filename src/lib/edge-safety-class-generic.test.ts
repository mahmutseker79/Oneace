/**
 * Audit v1.3 §5.47 F-03 — Edge-safety class-generic guard.
 *
 * What this pins
 * --------------
 * The 2026-04-18 incident (`src/lib/logger.ts` calling
 * `process.stderr.write(...)` at Edge runtime) triggered a middleware
 * invocation failure that 500'd every request. v1.5.13 hotfix moved
 * logger.ts to `console.error/log` and the accompanying
 * `logger-edge-safety.test.ts` pinned that single module against the
 * re-introduction of `process.stdout/stderr`.
 *
 * The gap v1.3 §5.47 called out: the guard was **module-specific**
 * (logger.ts only) but the incident was **class-level** — every
 * module in the Edge-bundle closure can introduce the same class of
 * bug (Node-only API reaching the Edge runtime). `rate-limit.ts`,
 * `middleware.ts`, `env.ts` all ship into that closure via the
 * middleware entry point's transitive imports, and none had a
 * Node-only-API pin of their own.
 *
 * This test closes that gap. The **edge-bundle closure** is defined
 * below as a hand-maintained list; if a new module enters the closure
 * (e.g. middleware.ts grows a new import), adding the module to the
 * list here is the contract a reviewer enforces in PR. Each module
 * in the list is scanned (code only, comments stripped) for a pinned
 * set of Node-only surface uses.
 *
 * Forbidden surface (picked because each has bitten a production
 * Edge bundle in a real framework, somewhere):
 *
 *   • `process.stdout`, `process.stderr` — undefined in Edge
 *     (the 2026-04-18 incident).
 *   • `process.cwd(`, `process.chdir(`, `process.argv` — no fs
 *     concept in Edge.
 *   • `Buffer.` / `new Buffer(` — Edge has `Uint8Array` / Web
 *     Streams, not Node's `Buffer`.
 *   • Dynamic `require(` — Edge has no CommonJS loader; the bundler
 *     sometimes preserves a `require` symbol that throws at runtime.
 *   • Imports from Node built-ins (`fs`, `node:fs`, `child_process`,
 *     `node:child_process`, `os`, `node:os`, `path`, `node:path`,
 *     `crypto`, `node:crypto` — the last because Edge uses the Web
 *     Crypto global; the bare Node `crypto` is the hazard).
 *
 * `process.env.*` is explicitly allowed — Edge populates it with the
 * request-time env and every module in our closure reads from it.
 *
 * Static-analysis only (feedback_pinned_tests.md). Reads each module
 * source as text, strips `/* … *\/` + `// …` comments so historical
 * prose in JSDoc blocks (which legitimately quotes
 * `process.stderr.write(…)` as the thing we're guarding against)
 * doesn't trip the guard, and runs a regex per forbidden pattern.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The Edge-bundle closure for `src/middleware.ts`.
 *
 * Computed by hand from the current import graph:
 *
 *   middleware.ts
 *     └─ @/lib/rate-limit
 *          ├─ @/lib/env
 *          └─ @/lib/logger
 *               └─ @/lib/env
 *
 * If a new `@/lib/*` import lands in any of these files, it MUST be
 * added here too. The registry in this list IS the pinned scope of
 * the class-generic guard — drifting from the real closure is the
 * failure mode to avoid.
 */
const EDGE_CLOSURE_MODULES = [
  "src/middleware.ts",
  "src/lib/rate-limit.ts",
  "src/lib/logger.ts",
  "src/lib/env.ts",
] as const;

/**
 * Patterns that must NOT appear in any edge-closure module (code,
 * not comments). Each entry has a short rationale on the same row
 * so a failure message points directly at why the pattern is banned.
 */
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bprocess\.stdout\b/, label: "process.stdout (undefined in Edge Runtime)" },
  { pattern: /\bprocess\.stderr\b/, label: "process.stderr (undefined in Edge Runtime)" },
  { pattern: /\bprocess\.cwd\s*\(/, label: "process.cwd() (no filesystem in Edge)" },
  { pattern: /\bprocess\.chdir\s*\(/, label: "process.chdir() (no filesystem in Edge)" },
  { pattern: /\bprocess\.argv\b/, label: "process.argv (no argv in Edge)" },
  { pattern: /\bBuffer\./, label: "Buffer.* (Edge has Uint8Array, not Buffer)" },
  { pattern: /\bnew\s+Buffer\s*\(/, label: "new Buffer(...) (Edge has no Buffer constructor)" },
  // `require(` in code — NOT `require.resolve` in a tool config or a
  // string literal. The `\brequire\s*\(` anchor catches bare call
  // sites including `const x = require(...)` and `.require(...)`.
  { pattern: /(^|[^\w.])require\s*\(/, label: "require(...) (Edge has no CommonJS loader)" },
  // Node-built-in imports (ESM form). We only need to catch the
  // module specifier string — both `"fs"` and `"node:fs"` variants.
  {
    pattern: /from\s+["'](?:node:)?fs["']/,
    label: "import from 'fs'/'node:fs' (Edge has no filesystem)",
  },
  {
    pattern: /from\s+["'](?:node:)?child_process["']/,
    label: "import from 'child_process' (no subprocesses in Edge)",
  },
  { pattern: /from\s+["'](?:node:)?os["']/, label: "import from 'os' (no OS API in Edge)" },
  {
    pattern: /from\s+["'](?:node:)?path["']/,
    label: "import from 'path' (Edge has no filesystem path module)",
  },
  {
    pattern: /from\s+["'](?:node:)?crypto["']/,
    label: "import from 'crypto' (use the Web Crypto global in Edge, not Node's crypto)",
  },
  {
    pattern: /from\s+["'](?:node:)?stream["']/,
    label: "import from 'stream' (Edge has Web Streams only)",
  },
  {
    pattern: /from\s+["'](?:node:)?zlib["']/,
    label: "import from 'zlib' (use CompressionStream/DecompressionStream in Edge)",
  },
];

describe("§5.47 F-03 — Edge-safety class-generic guard", () => {
  it("edge-closure module list is non-empty (registry integrity)", () => {
    // Sanity: this test becomes silent if the list accidentally empties.
    expect(EDGE_CLOSURE_MODULES.length).toBeGreaterThan(0);
  });

  it.each(EDGE_CLOSURE_MODULES)("%s — no Node-only API surface in code", (relPath) => {
    const abs = resolve(process.cwd(), relPath);
    const raw = readFileSync(abs, "utf8");
    const code = stripComments(raw);

    const violations: string[] = [];
    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      if (pattern.test(code)) {
        violations.push(label);
      }
    }
    expect(
      violations,
      `Edge-closure module ${relPath} references Node-only API(s): ${violations.join("; ")}`,
    ).toEqual([]);
  });
});

describe("§5.47 F-03 — logger-edge-safety pin still holds (belt-and-suspenders)", () => {
  it("logger.ts keeps using console.error for the warn/error branch", () => {
    // Overlapping guard with `logger-edge-safety.test.ts` so the
    // class-generic scope still fails loud if someone deletes the
    // module-specific pin AND re-introduces `process.stderr`. Both
    // need to agree for green.
    const src = readFileSync(resolve(process.cwd(), "src/lib/logger.ts"), "utf8");
    expect(src).toMatch(/console\.error\(line\)/);
    expect(src).toMatch(/console\.log\(line\)/);
  });
});

describe("§5.47 F-03 — edge-bundle drift guard", () => {
  it("middleware.ts only imports from modules in the edge-closure list", () => {
    // If middleware.ts grows a new `@/lib/*` import, this guard forces
    // the reviewer to decide: is the new module Edge-safe? If yes,
    // add it to EDGE_CLOSURE_MODULES above so the class-generic scan
    // also covers it. If no, don't import it from middleware.
    const text = readFileSync(resolve(process.cwd(), "src/middleware.ts"), "utf8");
    const code = stripComments(text);
    const importMatches = code.match(/from\s+["']@\/lib\/[a-zA-Z0-9_\-/]+["']/g) ?? [];
    const importedPaths = importMatches.map((m) => {
      const pathMatch = m.match(/@\/lib\/([a-zA-Z0-9_\-/]+)/);
      return `src/lib/${pathMatch?.[1]}.ts`;
    });
    const closure = new Set<string>(EDGE_CLOSURE_MODULES);
    const drift = importedPaths.filter((p) => !closure.has(p));
    expect(
      drift,
      `middleware.ts imports module(s) missing from EDGE_CLOSURE_MODULES: ${drift.join(", ")}`,
    ).toEqual([]);
  });

  it("rate-limit.ts only imports from modules in the edge-closure list", () => {
    const text = readFileSync(resolve(process.cwd(), "src/lib/rate-limit.ts"), "utf8");
    const code = stripComments(text);
    const importMatches = code.match(/from\s+["']@\/lib\/[a-zA-Z0-9_\-/]+["']/g) ?? [];
    const importedPaths = importMatches.map((m) => {
      const pathMatch = m.match(/@\/lib\/([a-zA-Z0-9_\-/]+)/);
      return `src/lib/${pathMatch?.[1]}.ts`;
    });
    const closure = new Set<string>(EDGE_CLOSURE_MODULES);
    const drift = importedPaths.filter((p) => !closure.has(p));
    expect(
      drift,
      `rate-limit.ts imports module(s) missing from EDGE_CLOSURE_MODULES: ${drift.join(", ")}`,
    ).toEqual([]);
  });
});

/**
 * Strip line (`// …`) and block (`/* … *​/`) comments from a TS
 * source string. Naive but sufficient for our closure — none of the
 * files contain string literals with `//` or `/*` that the regex
 * would mis-strip.
 */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // Line-comment strip anchored to start-of-line OR whitespace, so a
  // URL like `https://…` inside a real string literal survives. None
  // of our closure files have such URL literals today, but the anchor
  // keeps the helper reusable.
  return withoutBlocks.replace(/(^|\s)\/\/.*$/gm, "$1");
}
