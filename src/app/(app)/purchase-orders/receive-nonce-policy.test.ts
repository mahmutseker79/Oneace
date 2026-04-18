/**
 * P2-6 (audit v1.0 §5.13) — pin the fail-closed nonce policy for
 * `receivePurchaseOrderAction`.
 *
 * Pre-audit this code path logged "nonce missing" and continued,
 * which meant a replay-without-nonce could double-receive a PO.
 * These tests static-analyse the action source so a careless
 * refactor can't re-open the hole.
 *
 * We can't cheaply spin up the full action (it needs a DB session,
 * Prisma, i18n), so we assert on the shape of the source instead —
 * same trick used in `auth-rate-limit-policy.test.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ACTIONS_PATH = join(process.cwd(), "src/app/(app)/purchase-orders/actions.ts");
const source = readFileSync(ACTIONS_PATH, "utf8");

describe("receivePurchaseOrderAction nonce policy (§5.13)", () => {
  it("binds submissionNonce from parsed input", () => {
    expect(source).toMatch(/const\s+submissionNonce\s*=\s*input\.submissionNonce/);
  });

  it("rejects instead of logging when the nonce is missing", () => {
    // The failure branch MUST return a structured error, not fall
    // through. Locate the `if (!submissionNonce)` block and check
    // that it returns within its body.
    const match = source.match(/if\s*\(\s*!submissionNonce\s*\)\s*\{([\s\S]*?)\n\s{2}\}/);
    expect(match).not.toBeNull();
    const body = match?.[1] ?? "";
    expect(body).toMatch(/return\s*\{\s*ok:\s*false/);
  });

  it("does not silently degrade replay protection", () => {
    // Sanity: the old wording ("replay protection disabled") must
    // be gone — that's the exact text that let the audit slip past
    // code review.
    expect(source).not.toMatch(/replay protection disabled/i);
  });

  it("still logs the rejection for ops visibility", () => {
    // We fail-closed, but we also want a breadcrumb so a legit
    // client update that forgot to include the nonce surfaces in
    // logs instead of appearing as a mysterious 400-equivalent.
    expect(source).toMatch(/po\.receive\.nonce-missing/);
  });
});
