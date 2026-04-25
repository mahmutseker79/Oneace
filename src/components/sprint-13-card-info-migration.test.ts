// Sprint 13 PR #1 — Card info variant migration + guard widening
// (UX/UI audit Apr-25 §C-3 follow-up).
//
// Sprint 12 PR #3 Card primitive'ine `info` variant eklemişti. Bu PR:
// 1. Mevcut tek `<Card className="bg-info-light border-info">` kullanımını
//    `<Card variant="info">` ile değiştirir (reports/serial-traceability).
// 2. Hard-fail guard'ı genişletir: artık `border-info` / `bg-info-light`
//    raw className de yasak (severity guard'ın 5. variant'ı).
//
// Kapsam tartışması: form-section div'leri (örn. inventory/status-change)
// intentional olarak Card değil rounded-lg div. Migration kapsamı dışında.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC = resolve(REPO_ROOT, "src");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

// Sprint 11 guard'ı + info patterns. Yalnızca <Card ...> wrapper'ında ara.
const FORBIDDEN_CARD_INFO_CLASSNAME =
  /<Card[^>]*className="[^"]*\b(?:border-info|bg-info-light|bg-info\/\d+)\b[^"]*"/;

const ALLOWED_FILES: ReadonlySet<string> = new Set<string>([
  "src/components/ui/card.tsx",
  "src/components/ui/card.stories.tsx",
  "src/components/sprint-11-card-variant-guard.test.ts",
  "src/components/sprint-10-card-variants.test.ts",
  "src/components/sprint-13-card-info-migration.test.ts",
]);

describe("Sprint 13 PR #1 §C-3 — Card info variant migration", () => {
  describe("reports/serial-traceability migration", () => {
    const path = "src/app/(app)/reports/serial-traceability/page.tsx";
    const src = readFileSync(resolve(REPO_ROOT, path), "utf8");

    it("uses variant=\"info\" instead of inline className", () => {
      expect(src).toContain('<Card variant="info">');
      expect(src).not.toContain('<Card className="bg-info-light border-info">');
    });
  });

  describe("hard-fail guard widening (info variant)", () => {
    it("no <Card> uses raw info-style className — must use variant=\"info\"", () => {
      const offenders: string[] = [];
      for (const file of walk(SRC)) {
        const rel = file.replace(`${REPO_ROOT}/`, "");
        if (ALLOWED_FILES.has(rel)) continue;
        const content = readFileSync(file, "utf8");
        if (FORBIDDEN_CARD_INFO_CLASSNAME.test(content)) {
          offenders.push(rel);
        }
      }
      expect(
        offenders,
        `Raw <Card> info className tespit edildi. Sprint 13'ten sonra ` +
          `\`variant="info"\` ile yapılmalı.\n\nOffenders:\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    });
  });
});
