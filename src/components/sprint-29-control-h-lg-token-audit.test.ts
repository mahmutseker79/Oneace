// Permanent guard — Sprint 29 (Sprint 28 follow-up token audit).
//
// `--control-h-lg` CSS token sole-consumer pinned guard.
//
// Sprint 28'de Input + SelectTrigger primitive cva'sından `lg` size variant
// retire edildi (0 kullanım). Token (`--control-h-lg`) globals.css'te korundu
// çünkü Button.lg hâlâ aktif (10 surface). Bu sprint, Sprint 28 retire
// kararının token-level emniyetini doğrular:
//
//   1) `--control-h-lg` token globals.css'te tanımlı + 3rem değeri korunur.
//   2) `var(--control-h-lg)` consumer'ı src/components/ui/* içinde TEK:
//      yalnız button.tsx (Button.lg variant). Yeni bir primitive bu token'ı
//      tüketmeye başlarsa burada hard-fail ile yakalanır.
//   3) Lock-step gerçeği: --control-h-md (default) en az 3 primitive tüketicisi
//      (Input, SelectTrigger, Button) tarafından kullanılır. Sprint 1 PR #2
//      "44px touch target floor" garantisi.
//   4) Lock-step gerçeği: --control-h-sm en az 3 primitive tüketicisi (Input,
//      SelectTrigger, Button — sm variant) tarafından kullanılır. Sprint 26+27
//      filter-bar full sm migration sonrası lock-step şart.
//
// Bu test "tek primitive tüketicili token'ı izleyebildiğini" garanti eder; eğer
// gelecekte Button.lg de retire edilirse, --control-h-lg token'ı emekli edilebilir
// veya başka primitive'e geçirilebilir — bu test o zaman yenilenir.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const UI_DIR = resolve(REPO_ROOT, "src/components/ui");
const GLOBALS_PATH = resolve(REPO_ROOT, "src/app/globals.css");

// Primitive source'ları (test/stories hariç) topla
function listPrimitiveSources(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(UI_DIR)) {
    if (!entry.endsWith(".tsx")) continue;
    if (entry.endsWith(".test.tsx") || entry.endsWith(".stories.tsx")) continue;
    const full = join(UI_DIR, entry);
    const s = statSync(full);
    if (s.isFile()) out.push(full);
  }
  return out;
}

// Sadece `var(--control-h-X)` actual CSS expression match eder (comment-friendly)
function tokenConsumerCount(file: string, token: "sm" | "md" | "lg"): number {
  const src = readFileSync(file, "utf8");
  const regex = new RegExp(`var\\(--control-h-${token}\\)`, "g");
  return (src.match(regex) || []).length;
}

describe("Sprint 29 — --control-h-lg token sole-consumer audit", () => {
  it("Token tanımı: --control-h-lg = 3rem globals.css'te", () => {
    const globals = readFileSync(GLOBALS_PATH, "utf8");
    expect(globals).toMatch(/--control-h-lg:\s*3rem/);
  });

  it("Lock-step token tanımları: sm=2.25rem, md=2.75rem, lg=3rem (3 size)", () => {
    const globals = readFileSync(GLOBALS_PATH, "utf8");
    expect(globals).toMatch(/--control-h-sm:\s*2\.25rem/);
    expect(globals).toMatch(/--control-h-md:\s*2\.75rem/);
    expect(globals).toMatch(/--control-h-lg:\s*3rem/);
  });

  it("HARD GUARD: --control-h-lg primitive consumer = sadece button.tsx", () => {
    const consumers: string[] = [];
    for (const file of listPrimitiveSources()) {
      if (tokenConsumerCount(file, "lg") > 0) {
        consumers.push(file.replace(`${REPO_ROOT}/`, ""));
      }
    }
    // Tek izinli consumer
    expect(consumers).toEqual(["src/components/ui/button.tsx"]);
  });

  it("Button.lg variant cva'da var(--control-h-lg) tüketiyor (1 occurrence)", () => {
    const buttonFile = resolve(UI_DIR, "button.tsx");
    expect(tokenConsumerCount(buttonFile, "lg")).toBe(1);
  });

  it("Lock-step --control-h-md: Input + SelectTrigger + Button tüketiyor (>= 3 primitive)", () => {
    let consumers = 0;
    for (const file of listPrimitiveSources()) {
      if (tokenConsumerCount(file, "md") > 0) consumers++;
    }
    expect(consumers).toBeGreaterThanOrEqual(3);
  });

  it("Lock-step --control-h-sm: Input + SelectTrigger + Button tüketiyor (>= 3 primitive)", () => {
    let consumers = 0;
    for (const file of listPrimitiveSources()) {
      if (tokenConsumerCount(file, "sm") > 0) consumers++;
    }
    expect(consumers).toBeGreaterThanOrEqual(3);
  });

  it("Sprint 28 sonrası Input + SelectTrigger primitive'leri --control-h-lg tüketmiyor", () => {
    for (const fname of ["input.tsx", "select.tsx"]) {
      const file = resolve(UI_DIR, fname);
      expect(tokenConsumerCount(file, "lg"), `${fname} hâlâ var(--control-h-lg) tüketiyor`).toBe(0);
    }
  });
});
