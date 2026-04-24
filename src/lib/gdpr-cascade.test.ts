// Audit v1.2 §5.35 — GDPR user-delete cascade policy pin.
//
// Problem at v1.1 close: the account-delete route (POST /api/account/delete)
// relied on Prisma's `onDelete` policies to cascade cleanup across every
// row that references `User`. Nobody had actually enumerated those
// relations and decided, per-relation, whether Cascade / SetNull / Restrict
// was the right policy for GDPR. A new model with a silent default FK
// policy could leave orphan rows behind that still point at the deleted
// user — the "silent orphan" scenario the audit flagged.
//
// This test pins the complete cascade matrix. It parses
// `prisma/schema.prisma`, extracts every relation whose target type is
// `User`, and asserts its `onDelete` policy matches
// `EXPECTED_USER_RELATIONS` below. Adding a new User FK to the schema,
// or changing the `onDelete` on an existing one, fails this test until
// the expected map is updated (and in the process forces a conscious
// GDPR review). See `docs/gdpr-cascade-matrix.md` for rationale per row.
//
// `POLICY_CONCERNS` separately pins known-risky policies that the route
// has NOT fully remediated yet. Today that's `CountApproval.requestedById`
// with `Restrict` — a pending approval request will make `user.delete()`
// throw a Prisma constraint error. Keeping it in POLICY_CONCERNS means
// a future maintainer who "fixes" it by swapping to SetNull has to
// update this test on purpose (and therefore re-read the fix-risk note
// in the audit doc before doing so).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(__dirname, "..", "..", "prisma", "schema.prisma");

type OnDeletePolicy = "Cascade" | "SetNull" | "Restrict" | "NoAction";

// Key format: `<ModelName>.<fkFieldName>` — so `Membership.userId`, not
// the relation-field name (`Membership.user`). FK field names are
// globally unique within a model and stable across schema edits.
const EXPECTED_USER_RELATIONS: Readonly<Record<string, OnDeletePolicy>> = {
  // --- Cascade (8) — credential + personal rows with no retention value ---
  "Membership.userId": "Cascade",
  "Invitation.invitedById": "Cascade",
  "Session.userId": "Cascade",
  "Account.userId": "Cascade",
  "Notification.userId": "Cascade",
  "TwoFactorAuth.userId": "Cascade",
  "CountAssignment.userId": "Cascade",
  "SavedView.userId": "Cascade",

  // --- SetNull (18) — business-history rows; actor anonymised on delete ---
  "Invitation.acceptedById": "SetNull",
  "StockMovement.createdByUserId": "SetNull",
  "StockCount.createdByUserId": "SetNull",
  "CountEntry.countedByUserId": "SetNull",
  "PurchaseOrder.createdByUserId": "SetNull",
  "AuditEvent.actorId": "SetNull",
  "Department.managerId": "SetNull",
  "CountApproval.reviewedById": "SetNull",
  "ImportJob.createdByUserId": "SetNull",
  "SerialHistory.performedByUserId": "SetNull",
  "ItemAttachment.uploadedByUserId": "SetNull",
  "StockTransfer.shippedByUserId": "SetNull",
  "StockTransfer.receivedByUserId": "SetNull",
  "PickTask.assignedToUserId": "SetNull",
  "FixedAsset.assignedToUserId": "SetNull",
  "CountZone.createdByUserId": "SetNull",
  "ZoneLabel.printedByUserId": "SetNull",
  "MigrationJob.createdByUserId": "SetNull",
  // P0-04 (GOD MODE 2026-04-23) — landed-cost audit row actor. SetNull so
  // a user-delete doesn't erase the cost-allocation history, just
  // anonymizes the actor. Matches the StockMovement.createdByUserId
  // precedent for audit-trail rows.
  "LandedCostAllocation.appliedByUserId": "SetNull",

  // --- Restrict (1) — KNOWN POLICY CONCERN, see POLICY_CONCERNS ---
  "CountApproval.requestedById": "Restrict",
} as const;

