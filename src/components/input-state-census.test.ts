// Permanent guard — Sprint 22 (UX/UI audit Apr-25 §D-1 — yeni TRACK FAMILY).
//
// Input state + size census + anti-pattern guard.
//
// §D-1 = state-bazlı primitive census (variant= değil state= prop). Card/Badge/
// Button/Alert §C-3..§C-6 variant= track'inin yanına yeni track family. Sonraki
// state-bazlı primitive'ler (varsa) buraya eklenir.
//
// Input primitive cva tabanlı:
//   - size: sm / default / lg (3 size)
//   - state: default / error / success (3 state)
//   - invalid?: boolean (state="error" alias + aria-invalid auto-set)
//
//   1) Anti-pattern HARD FAIL: `<Input className="border-(red|yellow|green|blue)-... |
//      border-destructive | border-success | bg-(red|yellow|green|blue)-...">`
//      raw className renk override yasak. Doğru çözüm: `state=` prop veya
//      `invalid` prop kullan.
//
//   2) State census informational: state= prop kullanım sayısı (default/error/success).
//
//   3) Size census informational: size= prop kullanım sayısı (sm/default/lg).
//
//   4) `invalid` prop kullanım sayısı (state="error" alias).
//
//   5) Variant union güncel: input.tsx cva çağrısında 3 size + 3 state korunur.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC_DIR = resolve(REPO_ROOT, "src");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") && !entry.endsWith(".stories.tsx")) {
      yield full;
    }
  }
}

// Anti-pattern: <Input> opening tag with className overriding color/state tokens.
// Negative lookahead `(?!\/|-)`: `border-destructive/50` veya `border-destructive-foreground`
// gibi legitimate kullanımları muaf tutar.
const ANTI_PATTERN_REGEX =
  /<Input\b[^>]*className=["'][^"']*(border-(?:red|yellow|green|blue)-|bg-(?:red|yellow|green|blue)-|border-destructive(?!\/|-)|border-success(?!\/|-)|border-warning(?!\/|-))[^"']*["']/;

const STATE_REGEX = /<Input\b[^>]*\bstate=["'](\w+)["']/g;
const SIZE_REGEX = /<Input\b[^>]*\bsize=["'](\w+)["']/g;
const INVALID_REGEX = /<Input\b[^>]*\binvalid(?:=\{(?:true|[^}]+)\})?(?:\s|\/?>)/g;
const ANY_INPUT_REGEX = /<Input\b/g;

function countMatches(content: string, regex: RegExp): number {
  return (content.match(regex) || []).length;
}

describe("§D-1 Input state + size census + anti-pattern hard-fail (Sprint 22)", () => {
  it("Anti-pattern: raw color/token border className override on Input (hard fail = 0)", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      if (ANTI_PATTERN_REGEX.test(content)) {
        offenders.push(file.replace(`${REPO_ROOT}/`, ""));
      }
    }
    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `Input raw color/token border className override. Use state= or invalid prop instead:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("State + size + invalid census snapshot (informational)", () => {
    const stateCounts = new Map<string, number>();
    const sizeCounts = new Map<string, number>();
    let totalInputs = 0;
    let invalidPropUsage = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      totalInputs += countMatches(content, ANY_INPUT_REGEX);

      let m: RegExpExecArray | null;
      STATE_REGEX.lastIndex = 0;
      while ((m = STATE_REGEX.exec(content)) !== null) {
        stateCounts.set(m[1], (stateCounts.get(m[1]) ?? 0) + 1);
      }
      SIZE_REGEX.lastIndex = 0;
      while ((m = SIZE_REGEX.exec(content)) !== null) {
        sizeCounts.set(m[1], (sizeCounts.get(m[1]) ?? 0) + 1);
      }
      INVALID_REGEX.lastIndex = 0;
      while ((m = INVALID_REGEX.exec(content)) !== null) {
        invalidPropUsage++;
      }
    }
    const sortedStates = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]);
    const sortedSizes = [...sizeCounts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `[input-state-census] total=${totalInputs} invalid_prop=${invalidPropUsage}\n` +
        `  states: ${sortedStates.map(([v, n]) => `${v}=${n}`).join(", ") || "(default only)"}\n` +
        `  sizes:  ${sortedSizes.map(([v, n]) => `${v}=${n}`).join(", ") || "(default only)"}`,
    );
    expect(totalInputs).toBeGreaterThan(0);
  });

  it("cva union güncel: 3 size + 3 state values", () => {
    const inputSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/input.tsx"), "utf8");
    expect(inputSrc).toMatch(/cva\(/);
    // size variants
    expect(inputSrc).toMatch(/sm:\s*"/);
    expect(inputSrc).toMatch(/default:\s*"/);
    expect(inputSrc).toMatch(/lg:\s*"/);
    // state variants
    expect(inputSrc).toMatch(/error:\s*"/);
    expect(inputSrc).toMatch(/success:\s*"/);
    // invalid prop alias
    expect(inputSrc).toMatch(/invalid\?:\s*boolean/);
  });
});
