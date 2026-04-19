/**
 * Audit v1.3 §5.54 F-10 — 2FA recovery-code rotation UI + telemetry pin.
 *
 * What this pins
 * --------------
 * Before v1.5.28 `regenerateBackupCodesAction` existed server-side
 * but had no UI caller in `two-factor-card.tsx` — the compromise-
 * recovery path ("I lost my codes, let me rotate") was dead end
 * from the settings surface. The fix wires three distinct things:
 *
 *   1. A `regenerate` ViewMode with a TOTP input + one-time codes
 *      display, clearing state before leaving so the codes can't be
 *      re-read by navigating back.
 *   2. A rotation-advised banner + always-on CTA — the banner lights
 *      up after 365 days (ROTATION_ADVISED_AFTER_DAYS), but the
 *      button is always available so a user who knows their codes
 *      are compromised doesn't have to wait for the window.
 *   3. A PostHog `recovery_codes_rotated` event fired client-side on
 *      success, tagged with `source: "manual" | "advised"` so product
 *      can slice whether the banner actually drives the action.
 *
 * Static-analysis only (feedback_pinned_tests.md) — reads the source
 * text and asserts the wiring invariants. A runtime/JSDOM version
 * would duplicate what manual QA already does; the pin exists to
 * catch "someone deletes the track() call" / "someone moves the event
 * into PlannedAnalyticsEvents" regressions in CI.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const CARD_PATH = resolve(
  process.cwd(),
  "src/app/(app)/settings/security/two-factor-card.tsx",
);
const EVENTS_PATH = resolve(process.cwd(), "src/lib/analytics/events.ts");

function readCard(): string {
  return readFileSync(CARD_PATH, "utf8");
}

function readEvents(): string {
  return readFileSync(EVENTS_PATH, "utf8");
}

describe("§5.54 F-10 — RECOVERY_CODES_ROTATED taxonomy placement", () => {
  it("AnalyticsEvents exports RECOVERY_CODES_ROTATED with canonical value", async () => {
    // Runtime check — the constant value is the string PostHog
    // dashboards / retention queries filter on. String drift silently
    // breaks every saved funnel that references it.
    const mod = await import("@/lib/analytics/events");
    expect(mod.AnalyticsEvents).toHaveProperty(
      "RECOVERY_CODES_ROTATED",
      "recovery_codes_rotated",
    );
  });

  it("RECOVERY_CODES_ROTATED lives in the wired (not planned) block", () => {
    const text = readEvents();
    // Same source-position trick as the RATE_LIMIT_HIT pin: the
    // constant value being right isn't enough — it must also live
    // in `AnalyticsEvents` (wired) so the taxonomy statement
    // matches the call-site reality.
    const wiredIdx = text.indexOf("export const AnalyticsEvents");
    const plannedIdx = text.indexOf("export const PlannedAnalyticsEvents");
    const constIdx = text.indexOf("RECOVERY_CODES_ROTATED:");
    expect(wiredIdx, "AnalyticsEvents block exists").toBeGreaterThan(-1);
    expect(plannedIdx, "PlannedAnalyticsEvents block exists").toBeGreaterThan(-1);
    expect(constIdx, "RECOVERY_CODES_ROTATED constant exists").toBeGreaterThan(-1);
    expect(constIdx, "RECOVERY_CODES_ROTATED is in the wired block").toBeGreaterThan(
      wiredIdx,
    );
    expect(constIdx, "RECOVERY_CODES_ROTATED is NOT in the planned block").toBeLessThan(
      plannedIdx,
    );
  });
});

describe("§5.54 F-10 — two-factor-card.tsx imports + ViewMode", () => {
  it("imports track and AnalyticsEvents from instrumentation + events", () => {
    // Guard against someone removing the telemetry pipe via a lint
    // autofix or "unused imports" sweep. If these disappear the
    // event silently stops firing.
    const text = readCard();
    expect(text).toMatch(/from\s+["']@\/lib\/instrumentation["']/);
    expect(text).toMatch(/AnalyticsEvents[\s\S]*?from\s+["']@\/lib\/analytics\/events["']/);
    expect(text).toMatch(/\btrack\b/);
  });

  it("imports regenerateBackupCodesAction from ./actions", () => {
    // The whole flow hinges on this server action — ensure the UI
    // hasn't drifted from the action file.
    const text = readCard();
    expect(text).toMatch(/regenerateBackupCodesAction/);
    expect(text).toMatch(/from\s+["']\.\/actions["']/);
  });

  it("ViewMode includes 'regenerate' alongside status/setup/disable", () => {
    // Source-level pin so removing the view without removing its
    // callers fails loud rather than compiling to a dead branch.
    const text = readCard();
    expect(text).toMatch(/"status"\s*\|\s*"setup"\s*\|\s*"disable"\s*\|\s*"regenerate"/);
  });
});

describe("§5.54 F-10 — rotation advised constant + gate", () => {
  it("ROTATION_ADVISED_AFTER_DAYS named constant equals 365", () => {
    // The cadence is product-visible — a refactor that inlines the
    // number or changes it without updating docs should be caught
    // by this pin, not by a support ticket.
    const text = readCard();
    expect(text).toMatch(/const\s+ROTATION_ADVISED_AFTER_DAYS\s*=\s*365\b/);
  });

  it("isRotationAdvised uses the constant and guards on createdAt", () => {
    const text = readCard();
    expect(text).toMatch(/function\s+isRotationAdvised\s*\(\s*\)\s*:\s*boolean/);
    // Null-guard first so the skeleton render doesn't flash the
    // banner before the server response comes back.
    expect(text).toMatch(/if\s*\(!createdAt\)\s*return\s+false/);
    expect(text).toMatch(/ageDays\s*>=\s*ROTATION_ADVISED_AFTER_DAYS/);
  });

  it("createdAt state is populated from getTwoFactorStatusAction", () => {
    const text = readCard();
    // The setCreatedAt call is what drives the advised banner — if
    // it falls out of the mount effect the banner never renders.
    expect(text).toMatch(/setCreatedAt\s*\(\s*status\.createdAt/);
  });
});

describe("§5.54 F-10 — handleRegenerate wiring + telemetry", () => {
  it("handleRegenerate calls regenerateBackupCodesAction with the TOTP code", () => {
    const text = readCard();
    expect(text).toMatch(/async\s+function\s+handleRegenerate\s*\(/);
    expect(text).toMatch(/await\s+regenerateBackupCodesAction\s*\(\s*regenerateCode\s*\)/);
  });

  it("captures source before the async call so intent reflects click-time state", () => {
    // Bug we want to avoid: computing `source` AFTER the await,
    // when setCreatedAt has already cleared the advised window —
    // every rotation would then be logged as "manual" even when
    // the user clicked the banner. The pin locks the capture to
    // happen before startTransition.
    const text = readCard();
    const handlerStart = text.indexOf("async function handleRegenerate");
    expect(handlerStart, "handler exists").toBeGreaterThan(-1);
    const handlerEnd = text.indexOf(
      "async function handleDisable",
      handlerStart,
    );
    expect(handlerEnd, "handler body bounded").toBeGreaterThan(handlerStart);
    const body = text.slice(handlerStart, handlerEnd);

    const sourceIdx = body.indexOf(
      'const source: "advised" | "manual" = isRotationAdvised()',
    );
    const startTransitionIdx = body.indexOf("startTransition");
    expect(sourceIdx, "source captured").toBeGreaterThan(-1);
    expect(startTransitionIdx, "startTransition called").toBeGreaterThan(-1);
    expect(sourceIdx, "source captured BEFORE startTransition").toBeLessThan(
      startTransitionIdx,
    );
  });

  it("fires RECOVERY_CODES_ROTATED with codesIssued + source payload", () => {
    const text = readCard();
    // Full payload pin — missing `source` silently collapses the
    // advised-vs-manual slice; missing `codesIssued` collapses the
    // "are we rolling 10 codes or something else?" breakdown.
    expect(text).toMatch(
      /track\s*\(\s*AnalyticsEvents\.RECOVERY_CODES_ROTATED\s*,\s*\{/,
    );
    const trackIdx = text.indexOf("AnalyticsEvents.RECOVERY_CODES_ROTATED");
    expect(trackIdx).toBeGreaterThan(-1);
    const payloadSlice = text.slice(trackIdx, trackIdx + 300);
    expect(payloadSlice).toMatch(/codesIssued:\s*result\.length/);
    expect(payloadSlice).toMatch(/source,/);
  });

  it("track() fires AFTER the server action confirms success (no failed-verify inflation)", () => {
    // Order invariant: if track() runs before awaiting the action
    // result (or in the catch branch), failed verifies inflate the
    // rotation counter. Pin the order.
    const text = readCard();
    const awaitIdx = text.indexOf("await regenerateBackupCodesAction");
    const trackIdx = text.indexOf("track(AnalyticsEvents.RECOVERY_CODES_ROTATED");
    expect(awaitIdx).toBeGreaterThan(-1);
    expect(trackIdx).toBeGreaterThan(awaitIdx);
  });

  it("early-return on null result prevents track() from firing on failed verify", () => {
    // Explicit pin for the "if (!result) return" short-circuit
    // that must sit BETWEEN the await and the track() call. If a
    // future refactor removes the short-circuit, failed TOTP codes
    // would fire the success event.
    const text = readCard();
    const awaitIdx = text.indexOf("await regenerateBackupCodesAction");
    const trackIdx = text.indexOf("track(AnalyticsEvents.RECOVERY_CODES_ROTATED");
    const slice = text.slice(awaitIdx, trackIdx);
    expect(slice).toMatch(/if\s*\(!result\)\s*\{[\s\S]*?return/);
  });
});

describe("§5.54 F-10 — status view banner + CTA", () => {
  it("renders rotation-advised banner gated on isEnabled && isRotationAdvised()", () => {
    const text = readCard();
    // Find the banner marker and confirm its render gate — a
    // banner that renders unconditionally would nag day-one users,
    // a banner that renders without isEnabled would nag users who
    // disabled 2FA.
    const bannerIdx = text.indexOf('data-testid="rotation-advised-banner"');
    expect(bannerIdx, "banner rendered with testid").toBeGreaterThan(-1);
    // Look backwards ~200 chars for the gate condition — must
    // reference both flags.
    const gateSlice = text.slice(Math.max(0, bannerIdx - 200), bannerIdx);
    expect(gateSlice).toMatch(/isEnabled\s*&&\s*isRotationAdvised\(\)/);
  });

  it("renders 'Regenerate backup codes' CTA whenever 2FA is enabled", () => {
    // The button must be always-on (not gated on the banner) so
    // compromised-code rotation doesn't have to wait for the 365-
    // day window. Pin: the data-testid exists somewhere in the
    // isEnabled branch of the status view.
    const text = readCard();
    expect(text).toMatch(/data-testid="regenerate-backup-codes-button"/);
  });

  it("CTA onClick switches ViewMode to 'regenerate' and clears alerts", () => {
    const text = readCard();
    const btnIdx = text.indexOf('data-testid="regenerate-backup-codes-button"');
    expect(btnIdx).toBeGreaterThan(-1);
    // Grab the next ~300 chars — the onClick lambda is right below.
    const btnSlice = text.slice(btnIdx, btnIdx + 300);
    expect(btnSlice).toMatch(/setViewMode\s*\(\s*["']regenerate["']\s*\)/);
    expect(btnSlice).toMatch(/setError\s*\(\s*null\s*\)/);
    expect(btnSlice).toMatch(/setSuccess\s*\(\s*null\s*\)/);
  });
});

describe("§5.54 F-10 — one-time code display hygiene", () => {
  it("Done button clears newRecoveryCodes before leaving the regenerate view", () => {
    // If the codes live in state after navigation, back/forward or
    // a stale component remount could re-display them. Pin: the
    // Done handler sets newRecoveryCodes to null BEFORE switching
    // view mode.
    const text = readCard();
    // Find the "Done" button's onClick within the regenerate view
    const doneBtnIdx = text.indexOf("Done — I've saved these codes");
    expect(doneBtnIdx, "Done button present").toBeGreaterThan(-1);
    // Look backwards for the onClick body.
    const slice = text.slice(Math.max(0, doneBtnIdx - 400), doneBtnIdx);
    expect(slice).toMatch(/setNewRecoveryCodes\s*\(\s*null\s*\)/);
    // And the null-set must precede the view switch in source order.
    const clearIdx = slice.indexOf("setNewRecoveryCodes(null)");
    const switchIdx = slice.indexOf('setViewMode("status")');
    expect(clearIdx, "clear exists").toBeGreaterThan(-1);
    expect(switchIdx, "switch exists").toBeGreaterThan(-1);
    expect(clearIdx, "clear before switch").toBeLessThan(switchIdx);
  });

  it("regenerate view splits on newRecoveryCodes !== null (not a new ViewMode)", () => {
    // Design choice pin: the one-time codes render by branching on
    // state, NOT by pushing a new ViewMode value. A new ViewMode
    // would let the user re-enter the "codes" route from history
    // and re-read them. If this pin trips, the refactor probably
    // introduced that regression.
    const text = readCard();
    // The regenerate branch MUST start with `newRecoveryCodes ?`
    // ternary before the TOTP-input fallback.
    expect(text).toMatch(/\{newRecoveryCodes\s*\?/);
  });
});

describe("§5.54 F-10 — never-surfaced view-leak check", () => {
  it("never uses a 'view-codes' or similar new ViewMode string (branch-by-state only)", () => {
    // Paranoid guard: if someone adds a ViewMode like "view-codes"
    // or "show-recovery" to render the codes on a separate route,
    // the back-button re-read regression is possible. Pin that no
    // such view exists.
    const text = readCard();
    expect(text).not.toMatch(/"view-codes"/);
    expect(text).not.toMatch(/"show-recovery"/);
    expect(text).not.toMatch(/"codes"/);
  });
});