// Policies we know are imperfect — the matrix doc at
// docs/gdpr-cascade-matrix.md explains each one and the deferred
// remediation options. Listed here so the test passes green but a
// reader sees "yes, this is known-broken; don't 'fix' it without
// reading the linked rationale".
const POLICY_CONCERNS: ReadonlyArray<{
  relation: string;
  currentPolicy: OnDeletePolicy;
  concern: string;
}> = [
  {
    relation: "CountApproval.requestedById",
    currentPolicy: "Restrict",
    concern:
      "user.delete() will FAIL if the user has any CountApproval rows as the requester. " +
      "Remediation deferred to product/legal (see docs/gdpr-cascade-matrix.md). Either (a) switch to SetNull, " +
      "(b) cascade-delete / reassign pending approvals inside the delete route, or " +
      "(c) keep Restrict but add a UI 'close out your approvals' affordance before account delete.",
  },
];

function parseSchema(source: string): Record<string, OnDeletePolicy> {
  const found: Record<string, OnDeletePolicy> = {};

  // Split into `model <Name> { ... }` blocks. Keeps the parser trivial
  // and avoids pulling in @prisma/internals just to read the schema.
  const modelRegex = /\bmodel\s+(\w+)\s*\{([\s\S]*?)\n\}/g;

  // Use a read-first loop to keep the assignment out of the `while`
  // condition (satisfies biome's noAssignInExpressions and clarifies
  // the control flow). `exec` with the /g flag advances `lastIndex`
  // internally, so calling it in sequence walks every match.
  let modelMatch: RegExpExecArray | null = modelRegex.exec(source);
  while (modelMatch !== null) {
    const [, modelName, body] = modelMatch;

    // For each line in the model body, if it's a relation targeting User
    // with an `@relation(...fields: [...], onDelete: X)`, pull the FK
    // field name out of `fields: [xId]` and the policy out of `onDelete`.
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      // Must reference User type (possibly optional with `?`).
      // Example: `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`
      // Also optional: `actor User? @relation(fields: [actorId], ...)`
      if (!/\bUser\??\s+@relation\b/.test(line)) continue;

      const fieldsMatch = line.match(/fields:\s*\[([^\]]+)\]/);
      const onDeleteMatch = line.match(/onDelete:\s*(Cascade|SetNull|Restrict|NoAction)\b/);

      if (!fieldsMatch || !onDeleteMatch) continue;

      // `fields: [userId]` — split to support multi-column FK though we
      // don't currently use that in any User relation.
      const fkFields = fieldsMatch[1].split(",").map((s) => s.trim());
      for (const fkField of fkFields) {
        const key = `${modelName}.${fkField}`;
        found[key] = onDeleteMatch[1] as OnDeletePolicy;
      }
    }
    // Advance the stateful regex to the next model block. Without this,
    // the loop would spin on the first match forever.
    modelMatch = modelRegex.exec(source);
  }

  return found;
}

