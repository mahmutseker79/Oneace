// src/lib/movements/no-direct-create.static.test.ts
//
// Pinned static-analysis test for P0-01 (GOD MODE roadmap 2026-04-23).
//
// Invariant
// ---------
//   Exactly ONE file in the repo is permitted to call
//   `stockMovement.create(...)` — the seam at `src/lib/movements/post.ts`.
//
// Why this test exists
// --------------------
// The seam (`postMovement`) is the single place where cost-attribution
// (ADR-001 FIFO/WAC), idempotency-middleware plumbing, and future audit
// hooks will be wired. If a new action handler calls
// `tx.stockMovement.create` directly, it silently bypasses all of that.
// Reviewers cannot reliably catch this by eye in a 953-file repo, so
// this test pins the invariant at CI time.
//
// How it works
// ------------
// Scan every `.ts`/`.tsx` file under `src/` (excluding `src/generated/**`
// which contains Prisma-generated stubs). If we find a
// `stockMovement.create(` substring in a file that is NOT in the
// allowlist below, fail.
//
// Allowlist lifecycle
// -------------------
// The allowlist starts with all current call sites (this commit adds
// only the seam + tests; no refactor yet). Each subsequent refactor
// commit migrates one call site and removes it from this allowlist.
// When the allowlist contains only `src/lib/movements/post.ts`, the
// roadmap's P0-01 item is closed and the commit sequence
// `v1.6.0-rc{1..N}-postmovement-seam` tags converge on
// `v1.6.0-postmovement-seam-complete`.
//
// What this test is NOT
// ---------------------
//   - Not a runtime assertion. It is a build-time / CI-time guard.
//   - Not a regex for cost attribution (that lives in the seam's unit
//     test once ADR-001 ships).
//   - Not a tenant-scope check (that is pinned elsewhere in
//     `src/lib/security/*.test.ts`).

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Files that are explicitly permitted to call
 * `stockMovement.create(...)`. Paths are POSIX-style relative to the
 * repo root.
 *
 * THE SEAM itself — `src/lib/movements/post.ts` — is the terminal
 * entry on this list. Every other entry is a transitional callsite
 * scheduled for refactor in the 0-7 day sprint.
 *
 * When you migrate a callsite to `postMovement(tx, ...)`, REMOVE it
 * from this list in the same commit. Do NOT leave dead entries.
 */
const ALLOWED_CALLSITES: ReadonlySet<string> = new Set(
  [
    // The seam itself. Must remain.
    "src/lib/movements/post.ts",

    // Test fakes — explicitly stub a `stockMovement.create` on a
    // fake TxClient. Not a real write.
    "src/lib/movements/post.test.ts",
    "src/lib/movements/no-direct-create.static.test.ts",

    // --- Transitional callsites: 18 → 16 → 7 → 2 → 1 → 0 ---
    //
    // rc2: purchase-orders/actions.ts, sales-orders/actions.ts
    // rc3: transfers/actions.ts (5), kits/actions.ts (4)
    // rc4: bin-transfer-action.ts, putaway/actions.ts,
    //      movements/transfers/new/actions.ts, movements/actions.ts,
    //      inventory/status-change/actions.ts
    // rc5: stock-counts/actions.ts (count reconcile ADJUSTMENT)
    // rc6: import-engine.ts (bulk import, structural TxClient via `db`)
    //
    // ⬆ This commit (rc6) was the last transitional site. Allowlist is
    // now empty of action-layer entries. The only permitted callsites
    // are the seam itself and its own test stubs. If a future commit
    // adds a new `stockMovement.create` anywhere, this test fails the
    // PR — the desired end state of P0-01.
  ].map(toPosix),
);

/**
 * Directories under `src/` that we skip entirely. Prisma generated
 * output contains `prisma.stockMovement.create(...)` in doc comments
 * that would otherwise trip the scan.
 */
