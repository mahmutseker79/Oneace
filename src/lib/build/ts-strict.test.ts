/**
 * P3-1 (audit v1.0 §5.17) — pin that `ignoreBuildErrors` is OFF.
 *
 * History: `next.config.ts` once shipped with
 *   typescript: { ignoreBuildErrors: true }
 * to ride over 212 Prisma-relation-type errors. Those errors
 * were fixed in rc9; the flag was removed; `tsc --noEmit` is
 * now expected to exit 0. If someone brings the flag back "just
 * to unblock a push", the build-time type safety the strict
 * tsconfig promises collapses silently — and the audit finding
 * regresses without anyone noticing. This test is that noise
 * alarm.
 *
 * Companion P0-4 (§5.4) bookkeeping — `stock_count.rollback_refused`
 * audit action must stay on the `AuditAction` union and the
 * English i18n action map. The rollback action writes that value,
 * and a bare render-label lookup (`auditLabel(action, t.audit.actions)`)
 * fails `tsc --noEmit` if the union and the map disagree. Pinning
 * it here means a drift shows up in CI before the next
 * `ignoreBuildErrors` temptation.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const NEXT_CONFIG_PATH = join(process.cwd(), "next.config.ts");
const AUDIT_PATH = join(process.cwd(), "src/lib/audit.ts");
const EN_MESSAGES_PATH = join(process.cwd(), "src/lib/i18n/messages/en.ts");

const nextConfig = readFileSync(NEXT_CONFIG_PATH, "utf8");
const audit = readFileSync(AUDIT_PATH, "utf8");
const enMessages = readFileSync(EN_MESSAGES_PATH, "utf8");

describe("next.config.ts type safety (§5.17)", () => {
  it("does not enable ignoreBuildErrors", () => {
    // Look for the dangerous literal anywhere in the file. A
    // comment mentioning the flag (e.g. a note about why it was
    // removed) is fine — it's the `: true` pairing we care about.
    expect(nextConfig).not.toMatch(/ignoreBuildErrors\s*:\s*true/);
  });

  it("does not contain a `typescript:` config block that could re-hide errors", () => {
    // Belt-and-suspenders: even a `typescript: { ... }` block
    // with `ignoreBuildErrors: false` today is one keystroke
    // from re-enabling. If someone needs to add one later, the
    // PR must update this test and justify the block.
    expect(nextConfig).not.toMatch(/typescript\s*:\s*\{/);
  });

  it("does not turn on typedRoutes skipping or similar escape hatches", () => {
    // There's no "skip type checking" setting as of Next 15,
    // but if one appears, pin it here.
    expect(nextConfig).not.toMatch(/skipLibCheck\s*:\s*true/);
  });
});

describe("stock_count.rollback_refused audit action wiring (§5.4)", () => {
  it("rollback_refused is a member of the AuditAction union", () => {
    expect(audit).toMatch(/"stock_count\.rollback_refused"/);
  });

  it("rollback_refused is labeled in the English action map", () => {
    // A missing label here is caught at `tsc --noEmit` time via
    // `Record<AuditAction, string>` exhaustiveness. This test
    // fails faster and with a clearer message.
    expect(enMessages).toMatch(/"stock_count\.rollback_refused"\s*:\s*"/);
  });
});
