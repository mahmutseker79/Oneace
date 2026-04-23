// src/lib/movements/integrations-must-use-webhook-helper.static.test.ts
//
// Pinned static-analysis test for P0-03 rc3.
//
// Invariant
// ---------
//   Any file under `src/lib/integrations/**` or
//   `src/app/api/integrations/**` that imports `postMovement`
//   directly MUST also import / use `postWebhookMovement` — OR be
//   on the explicit allowlist below.
//
// Why
// ---
// The postMovement seam accepts ANY caller. That's by design for UI-
// driven actions, which mint a per-form-mount UUID via
// generateMovementIdempotencyKey. Webhook-driven callers need a
// DIFFERENT key shape — deterministic derivation from
// (provider, deliveryId) — so that provider-side retries hit the
// unique constraint.
//
// Today NO integration file writes movements, so this test is
// vacuously green. The value is forward-proofing: the day someone
// wires a Shopify inventory_levels handler that produces a RECEIPT,
// this test fails until they route through postWebhookMovement.
//
// Allowlist
// ---------
// Empty today. Add an entry only with a code comment explaining why
// the caller cannot use the webhook helper (e.g. a reconciliation
// job that runs on a deterministic schedule rather than an external
// delivery id).

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOTS = ["src/lib/integrations", "src/app/api/integrations"];

const ALLOWED: ReadonlySet<string> = new Set<string>([
  // Intentionally empty. Add with a justification comment.
]);

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("integrations must use postWebhookMovement (P0-03 rc3)", () => {
  it("no integration file imports postMovement without postWebhookMovement", () => {
    const repoRoot = findRepoRoot();
    const violations: string[] = [];

    for (const rel of ROOTS) {
      const files = walk(path.join(repoRoot, rel));
      for (const abs of files) {
        const rel2 = path.relative(repoRoot, abs).split(path.sep).join("/");
        if (ALLOWED.has(rel2)) continue;
        const src = fs.readFileSync(abs, "utf8");

        // Does this file touch the movement seam at all?
        const importsPost =
          /from\s+["']@\/lib\/movements["']/.test(src) ||
          /from\s+["']@\/lib\/movements\/post["']/.test(src);
        if (!importsPost) continue;

        // Does the file mention `postMovement(` as a call (not a
        // comment string alone)?
        const callsPost = /\bpostMovement\s*\(/.test(src);
        if (!callsPost) continue;

        // If postMovement IS called, postWebhookMovement MUST also
        // be used OR the file explicitly allowlisted.
        const usesWebhookHelper = /\bpostWebhookMovement\s*\(/.test(src);
        if (!usesWebhookHelper) {
          violations.push(rel2);
        }
      }
    }

    expect(
      violations,
      [
        "",
        "Integration file calls postMovement directly without using",
        "postWebhookMovement. Webhook-driven ledger writes must derive",
        "a deterministic idempotency key from (provider, deliveryId)",
        "so that a provider-side retry lands on P2002 instead of",
        "double-booking.",
        "",
        "Either:",
        "  (a) switch to postWebhookMovement(tx, { provider, deliveryId, ... }), OR",
        "  (b) add the file to ALLOWED in",
        "      src/lib/movements/integrations-must-use-webhook-helper.static.test.ts",
        "      with a justification comment.",
        "",
        "Offending files:",
        ...violations.map((v) => `  - ${v}`),
        "",
      ].join("\n"),
    ).toEqual([]);
  });
});