const SKIP_PREFIXES = ["src/generated", "src/generated/prisma", "src/generated/prisma.old"].map(
  toPosix,
);

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function walk(dir: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function repoRelative(absPath: string, repoRoot: string): string {
  return toPosix(path.relative(repoRoot, absPath));
}

function isSkipped(rel: string): boolean {
  return SKIP_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
}

/**
 * Strip line comments and block comments from TypeScript source before
 * scanning. Keeps the check honest: a migration-note comment that
 * mentions the old call shape for posterity should NOT make the
 * static test trip.
 *
 * Deliberately naive — does not handle comments inside string literals
 * perfectly. Accepted trade-off: nobody writes the call shape inside a
 * template literal in this codebase, and the unit-test suite for the
 * seam covers real behaviour.
 */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  let inString: '"' | "'" | "`" | null = null;
  let inBlockComment = false;
  let inLineComment = false;
  while (i < n) {
    const c = src[i]!;
    const next = i + 1 < n ? src[i + 1]! : "";
    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        out += c;
      }
      i += 1;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      if (c === "\n") out += c; // preserve line numbers for debugging
      i += 1;
      continue;
    }
    if (inString) {
      if (c === "\\" && i + 1 < n) {
        out += c + next;
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inString = c;
      out += c;
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

describe("stripComments — comment-aware scan (guards against false positives)", () => {
  it("strips a line comment mentioning stockMovement.create", () => {
    const src = "const x = 1; // migrated from tx.stockMovement.create";
    expect(stripComments(src)).toBe("const x = 1; ");
  });
  it("strips a block comment mentioning stockMovement.create", () => {
    const src = "/* was: tx.stockMovement.create(...) */ foo();";
    expect(stripComments(src)).toBe(" foo();");
  });
  it("preserves stockMovement.create inside a real expression", () => {
    const src = "await tx.stockMovement.create({ data });";
    expect(stripComments(src)).toContain("tx.stockMovement.create");
  });
  it("preserves stockMovement.create inside a string literal (we don't try to parse into strings)", () => {
    // This is intentional: stripping comments is enough. A string
    // literal mentioning the call would be a vanishingly rare false
    // positive and is not worth a full JS parser.
    const src = `const note = "see stockMovement.create()";`;
    expect(stripComments(src)).toContain("stockMovement.create");
  });
});

describe("postMovement seam — no direct stockMovement.create outside allowlist", () => {
  it("every stockMovement.create callsite is in the allowlist", () => {
    // Resolve repo root by walking upwards from this file until we find
    // `package.json`. Keeps the test robust to being moved.
    let repoRoot = path.resolve(__dirname);
    while (repoRoot !== path.dirname(repoRoot)) {
      if (fs.existsSync(path.join(repoRoot, "package.json"))) break;
      repoRoot = path.dirname(repoRoot);
    }
    const srcDir = path.join(repoRoot, "src");
    expect(fs.existsSync(srcDir), `expected ${srcDir} to exist`).toBe(true);

    const files = walk(srcDir);
    const offenders: string[] = [];
    for (const absPath of files) {
      const rel = repoRelative(absPath, repoRoot);
      if (isSkipped(rel)) continue;
      const raw = fs.readFileSync(absPath, "utf8");
      // Strip comments — a migration-note comment mentioning
      // `stockMovement.create(...)` should NOT trip the check.
      const code = stripComments(raw);
      if (!code.includes("stockMovement.create")) continue;
      if (ALLOWED_CALLSITES.has(rel)) continue;
      offenders.push(rel);
    }

    expect(
      offenders,
      [
        "",
        "Direct `stockMovement.create` calls detected outside the",
        "postMovement seam. Either:",
        "  (a) migrate the callsite to `postMovement(tx, ...)`, OR",
        "  (b) add an explicit entry to ALLOWED_CALLSITES in",
        "      src/lib/movements/no-direct-create.static.test.ts",
        "",
        "Offending files:",
        ...offenders.map((f) => `  - ${f}`),
        "",
      ].join("\n"),
    ).toEqual([]);
  });

  it("every allowlist entry actually contains a stockMovement.create (no dead entries)", () => {
    let repoRoot = path.resolve(__dirname);
    while (repoRoot !== path.dirname(repoRoot)) {
      if (fs.existsSync(path.join(repoRoot, "package.json"))) break;
      repoRoot = path.dirname(repoRoot);
    }

    const deadEntries: string[] = [];
    for (const rel of ALLOWED_CALLSITES) {
      // Tests themselves are permitted to not contain the literal
      // string (they might reference it via regex or variable). Only
      // validate source entries under `src/app` / `src/lib/movements`.
      const isTestStub =
        rel === "src/lib/movements/post.test.ts" ||
        rel === "src/lib/movements/no-direct-create.static.test.ts";
      const absPath = path.join(repoRoot, rel);
      if (!fs.existsSync(absPath)) {
        deadEntries.push(`${rel} (file not found)`);
        continue;
      }
      if (isTestStub) continue;
      const raw = fs.readFileSync(absPath, "utf8");
      const code = stripComments(raw);
      if (!code.includes("stockMovement.create")) {
        deadEntries.push(`${rel} (no stockMovement.create found)`);
      }
    }

    expect(
      deadEntries,
      [
        "",
        "Stale entries in ALLOWED_CALLSITES. If you migrated a callsite",
        "to `postMovement(tx, ...)`, remove it from the allowlist in the",
        "same commit rather than leaving a dead entry behind.",
        "",
        "Stale entries:",
        ...deadEntries.map((f) => `  - ${f}`),
        "",
      ].join("\n"),
    ).toEqual([]);
  });
});
