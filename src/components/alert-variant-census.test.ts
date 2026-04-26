// Permanent guard — Sprint 21 (UX/UI audit Apr-25 §C-6 — yeni track).
//
// Alert variant census + anti-pattern guard.
//
// Alert primitive 5 named variant kullanır (default, destructive, success,
// warning, info). cva tabanlı. Sprint 21 census'u kalıcılaştırır:
//
//   1) Anti-pattern HARD FAIL: `<Alert className="bg-destructive-light |
//      bg-success-light | bg-warning-light | bg-info-light | border-destructive |
//      border-success | border-warning | border-info | bg-(red|yellow|green|blue)-... |
//      border-(red|yellow|green|blue)-...">` — raw className renk/token override
//      yasak. Doğru çözüm: `variant=` prop kullan.
//
//   2) Snapshot informational: her variant'ın kullanım sayısı + total Alert
//      sayısı. Variant evrimi izlenir.
//
//   3) Variant union güncel: alert.tsx cva çağrısında 5 named value korunur.

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

// Anti-pattern: <Alert> opening tag with className overriding color tokens.
// Raw tailwind color (red/yellow/green/blue) veya design token doğrudan
// (destructive-light / success-light / warning-light / info-light, ya da
// border-{token} pure) — variant prop yerine className override.
// Negative lookahead `(?!\/|-)`: opacity-modified ve compound (-foreground)
// legitimate kullanımları muaf tutar.
const ANTI_PATTERN_REGEX =
  /<Alert\b[^>]*className=["'][^"']*(border-(?:red|yellow|green|blue)-|bg-(?:red|yellow|green|blue)-|bg-destructive-light|bg-success-light|bg-warning-light|bg-info-light|border-destructive(?!\/|-)|border-success(?!\/|-)|border-warning(?!\/|-)|border-info(?!\/|-))[^"']*["']/;

// Variant prop kullanımı (per variant sayım).
const VARIANT_REGEX = /<Alert\b[^>]*\bvariant=["'](\w+)["']/g;
// Variant'sız (default) Alert sayımı.
const ANY_ALERT_REGEX = /<Alert\b/g;

function countMatches(content: string, regex: RegExp): number {
  return (content.match(regex) || []).length;
}

describe("§C-6 Alert variant census + anti-pattern hard-fail (Sprint 21)", () => {
  it("Anti-pattern: raw color/token className override on Alert (hard fail = 0)", () => {
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
        : `Alert raw color/token className override. Use variant= instead:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Variant census snapshot (informational)", () => {
    const variantCounts = new Map<string, number>();
    let totalAlerts = 0;
    let defaultAlerts = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      const totalInFile = countMatches(content, ANY_ALERT_REGEX);
      totalAlerts += totalInFile;
      let m: RegExpExecArray | null;
      VARIANT_REGEX.lastIndex = 0;
      let withVariant = 0;
      while ((m = VARIANT_REGEX.exec(content)) !== null) {
        const variant = m[1];
        variantCounts.set(variant, (variantCounts.get(variant) ?? 0) + 1);
        withVariant++;
      }
      defaultAlerts += totalInFile - withVariant;
    }
    const sorted = [...variantCounts.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line no-console
    console.log(
      `[alert-variant-census] total=${totalAlerts} default=${defaultAlerts}\n  ` +
        sorted.map(([v, n]) => `${v}=${n}`).join(", "),
    );
    expect(totalAlerts).toBeGreaterThan(0);
  });

  it("Variant union has 5 named values (default + destructive + success + warning + info)", () => {
    const alertSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/alert.tsx"), "utf8");
    expect(alertSrc).toMatch(/cva\(/);
    expect(alertSrc).toMatch(/default:\s*"/);
    expect(alertSrc).toMatch(/destructive:\s*\n?\s*"/);
    expect(alertSrc).toMatch(/success:\s*\n?\s*"/);
    expect(alertSrc).toMatch(/warning:\s*\n?\s*"/);
    expect(alertSrc).toMatch(/info:\s*"/);
  });
});
