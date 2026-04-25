// Sprint 8 PR #2 — TR plural rule audit / English plural template guard
// (UX/UI audit Apr-25 follow-up).
//
// Sprint 7 ile TR coverage 100%'e çıktı, ancak sayfa kodlarında hala
// İngilizce plural template'ler kalmış olabilir:
//   `${count} item${count === 1 ? '' : 's'}`
//   `${count} sale${count === 1 ? '' : 's'}`
// Bu pattern TR'de yanlıştır:
//   1. TR'de plural form yok — "1 ürün" / "2 ürün" (her ikisi tekil-form).
//   2. EN plural ekini TR'ye uygulamak garip cümleler üretir
//      ("12 ürün(s)" gibi).
//
// Yapılacak doğru: ICU MessageFormat kullanımı veya en.ts'in catalog'una
// koyup `format(t.x, {count})` ile parametrize.
//
// Bu test mevcut sayfa kodunda EN plural template'i yakalamaya yarar.
// İlk run: bulduğu yerleri logla — Sprint 8 sonrası fix-up'lar Sprint
// 9'a kalır. Allow-list ile kademeli düzeltme stratejisi.

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
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      yield full;
    }
  }
}

// Pattern: `count === 1 ? "" : "s"` veya `count === 1 ? "" : "es"` veya
// `count === 1 ? "y" : "ies"`. Common EN plural-fork patterns.
const EN_PLURAL_PATTERNS: readonly RegExp[] = [
  /===\s*1\s*\?\s*["']\s*["']\s*:\s*["']s["']/,
  /===\s*1\s*\?\s*["']\s*["']\s*:\s*["']es["']/,
  /===\s*1\s*\?\s*["']y["']\s*:\s*["']ies["']/,
  /!==\s*1\s*\?\s*["']s["']\s*:\s*["']\s*["']/,
];

// Allow-list: yasal EN plural fork barındıran yerler. Sprint 9 PR #3 ile
// app/ ağacındaki 6 offender `pluralizeEn`/`pluralWordEn` helper'ına çekildi.
// Aşağıdakiler bilerek tutuluyor:
//   - src/lib/i18n/messages/en.ts: EN-only catalog. Plural fork EN olduğu için doğru.
//   - src/lib/i18n/plural.ts: Pattern'i comment'te tanıtıyor (helper dosyası).
const ALLOWED_FILES: ReadonlySet<string> = new Set<string>([
  "src/lib/i18n/messages/en.ts",
  "src/lib/i18n/plural.ts",
]);

describe("PR #3 §B-plural — EN plural template guard (Sprint 9: hard fail)", () => {
  it("no app/library files use inline `count === 1 ? '' : 's'` pattern", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file.endsWith("no-en-plural-template.test.ts")) continue;
      const rel = file.replace(`${REPO_ROOT}/`, "");
      if (ALLOWED_FILES.has(rel)) continue;

      const content = readFileSync(file, "utf8");
      const hit = EN_PLURAL_PATTERNS.some((re) => re.test(content));
      if (hit) offenders.push(rel);
    }

    expect(
      offenders,
      `Inline EN plural fork tespit edildi (Sprint 9: hard fail).\n` +
        `Bunları \`pluralizeEn(count, "item")\` veya \`pluralWordEn(count, "item")\` ` +
        `helper'larıyla değiştir (src/lib/i18n/plural.ts).\n\n` +
        `Offenders:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
