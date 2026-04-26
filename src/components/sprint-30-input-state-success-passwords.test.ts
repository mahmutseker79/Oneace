// Permanent guard — Sprint 30 (Sprint 22 §D-1 + Sprint 28+29 follow-up).
//
// Input.state.success activation in auth password forms.
//
// Sprint 22 §D-1 census başlangıcında Input.state.success = 0 instance
// (cva'da var, kullanan yok). Sprint 28+29 "lg" track'ini retire + token
// audit ile kapattıktan sonra geriye **state.success** kaldı. Sprint 30
// retire yerine **activation** seçti çünkü doğal bir use-case mevcut:
// "yeni şifre policy'i karşıladı" sinyalini görsel olarak göstermek.
//
// Aktive edilen surface'ler:
//   1. register-form.tsx — password Input (length >= 8 → success)
//   2. reset-password-form.tsx — new-password Input (length >= MIN → success)
//   3. reset-password-form.tsx — confirm-password Input (length >= MIN
//      AND match → success)
//
// Login form HARİÇ — autoComplete="current-password" semantiği "kullanıcı
// kendi mevcut şifresini giriyor"dur, doğruluğu sunucu validate eder, success
// state false-positive sinyal verir.
//
// Pinned guard:
//   1. register-form: <Input ... state={...success...} /> ifadesi mevcut + length kontrolü
//   2. reset-password-form: yeni şifre Input state expr'i length-bazlı
//   3. reset-password-form: confirm Input state expr'i match-bazlı
//   4. login-form: yanlışlıkla state="success" eklenmemiş (false-positive guard)
//   5. Repo cumulative: Input state="success" en az 3 surface kullanıyor

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

// Hem `state="success"` (literal) hem `state={... ? "success" : ...}` (ternary) yakalar.
const SUCCESS_LITERAL = /<Input\b[^>]*\bstate=["']success["']/g;
const SUCCESS_TERNARY = /<Input\b[\s\S]*?\bstate=\{[^}]*"success"[^}]*\}/g;

const REGISTER_FORM = "src/app/(auth)/register/register-form.tsx";
const RESET_FORM = "src/app/(auth)/reset-password/reset-password-form.tsx";
const LOGIN_FORM = "src/app/(auth)/login/login-form.tsx";

function readFile(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("Sprint 30 — Input.state.success activation in auth password forms", () => {
  it("register-form: password Input has state=success ternary based on length >= 8", () => {
    const src = readFile(REGISTER_FORM);
    // Password input id="password" + state expression + length check
    expect(src).toContain('id="password"');
    expect(src).toMatch(/state=\{[^}]*password\.length\s*>=\s*8[^}]*"success"[^}]*\}/);
  });

  it("reset-password-form: new-password Input has state=success ternary based on length >= MIN", () => {
    const src = readFile(RESET_FORM);
    expect(src).toContain('id="new-password"');
    // password.length >= MIN_PASSWORD_LENGTH → "success"
    expect(src).toMatch(
      /state=\{[^}]*password\.length\s*>=\s*MIN_PASSWORD_LENGTH[^}]*"success"[^}]*\}/,
    );
  });

  it("reset-password-form: confirm-password Input has state=success only when match + length valid", () => {
    const src = readFile(RESET_FORM);
    expect(src).toContain('id="confirm-password"');
    // confirm length >= MIN AND confirm === password → "success"
    expect(src).toMatch(
      /state=\{[\s\S]*?confirm\.length\s*>=\s*MIN_PASSWORD_LENGTH[\s\S]*?confirm\s*===\s*password[\s\S]*?"success"[\s\S]*?\}/,
    );
  });

  it("HARD GUARD: login-form does NOT set state=success (current-password semantiği)", () => {
    const src = readFile(LOGIN_FORM);
    // Hiçbir Input'ta state=success ifadesi olmamalı
    expect(src).not.toMatch(SUCCESS_LITERAL);
    expect(src).not.toMatch(SUCCESS_TERNARY);
  });

  it("Cumulative: Input state=success kullanan surface sayısı >= 3 (register + reset×2)", () => {
    let totalOccurrences = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      totalOccurrences += (content.match(SUCCESS_LITERAL) || []).length;
      totalOccurrences += (content.match(SUCCESS_TERNARY) || []).length;
    }
    expect(totalOccurrences).toBeGreaterThanOrEqual(3);
  });

  it("Input cva'da success state hâlâ tanımlı (Sprint 30 activation premise)", () => {
    const inputSrc = readFile("src/components/ui/input.tsx");
    expect(inputSrc).toMatch(/success:\s*"border-success/);
  });
});
