// Permanent guard — Sprint 32 (confirm-password live-val).
//
// Closure manifest §6 follow-up to Sprint 30:
// confirm-password Input now surfaces mismatch via `state="error"`
// LIVE (on every keystroke), not gated on submit attempt. The
// sentence-level "Passwords do not match." copy still lives in the
// submit handler as defense-in-depth.
//
// Branch matrix the ternary MUST encode:
//
//   confirm.length === 0          → "default"   (no premature error)
//   confirm !== password          → "error"     (live mismatch)
//   confirm === password
//     AND password.length ≥ MIN   → "success"   (preserved from S30)
//   else (match but short)        → "default"   (length signal lives
//                                                on the new-password
//                                                field above — single
//                                                source of truth)
//
// HARD GUARDS:
//   - register-form: no error-ternary added (single password field,
//     no comparison to live-validate against)
//   - login-form: no state=success and no state=error ternary added
//     (current-password semantics — server is authoritative)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

const RESET_FORM = "src/app/(auth)/reset-password/reset-password-form.tsx";
const REGISTER_FORM = "src/app/(auth)/register/register-form.tsx";
const LOGIN_FORM = "src/app/(auth)/login/login-form.tsx";

function readFile(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

const ERROR_TERNARY = /<Input\b[\s\S]*?\bstate=\{[\s\S]*?"error"[\s\S]*?\}/g;
const SUCCESS_TERNARY = /<Input\b[\s\S]*?\bstate=\{[\s\S]*?"success"[\s\S]*?\}/g;
const SUCCESS_LITERAL = /<Input\b[^>]*\bstate=["']success["']/g;
const ERROR_LITERAL = /<Input\b[^>]*\bstate=["']error["']/g;

describe("Sprint 32 — confirm-password live-validation (state=error ternary)", () => {
  it("reset-password-form: confirm-password Input ternary contains an error branch", () => {
    const src = readFile(RESET_FORM);
    expect(src).toContain('id="confirm-password"');
    // The whole confirm Input block must include both "error" and "success"
    // branches. We anchor on the literal id and require both string tokens
    // appear inside the JSX element.
    const block = src.split('id="confirm-password"')[1] ?? "";
    // Generous window — the inline comment block is intentionally long
    // (decision matrix lives next to the code). Stop well before any
    // hypothetical follow-up Input element on the page.
    const window_ = block.slice(0, 1800);
    expect(window_).toMatch(/state=\{[\s\S]*?"error"[\s\S]*?\}/);
    expect(window_).toMatch(/state=\{[\s\S]*?"success"[\s\S]*?\}/);
  });

  it("reset-password-form: error branch is keyed on `confirm !== password` (live mismatch)", () => {
    const src = readFile(RESET_FORM);
    // The order matters: the mismatch test should come before the success
    // test inside the ternary — that's what makes the error LIVE rather
    // than submit-gated.
    expect(src).toMatch(
      /confirm\.length\s*===\s*0[\s\S]*?confirm\s*!==\s*password[\s\S]*?"error"[\s\S]*?"success"/,
    );
  });

  it("reset-password-form: empty confirm short-circuits to default (no premature error)", () => {
    const src = readFile(RESET_FORM);
    // The first branch of the ternary MUST guard on confirm.length === 0
    // → "default". Without this, the field flashes red on first keystroke.
    expect(src).toMatch(/confirm\.length\s*===\s*0[\s\S]{0,80}\?\s*"default"/);
  });

  it("reset-password-form: success branch from Sprint 30 preserved (regression guard)", () => {
    const src = readFile(RESET_FORM);
    expect(src).toMatch(
      /confirm\s*===\s*password[\s\S]*?password\.length\s*>=\s*MIN_PASSWORD_LENGTH[\s\S]*?"success"/,
    );
  });

  it("reset-password-form: submit-time mismatch sentence still wired (defense in depth)", () => {
    const src = readFile(RESET_FORM);
    // Live state=error is visual; the sentence-level error message
    // remains the screen-reader-announced authority on submit.
    expect(src).toContain('"Passwords do not match."');
    expect(src).toMatch(/if\s*\(\s*password\s*!==\s*confirm\s*\)/);
  });

  it("HARD GUARD: register-form does NOT add a state=error ternary", () => {
    // register has a single password field — no peer to compare against,
    // so no live mismatch state. Length policy already shown via S30 success.
    const src = readFile(REGISTER_FORM);
    expect(src).not.toMatch(ERROR_TERNARY);
    expect(src).not.toMatch(ERROR_LITERAL);
  });

  it("HARD GUARD: login-form has neither state=success nor state=error", () => {
    // Lock-step with Sprint 30: current-password semantics → server is
    // authoritative. No client-side state hint of any kind on this Input.
    const src = readFile(LOGIN_FORM);
    expect(src).not.toMatch(SUCCESS_LITERAL);
    expect(src).not.toMatch(SUCCESS_TERNARY);
    expect(src).not.toMatch(ERROR_LITERAL);
    expect(src).not.toMatch(ERROR_TERNARY);
  });

  it("Input cva still exposes the `error` state variant (Sprint 32 activation premise)", () => {
    const inputSrc = readFile("src/components/ui/input.tsx");
    expect(inputSrc).toMatch(/error:\s*"border-destructive/);
  });
});
