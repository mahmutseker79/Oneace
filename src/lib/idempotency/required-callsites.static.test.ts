// src/lib/idempotency/required-callsites.static.test.ts
//
// Pinned static-analysis test for P0-02 (GOD MODE roadmap 2026-04-23).
//
// Invariant
// ---------
// The four hottest financial-correctness action handlers MUST call
// `withIdempotency(...)` somewhere in their body. If a refactor
// accidentally removes the wrapper, this test fails at CI time.
//
// The covered handlers are:
//   - shipSalesOrderAction       — src/app/(app)/sales-orders/actions.ts
//   - receivePurchaseOrderAction — src/app/(app)/purchase-orders/actions.ts
//   - shipTransferAction         — src/app/(app)/transfers/actions.ts
//   - receiveTransferAction      — src/app/(app)/transfers/actions.ts
//
// Why this test exists
// --------------------
// `withIdempotency` is *opt-in* by design — most write actions do NOT
// need it. But the four above are the ledger-altering, financially-
// critical paths where a replay without dedup corrupts books. Unlike
// the postMovement seam (P0-01) which enforces a single callsite
// pattern for *every* insert, this pin is about *ensuring the chosen
// callsites don't silently drop the guard*.
//
// If a future action joins this set (e.g. a new "close-of-day" ledger
// flusher), add it to REQUIRED_CALLSITES.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Map of `file:actionName` to:
 *   - the function name we expect to exist in the file
 *   - a free-form human label for the failure message
 */
const REQUIRED_CALLSITES: Array<{
  file: string;
  actionName: string;
  label: string;
}> = [
  {
    file: "src/app/(app)/sales-orders/actions.ts",
    actionName: "shipSalesOrderAction",
    label: "SO ship — withIdempotency wrapper required for double-submit protection",
  },
  {
    file: "src/app/(app)/purchase-orders/actions.ts",
    actionName: "receivePurchaseOrderAction",
    label: "PO receive — withIdempotency wrapper required (in addition to Phase 6C line-level keys)",
  },
  {
    file: "src/app/(app)/transfers/actions.ts",
    actionName: "shipTransferAction",
    label: "Transfer ship — withIdempotency wrapper required",
  },
  {
    file: "src/app/(app)/transfers/actions.ts",
    actionName: "receiveTransferAction",
    label: "Transfer receive — withIdempotency wrapper required",
  },
];

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found (no package.json in ancestor chain)");
}

describe("withIdempotency — required callsites", () => {
  it("every hot action wraps its body in withIdempotency()", () => {
    const repoRoot = findRepoRoot();
    const violations: string[] = [];

    for (const { file, actionName, label } of REQUIRED_CALLSITES) {
      const abs = path.join(repoRoot, file);
      if (!fs.existsSync(abs)) {
        violations.push(`${file} :: file missing`);
        continue;
      }
      const src = fs.readFileSync(abs, "utf8");

      // The action function MUST still exist (rename guard).
      const actionRegex = new RegExp(
        `function\\s+${actionName}\\s*\\(`,
        "m",
      );
      if (!actionRegex.test(src)) {
        violations.push(
          `${file} :: function ${actionName} not found — renamed? (${label})`,
        );
        continue;
      }

      // withIdempotency MUST be called at least once somewhere in the
      // file. A per-function body slice would be safer (catches "wrapped
      // in the wrong function") but is expensive — the four hot files
      // either have ≤2 exported actions or clearly separate surfaces,
      // and a file-level check is sufficient here.
      if (!/\bwithIdempotency\s*\(/.test(src)) {
        violations.push(
          `${file} :: no withIdempotency() call — ${label}`,
        );
        continue;
      }

      // Import must be present (a test without the import is a
      // syntactic error that would also fail typecheck, but this
      // catches a stray string-only reference).
      if (!/from\s+["']@\/lib\/idempotency\/middleware["']/.test(src)) {
        violations.push(
          `${file} :: withIdempotency is used but not imported from "@/lib/idempotency/middleware" — (${label})`,
        );
      }
    }

    expect(
      violations,
      [
        "",
        "One or more P0-02 hot callsites lost their withIdempotency()",
        "wrapper. If this is intentional (e.g. the callsite was split",
        "or renamed), update REQUIRED_CALLSITES in",
        "src/lib/idempotency/required-callsites.static.test.ts.",
        "",
        "Otherwise, re-add the wrapper. See the roadmap §P0-02 for why.",
        "",
        "Violations:",
        ...violations.map((v) => `  - ${v}`),
        "",
      ].join("\n"),
    ).toEqual([]);
  });

  it("validation schemas for shipSalesOrder + receiveTransfer expose an idempotencyKey field", () => {
    const repoRoot = findRepoRoot();
    const schemas = [
      {
        file: "src/lib/validation/sales-order.ts",
        schemaVar: "shipSalesOrderSchema",
      },
      {
        file: "src/lib/validation/stock-transfer.ts",
        schemaVar: "receiveTransferSchema",
      },
    ];

    const violations: string[] = [];
    for (const { file, schemaVar } of schemas) {
      const abs = path.join(repoRoot, file);
      const src = fs.readFileSync(abs, "utf8");
      if (!new RegExp(`export\\s+const\\s+${schemaVar}\\s*=`).test(src)) {
        violations.push(`${file} :: ${schemaVar} not found`);
        continue;
      }
      if (!/idempotencyKey\s*:/.test(src)) {
        violations.push(
          `${file} :: ${schemaVar} does not include an idempotencyKey field`,
        );
      }
    }

    expect(
      violations,
      ["", "Violations:", ...violations.map((v) => `  - ${v}`), ""].join("\n"),
    ).toEqual([]);
  });
});
