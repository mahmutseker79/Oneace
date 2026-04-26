// Permanent guard — Sprint 15 PR #2 (UX/UI audit Apr-25 §B-7), Sprint 17 PR #2 closure.
//
// Sprint 14 PR #3 informational soft-fail audit'i (threshold ≤10) bu sprint
// hard-fail moda alındı. ÜÇ pattern flavor — hepsi threshold = 0 HARD FAIL:
//
//   A) Literal "No " text:
//        <CardContent ... py-N ... ><p ... text-muted-foreground>No data...
//      Sprint 11/12/13/14 tarafından sıfırlandı (=0 since Sprint 15).
//
//   B) i18n `{labels.no/empty/nothing...}` expression:
//        <CardContent ... py-N text-center ... ><p ... text-muted-foreground>{labels.noBins}
//      Sprint 15 PR #1 (pack 5) tarafından sıfırlandı (=0 since Sprint 15).
//
//   C) Ternary `X.length === 0 ?` + muted-foreground p:
//        {items.length === 0 ? (<p className="... text-muted-foreground">empty</p>) : ...}
//      Sprint 16 PR #2 (pack 6) 17→12, Sprint 17 PR #1 (pack 7) 12→0.
//      Sprint 17 PR #2 (bu commit) hard-fail promote (threshold=0).
//
// Üçü de hard-fail. Yeni inline empty pattern merge edildiğinde CI blok eder;
// doğru çözüm `<EmptyState />` kullanmak (gerekirse `bare` prop ile).

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

// --- Pattern C (HARD FAIL since Sprint 17 PR #2): ternary length===0 + muted p ---
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

  it("Pattern C — ternary length===0 inline empty: threshold = 0 (HARD FAIL since Sprint 17)", () => {
    const offenders = findOffenders(TERNARY_LEN_ZERO);
    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `Ternary inline empty pattern. Migrate to <EmptyState bare/>:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
