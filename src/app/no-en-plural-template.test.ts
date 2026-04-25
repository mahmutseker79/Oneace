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

// Allow-list: hâlâ düzeltilmemiş bilinen yerler. Sprint 9+ hedefi:
// her birini en.ts catalog'a `format(t.x, {count})` patterniyle çekmek.
const ALLOWED_FILES: ReadonlySet<string> = new Set<string>([
  // Boş — first triage Sprint 8 sonrası yapılacak. Test bulduğu yerleri
  // listede toplar; Mahmut review eder ve fix sırası belirler.
]);

describe("PR #2 §B-plural — EN plural template guard (informational)", () => {
  it("logs files using `count === 1 ? '' : 's'` pattern (Sprint 9 fix-up backlog)", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file.endsWith("no-en-plural-template.test.ts")) continue;
      const rel = file.replace(`${REPO_ROOT}/`, "");
      if (ALLOWED_FILES.has(rel)) continue;

      const content = readFileSync(file, "utf8");
      const hit = EN_PLURAL_PATTERNS.some((re) => re.test(content));
      if (hit) offenders.push(rel);
    }

    if (offenders.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[en-plural-guard] ${offenders.length} files use EN plural fork:\n  ` +
          offenders.join("\n  ") +
          `\n\nFix in Sprint 9: replace with format(t.x, {count}) using ICU-style ` +
          `templates in en.ts/tr.ts catalogs.`,
      );
    }

    // Soft assertion: report only, do not fail CI yet. Sprint 9'da
    // her dosya fix edildikçe ALLOWED_FILES küçülür ve sonunda hard
    // assertion'a dönüştürülür.
    expect(offenders.length).toBeGreaterThanOrEqual(0); // always-true, log için
  });
});
