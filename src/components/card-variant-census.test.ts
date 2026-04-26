// Permanent guard — Sprint 18 PR #2 (UX/UI audit Apr-25 §C-3 follow-up).
//
// Card variant census + anti-pattern guard.
//
// Sprint 10 PR #3 Card primitive'i 7+ ad-hoc className kombinasyonundan 5
// named variant'a normalize etmişti (default, interactive, warning,
// destructive, info). Sprint 18 bu census'u kalıcılaştırır:
//
//   1) Anti-pattern HARD FAIL: `<Card className="border-red-... | bg-red-... |
//      border-yellow-... | bg-yellow-... | border-destructive | bg-destructive |
//      border-warning | bg-warning-light | border-success | bg-success">`
//      raw className renk override yasak. Doğru çözüm `variant=` kullan.
//
//   2) Snapshot informational: her variant'ın kullanım sayısı + total Card
//      sayısı. Variant evrimi (örn. completed eklenirse) izlenir.

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

// Anti-pattern: <Card> opening tag with className overriding color tokens.
// Tailwind raw color (red/yellow/green/blue) veya design token (destructive/
// warning/success/info) doğrudan className'de — variant prop yerine.
const ANTI_PATTERN_REGEX =
  /<Card\b[^>]*className=["'][^"']*(border-(?:red|yellow|green|blue)-|bg-(?:red|yellow|green|blue)-|border-destructive|bg-destructive|border-warning(?!\/)|bg-warning-light|border-success(?!\/)|bg-success(?!\/))[^"']*["']/;

// Variant prop kullanımı (per variant sayım).
const VARIANT_REGEX = /<Card\b[^>]*\bvariant=["'](\w+)["']/g;
// Variant'sız (default) Card sayımı.
const ANY_CARD_REGEX = /<Card\b/g;

function countMatches(content: string, regex: RegExp): number {
  return (content.match(regex) || []).length;
}

describe("§C-3 Card variant census + anti-pattern hard-fail (Sprint 18 PR #2)", () => {
  it("Anti-pattern: raw color className override on Card (hard fail = 0)", () => {
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
        : `Card raw color className override. Use variant= instead:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Variant census snapshot (informational)", () => {
    const variantCounts = new Map<string, number>();
    let totalCards = 0;
    let defaultCards = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      const totalInFile = countMatches(content, ANY_CARD_REGEX);
      totalCards += totalInFile;
      let m: RegExpExecArray | null;
      VARIANT_REGEX.lastIndex = 0;
      let withVariant = 0;
      while ((m = VARIANT_REGEX.exec(content)) !== null) {
        const variant = m[1];
        variantCounts.set(variant, (variantCounts.get(variant) ?? 0) + 1);
        withVariant++;
      }
      defaultCards += totalInFile - withVariant;
    }
    const sorted = [...variantCounts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `[card-variant-census] total=${totalCards} default=${defaultCards}\n  ` +
        sorted.map(([v, n]) => `${v}=${n}`).join(", "),
    );
    expect(totalCards).toBeGreaterThan(0);
  });

  it("Variant union has 5 named values (default + interactive + warning + destructive + info)", () => {
    const cardSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/card.tsx"), "utf8");
    expect(cardSrc).toMatch(/CardVariant\s*=\s*keyof\s+typeof\s+CARD_VARIANTS/);
    expect(cardSrc).toMatch(/default:\s*""/);
    expect(cardSrc).toMatch(/interactive:\s*"/);
    expect(cardSrc).toMatch(/warning:\s*"/);
    expect(cardSrc).toMatch(/destructive:\s*"/);
    expect(cardSrc).toMatch(/info:\s*"/);
  });
});
