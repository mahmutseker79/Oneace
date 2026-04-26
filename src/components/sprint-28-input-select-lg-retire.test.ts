// Permanent guard — Sprint 28 (Sprint 27 follow-up).
//
// Input + SelectTrigger primitive `lg` size retire.
//
// Gerekçe:
//   - Sprint 22 §D-1 census: Input.size.lg = 0 kullanım (audit baseline).
//   - Sprint 27 sonrası SelectTrigger.size.lg = 0 kullanım (yeni primitive).
//   - Hero/landing surface'leri Button.lg kullanıyor (Button.lg = 10 instance).
//     Input + Select için lg ihtiyacı yok — primitive cva yüzeyi temizlendi.
//
// Kapsam:
//   - input.tsx cva size variants: { sm, default } (lg yok)
//   - select.tsx selectTriggerVariants size variants: { sm, default } (lg yok)
//   - --control-h-lg CSS token korunur (Button.lg hâlâ kullanıyor — touch-target.test.ts).

import { readFileSync, readdirSync, statSync } from "node:fs";
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

const INPUT_LG_REGEX = /<Input\b[^>]*\bsize=["']lg["']/g;
const SELECT_TRIGGER_LG_REGEX = /<SelectTrigger\b[^>]*\bsize=["']lg["']/g;

describe("Sprint 28 — Input + SelectTrigger lg size retire", () => {
  it("Input cva size union: lg variant kaldırıldı", () => {
    const inputSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/input.tsx"), "utf8");
    expect(inputSrc).toMatch(/sm:\s*"h-\[var\(--control-h-sm\)\]/);
    expect(inputSrc).toMatch(/default:\s*"h-\[var\(--control-h-md\)\]/);
    expect(inputSrc).not.toMatch(/lg:\s*"h-\[var\(--control-h-lg\)\]/);
    expect(inputSrc).not.toMatch(/var\(--control-h-lg\)/);
  });

  it("SelectTrigger cva size union: lg variant kaldırıldı", () => {
    const selectSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/select.tsx"), "utf8");
    expect(selectSrc).toMatch(/sm:\s*"h-\[var\(--control-h-sm\)\]/);
    expect(selectSrc).toMatch(/default:\s*"h-\[var\(--control-h-md\)\]/);
    expect(selectSrc).not.toMatch(/lg:\s*"h-\[var\(--control-h-lg\)\]/);
    expect(selectSrc).not.toMatch(/var\(--control-h-lg\)/);
  });

  it("--control-h-lg CSS token globals.css'te korunur (Button.lg kullanıyor)", () => {
    const globals = readFileSync(resolve(REPO_ROOT, "src/app/globals.css"), "utf8");
    expect(globals).toMatch(/--control-h-lg:\s*3rem/);
  });

  it("Button.lg hâlâ aktif — primitive variant kaldırılmadı", () => {
    const buttonSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/button.tsx"), "utf8");
    expect(buttonSrc).toMatch(/lg:\s*"h-\[var\(--control-h-lg\)\]/);
  });

  it("Hard guard: `<Input size=\"lg\">` repo genelinde 0 kullanım", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      if (INPUT_LG_REGEX.test(content)) {
        offenders.push(file.replace(`${REPO_ROOT}/`, ""));
      }
      INPUT_LG_REGEX.lastIndex = 0;
    }
    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `<Input size="lg"> kullanımı bulundu — Sprint 28'de retire edildi:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("Hard guard: `<SelectTrigger size=\"lg\">` repo genelinde 0 kullanım", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      if (SELECT_TRIGGER_LG_REGEX.test(content)) {
        offenders.push(file.replace(`${REPO_ROOT}/`, ""));
      }
      SELECT_TRIGGER_LG_REGEX.lastIndex = 0;
    }
    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `<SelectTrigger size="lg"> kullanımı bulundu — Sprint 28'de retire edildi:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
