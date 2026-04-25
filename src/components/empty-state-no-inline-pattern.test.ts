// Permanent guard — Sprint 15 PR #2 (UX/UI audit Apr-25 §B-7).
//
// Sprint 14 PR #3 informational soft-fail audit'i (threshold ≤10) bu sprint
// hard-fail moda alındı. İki pattern flavor var:
//
//   A) Literal "No " text:
//        <CardContent ... py-N ... ><p ... text-muted-foreground>No data...
//      Sprint 11/12/13/14 tarafından sıfırlandı.
//
//   B) i18n `{labels.no/empty/nothing...}` expression:
//        <CardContent ... py-N text-center ... ><p ... text-muted-foreground>{labels.noBins}
//      Sprint 15 PR #1 (pack 5) tarafından sıfırlandı.
//
// Her ikisi için de threshold = 0 (HARD FAIL). Yeni inline empty pattern
// merge edildiğinde CI blok eder; doğru çözüm `<EmptyState />` kullanmak.
//
// Ayrıca informational soft-fail: ternary `X.length === 0 ? <p ... muted ...`
// pattern'i (Sprint 16+ pack 6/7 backlog). Hard-fail değil, ≤20 threshold.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(REPO_ROOT, "src/app");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

// --- Pattern A: literal "No " in muted-foreground inside Card+padding ---
const LITERAL_NO_INLINE_EMPTY =
  /<CardContent[^>]*py-(?:6|8|10|12|14|16)[^>]*>[\s\S]{0,200}<p[^>]*text-(?:center|sm)[^>]*text-muted-foreground[^>]*>\s*No\s/;

// --- Pattern B: i18n {labels.no/empty/nothing} expression ---
const I18N_INLINE_EMPTY =
  /<CardContent[^>]*py-\d+[^>]*text-center[^>]*>[\s\S]{0,400}<p[^>]*text-muted-foreground[^>]*>\s*\{labels\.(?:no|empty|nothing)/i;

// --- Pattern C (informational, soft-fail): ternary length===0 + muted p ---
const TERNARY_LEN_ZERO =
  /\w+\.length\s*===?\s*0\s*\?[\s\S]{0,150}<p[^>]*text-muted-foreground/;

function findOffenders(pattern: RegExp): string[] {
  const offenders: string[] = [];
  for (const file of walk(APP_DIR)) {
    const content = readFileSync(file, "utf8");
    if (pattern.test(content)) {
      offenders.push(file.replace(`${REPO_ROOT}/`, ""));
    }
  }
  return offenders;
}

describe("§B-7 hard-fail guard — no inline empty pattern in src/app", () => {
  it("Pattern A — literal 'No ' inline empty: threshold = 0", () => {
    const offenders = findOffenders(LITERAL_NO_INLINE_EMPTY);
    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `Inline empty pattern (literal "No "). Migrate to <EmptyState/>:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Pattern B — i18n {labels.no/empty/nothing} inline empty: threshold = 0", () => {
    const offenders = findOffenders(I18N_INLINE_EMPTY);
    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `i18n inline empty pattern. Migrate to <EmptyState title={labels.X}/>:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Pattern C — informational ternary length===0 (soft-fail ≤20, Sprint 16+ backlog)", () => {
    const offenders = findOffenders(TERNARY_LEN_ZERO);
    if (offenders.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[empty-state-ternary-audit] ${offenders.length} files use ternary length===0 inline empty (Sprint 16+ pack 6/7 backlog):\n  ` +
          offenders.join("\n  "),
      );
    }
    // Soft-fail: report only. Sprint 16+ pack hedefi: bu sayıyı 0'a indirmek.
    expect(offenders.length).toBeLessThanOrEqual(20);
  });
});