describe("GDPR user-delete cascade matrix (audit v1.2 §5.35)", () => {
  const source = readFileSync(SCHEMA_PATH, "utf8");
  const actual = parseSchema(source);

  it("parser is sane — found at least one User relation", () => {
    // Smoke test: if this is 0 the parser broke (regex drift, schema
    // layout change) and all subsequent assertions would be bogus.
    expect(Object.keys(actual).length).toBeGreaterThan(0);
  });

  it("every User FK in schema.prisma has an expected policy in EXPECTED_USER_RELATIONS", () => {
    const unexpected = Object.keys(actual).filter((k) => !(k in EXPECTED_USER_RELATIONS));
    expect(
      unexpected,
      `schema.prisma has User FK relations that are not in EXPECTED_USER_RELATIONS. Adding a new User FK is a GDPR decision: decide Cascade vs SetNull vs Restrict, update docs/gdpr-cascade-matrix.md with the rationale, then add the relation here. Unexpected: ${JSON.stringify(unexpected)}`,
    ).toEqual([]);
  });

  it("every entry in EXPECTED_USER_RELATIONS still exists in schema.prisma", () => {
    const missing = Object.keys(EXPECTED_USER_RELATIONS).filter((k) => !(k in actual));
    expect(
      missing,
      `EXPECTED_USER_RELATIONS lists relations that no longer exist in schema.prisma. Either the relation was renamed/removed (update this list AND the matrix doc) or the parser missed it (investigate the schema diff). Missing: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });

  it("onDelete policy for every known User FK matches the expected policy", () => {
    const drift: Array<{ relation: string; expected: OnDeletePolicy; actual: OnDeletePolicy }> = [];
    for (const [rel, expectedPolicy] of Object.entries(EXPECTED_USER_RELATIONS)) {
      const actualPolicy = actual[rel];
      if (!actualPolicy) continue; // covered by the "still exists" test
      if (actualPolicy !== expectedPolicy) {
        drift.push({ relation: rel, expected: expectedPolicy, actual: actualPolicy });
      }
    }
    expect(
      drift,
      `onDelete policies have drifted from the pinned matrix. For each drift: if the new policy is intentional, update EXPECTED_USER_RELATIONS + docs/gdpr-cascade-matrix.md (and consider whether the account-delete route at src/app/api/account/delete/route.ts needs updating). Drift: ${JSON.stringify(drift, null, 2)}`,
    ).toEqual([]);
  });

  it("known POLICY_CONCERNS entries still have the recorded policy (no silent 'fix')", () => {
    for (const concern of POLICY_CONCERNS) {
      const policy = actual[concern.relation];
      expect(
        policy,
        `POLICY_CONCERNS references ${concern.relation} but it no longer exists in schema.prisma — either remove from POLICY_CONCERNS or restore the relation.`,
      ).toBeDefined();
      expect(
        policy,
        `${concern.relation} used to be ${concern.currentPolicy} (a documented policy concern). It is now ${policy}. If this was a deliberate fix, remove it from POLICY_CONCERNS and update docs/gdpr-cascade-matrix.md + the account-delete route accordingly. Concern: ${concern.concern}`,
      ).toBe(concern.currentPolicy);
    }
  });

  describe("headline counts — defends the matrix-doc summary from silent drift", () => {
    it("Cascade count = 8", () => {
      const count = Object.values(EXPECTED_USER_RELATIONS).filter((p) => p === "Cascade").length;
      expect(count).toBe(8);
    });
    it("SetNull count = 18", () => {
      const count = Object.values(EXPECTED_USER_RELATIONS).filter((p) => p === "SetNull").length;
      expect(count).toBe(18);
    });
    it("Restrict count = 1", () => {
      const count = Object.values(EXPECTED_USER_RELATIONS).filter((p) => p === "Restrict").length;
      expect(count).toBe(1);
    });
    it("NoAction count = 0 (Prisma's silent default is a GDPR footgun)", () => {
      // NoAction lets Postgres reject the delete at FK-check time, but
      // unlike Restrict it can defer to transaction-commit, producing
      // surprising error sites. We never want to pick up NoAction by
      // accident — the matrix explicitly chose Cascade / SetNull /
      // Restrict for every relation.
      const count = Object.values(EXPECTED_USER_RELATIONS).filter((p) => p === "NoAction").length;
      expect(count).toBe(0);
    });
    it("total User FK relations = 27", () => {
      expect(Object.keys(EXPECTED_USER_RELATIONS).length).toBe(27);
    });
  });

  describe("account-delete route still manually cleans the audit-critical cascades", () => {
    // Even though these are Cascade at the DB level, the route deletes
    // them *inside* the transaction BEFORE `user.delete()` for two
    // reasons: (1) audit-event ordering — `recordAudit()` fires before
    // the transaction and references `membership.id`, so the manual
    // deleteMany guarantees the row is gone by the time the user row
    // drops regardless of DB-engine cascade batching; (2) explicit
    // rather than implicit — the route reads straightforwardly without
    // requiring a reader to know Prisma's cascade semantics. See
    // docs/gdpr-cascade-matrix.md §"Fields the account-delete route
    // still deleteManys manually".
    it("src/app/api/account/delete/route.ts still deleteManys membership/session/account/twoFactorAuth", () => {
      const source = readFileSync(
        resolve(__dirname, "..", "app", "api", "account", "delete", "route.ts"),
        "utf8",
      );
      for (const model of ["membership", "session", "account", "twoFactorAuth"]) {
        expect(
          source,
          `delete route must manually deleteMany on ${model} before user.delete() — audit-event ordering + explicit-over-implicit (see matrix doc).`,
        ).toMatch(new RegExp(`\\.${model}\\.deleteMany\\s*\\(`));
      }
    });
  });
});
