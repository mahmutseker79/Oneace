// Permanent guard — Sprint 19 (UX/UI audit Apr-25 §C-4 — yeni track).
//
// Badge variant census + anti-pattern guard.
//
// Badge primitive 8 named variant kullanır (default, secondary, destructive,
// outline, success, warning, info, processing). cva tabanlı. Sprint 19 census'u
// kalıcılaştırır:
//
//   1) Anti-pattern HARD FAIL: `<Badge className="border-red-... | bg-red-... |
//      border-destructive | bg-destructive | bg-warning-light | bg-success-light |
//      bg-info-light | bg-secondary">` — raw className renk/token override
//      yasak. Doğru çözüm: `variant=` prop kullan.
//
//   2) Snapshot informational: her variant'ın kullanım sayısı + total Badge
//      sayısı. Variant evrimi (örn. 9. variant eklenirse) izlenir.
//
//   3) Variant union güncel: badge.tsx cva çağrısında 8 named value korunur.

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

// Anti-pattern: <Badge> opening tag with className overriding color tokens.
// Raw tailwind color (red/yellow/green/blue) veya design token doğrudan
// (destructive/success-light/warning-light/info-light/secondary) — variant
// prop yerine className override.
const ANTI_PATTERN_REGEX =
  /<Badge\b[^>]*className=["'][^"']*(border-(?:red|yellow|green|blue)-|bg-(?:red|yellow|green|blue)-|border-destructive(?!\/)|bg-destructive(?!\/)|bg-warning-light|bg-success-light|bg-info-light|bg-secondary(?!\/)|border-secondary(?!\/))[^"']*["']/;

// Variant prop kullanımı (per variant sayım).
const VARIANT_REGEX = /<Badge\b[^>]*\bvariant=["'](\w+)["']/g;
// Variant'sız (default) Badge sayımı.
const ANY_BADGE_REGEX = /<Badge\b/g;

function countMatches(content: string, regex: RegExp): number {
  return (content.match(regex) || []).length;
}

describe("§C-4 Badge variant census + anti-pattern hard-fail (Sprint 19)", () => {
  it("Anti-pattern: raw color/token className override on Badge (hard fail = 0)", () => {
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
        : `Badge raw color/token className override. Use variant= instead:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Variant census snapshot (informational)", () => {
    const variantCounts = new Map<string, number>();
    let totalBadges = 0;
    let defaultBadges = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      const totalInFile = countMatches(content, ANY_BADGE_REGEX);
      totalBadges += totalInFile;
      let m: RegExpExecArray | null;
      VARIANT_REGEX.lastIndex = 0;
      let withVariant = 0;
      while ((m = VARIANT_REGEX.exec(content)) !== null) {
        const variant = m[1];
        variantCounts.set(variant, (variantCounts.get(variant) ?? 0) + 1);
        withVariant++;
      }
      defaultBadges += totalInFile - withVariant;
    }
    const sorted = [...variantCounts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `[badge-variant-census] total=${totalBadges} default=${defaultBadges}\n  ` +
        sorted.map(([v, n]) => `${v}=${n}`).join(", "),
    );
    expect(totalBadges).toBeGreaterThan(0);
  });

  it("Variant union has 8 named values (default + secondary + destructive + outline + success + warning + info + processing)", () => {
    const badgeSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/badge.tsx"), "utf8");
    expect(badgeSrc).toMatch(/cva\(/);
    expect(badgeSrc).toMatch(/default:\s*"/);
    expect(badgeSrc).toMatch(/secondary:\s*"/);
    expect(badgeSrc).toMatch(/destructive:\s*"/);
    expect(badgeSrc).toMatch(/outline:\s*"/);
    expect(badgeSrc).toMatch(/success:\s*"/);
    expect(badgeSrc).toMatch(/warning:\s*"/);
    expect(badgeSrc).toMatch(/info:\s*"/);
    expect(badgeSrc).toMatch(/processing:\s*"/);
  });
});
