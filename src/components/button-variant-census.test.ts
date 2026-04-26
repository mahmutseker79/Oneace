// Permanent guard — Sprint 20 (UX/UI audit Apr-25 §C-5 — yeni track).
//
// Button variant census + anti-pattern guard.
//
// Button primitive 7 named variant kullanır (default, destructive, success,
// outline, secondary, ghost, link). cva tabanlı. Sprint 20 census'u
// kalıcılaştırır:
//
//   1) Anti-pattern HARD FAIL: `<Button className="border-red-... | bg-red-... |
//      bg-destructive | bg-success | bg-secondary | bg-primary">` — raw className
//      renk/token bg override yasak. Doğru çözüm: `variant=` prop kullan.
//
//   2) Snapshot informational: her variant'ın kullanım sayısı + total Button
//      sayısı. Variant evrimi (örn. yeni "warning" variant eklenirse) izlenir.
//
//   3) Variant union güncel: button.tsx cva çağrısında 7 named value korunur.

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

// Anti-pattern: <Button> opening tag with className overriding color tokens.
// Raw tailwind color (red/yellow/green/blue) veya design token doğrudan
// (destructive/success/secondary/primary) — variant prop yerine className
// override. Negative lookahead `/` opacity-modified (`bg-primary/10` vb.)
// legitimate kullanımları muaf tutar.
const ANTI_PATTERN_REGEX =
  /<Button\b[^>]*className=["'][^"']*(border-(?:red|yellow|green|blue)-|bg-(?:red|yellow|green|blue)-|bg-destructive(?!\/|-)|bg-success(?!\/|-)|bg-secondary(?!\/|-)|bg-primary(?!\/|-)|border-destructive(?!\/|-))[^"']*["']/;

// Variant prop kullanımı (per variant sayım).
const VARIANT_REGEX = /<Button\b[^>]*\bvariant=["'](\w+)["']/g;
// Variant'sız (default) Button sayımı.
const ANY_BUTTON_REGEX = /<Button\b/g;

function countMatches(content: string, regex: RegExp): number {
  return (content.match(regex) || []).length;
}

describe("§C-5 Button variant census + anti-pattern hard-fail (Sprint 20)", () => {
  it("Anti-pattern: raw color/token className override on Button (hard fail = 0)", () => {
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
        : `Button raw color/token className override. Use variant= instead:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Variant census snapshot (informational)", () => {
    const variantCounts = new Map<string, number>();
    let totalButtons = 0;
    let defaultButtons = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      const totalInFile = countMatches(content, ANY_BUTTON_REGEX);
      totalButtons += totalInFile;
      let m: RegExpExecArray | null;
      VARIANT_REGEX.lastIndex = 0;
      let withVariant = 0;
      while ((m = VARIANT_REGEX.exec(content)) !== null) {
        const variant = m[1];
        variantCounts.set(variant, (variantCounts.get(variant) ?? 0) + 1);
        withVariant++;
      }
      defaultButtons += totalInFile - withVariant;
    }
    const sorted = [...variantCounts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `[button-variant-census] total=${totalButtons} default=${defaultButtons}\n  ` +
        sorted.map(([v, n]) => `${v}=${n}`).join(", "),
    );
    expect(totalButtons).toBeGreaterThan(0);
  });

  it("Variant union has 7 named values (default + destructive + success + outline + secondary + ghost + link)", () => {
    const buttonSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/button.tsx"), "utf8");
    expect(buttonSrc).toMatch(/cva\(/);
    expect(buttonSrc).toMatch(/default:\s*"/);
    expect(buttonSrc).toMatch(/destructive:\s*\n?\s*"/);
    expect(buttonSrc).toMatch(/success:\s*"/);
    expect(buttonSrc).toMatch(/outline:\s*"/);
    expect(buttonSrc).toMatch(/secondary:\s*"/);
    expect(buttonSrc).toMatch(/ghost:\s*"/);
    expect(buttonSrc).toMatch(/link:\s*"/);
  });
});
