// Permanent guard — Sprint 32 (Sprint 30 follow-up).
//
// Confirm-password live-validation error ternary aktivasyonu.
//
// Sprint 30'da reset-password-form confirm Input'u şu mantıkla aktive edildi:
//   - confirm.length >= MIN AND confirm === password  → success
//   - aksi durum (mismatch dahil)                     → default
//
// Risk: kullanıcı yeterli uzunlukta yazıp mismatch yaparsa, submit denemeden
// önce hiçbir görsel feedback yoktu (yalnız submit sonrası {error} block
// görünüyordu). Sprint 32 bu risk maddesini kapatır:
//   - length < MIN                          → default (henüz yazılıyor)
//   - length >= MIN AND match               → success
//   - length >= MIN AND mismatch            → error (LIVE-VALIDATION)
//
// Pinned guard:
//   1) confirm Input state ternary 3-way: length<MIN → default, match → success, mismatch → error
//   2) Cumulative: repo'da Input state=error ternary kullanım sayısı >= 1
//   3) MIN_PASSWORD_LENGTH sabit korunur (8)
//   4) Submit-time error pattern (`setError("Passwords do not match.")`) hâlâ var (live-val
//      submit error'i ezmiyor — backend hata response'u için lazım)
//   5) Input cva'da error state hâlâ "border-destructive" (activation premise)

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

const RESET_FORM = "src/app/(auth)/reset-password/reset-password-form.tsx";
const ERROR_TERNARY = /<Input\b[\s\S]*?\bstate=\{[\s\S]*?["']error["'][\s\S]*?\}/g;

function readFile(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("Sprint 32 — confirm-password live-validation error ternary", () => {
  it("confirm Input: 3-way ternary — length<MIN → default", () => {
    const src = readFile(RESET_FORM);
    expect(src).toContain('id="confirm-password"');
    // Üst seviye: length<MIN durumu default'a düşmeli
    expect(src).toMatch(/confirm\.length\s*<\s*MIN_PASSWORD_LENGTH[\s\S]*?["']default["']/);
  });

  it("confirm Input: match durumunda success", () => {
    const src = readFile(RESET_FORM);
    expect(src).toMatch(/confirm\s*===\s*password[\s\S]*?["']success["']/);
  });

  it("confirm Input: mismatch durumunda error (LIVE-VALIDATION ana hedef)", () => {
    const src = readFile(RESET_FORM);
    // 3-way ternary'nin son dalı "error" literal'i taşımalı
    expect(src).toMatch(
      /confirm\.length\s*<\s*MIN_PASSWORD_LENGTH[\s\S]*?["']default["'][\s\S]*?["']success["'][\s\S]*?["']error["']/,
    );
  });

  it("Submit-time error pattern hâlâ mevcut (backend hatası için lazım)", () => {
    const src = readFile(RESET_FORM);
    expect(src).toContain('setError("Passwords do not match.")');
  });

  it("Cumulative: repo'da en az 1 Input state=error ternary kullanımı var", () => {
    let count = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      count += (content.match(ERROR_TERNARY) || []).length;
    }
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("MIN_PASSWORD_LENGTH = 8 sabit korunur", () => {
    const src = readFile(RESET_FORM);
    expect(src).toMatch(/const MIN_PASSWORD_LENGTH = 8/);
  });

  it("Input cva'da error state premise korunur (border-destructive)", () => {
    const inputSrc = readFile("src/components/ui/input.tsx");
    expect(inputSrc).toMatch(/error:\s*"border-destructive/);
  });
});
