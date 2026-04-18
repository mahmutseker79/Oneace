// P1-2 remediation test (audit v1.0 §5.7) — pins that migration
// rollback is suspended for v1.
//
// Background: the rollback engine in
// `src/lib/migrations/core/rollback.ts` only handles `createdIds`,
// not the `updatedIds` from upserts. Calling it on a real migration
// would partially revert state and leave the org in a worse condition
// than no rollback at all. Until snapshot-based rollback ships, we
// refuse all calls at the action and API boundaries.
//
// We deliberately do not import the action or route modules — they
// pull in Next.js server APIs (`next/headers`, `next/server`, the
// generated Prisma client) that don't exist in the Vitest jsdom
// environment. Source-level pinning catches regressions in the
// policy without coupling to the runtime.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ACTIONS_PATH = resolve(__dirname, "actions.ts");
const ERRORS_PATH = resolve(__dirname, "rollback-errors.ts");
const ROUTE_PATH = resolve(__dirname, "../../api/migrations/[id]/rollback/route.ts");
const NEW_PAGE_PATH = resolve(__dirname, "new/page.tsx");

const ACTIONS_SOURCE = readFileSync(ACTIONS_PATH, "utf8");
const ERRORS_SOURCE = readFileSync(ERRORS_PATH, "utf8");
const ROUTE_SOURCE = readFileSync(ROUTE_PATH, "utf8");
const NEW_PAGE_SOURCE = readFileSync(NEW_PAGE_PATH, "utf8");

describe("P1-2 — rollbackMigrationAction (server action)", () => {
  it("does not import the rollbackMigration engine (active import is gone)", () => {
    // The engine import must be removed (or commented out). A
    // *commented* import is fine — it documents intent — but no
    // active `import { rollbackMigration }` line may exist.
    const lines = ACTIONS_SOURCE.split("\n");
    const activeImport = lines.find((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
      return /import\s*\{\s*rollbackMigration\s*\}/.test(line);
    });
    expect(activeImport, "engine import must not be active").toBeUndefined();
  });

  it("imports the NOT_IMPLEMENTED error class from the sibling module", () => {
    // Next.js 15's `"use server"` compiler rejects non-async exports,
    // so the class itself lives in `rollback-errors.ts`. `actions.ts`
    // must import it rather than re-declaring it here.
    expect(ACTIONS_SOURCE).toMatch(
      /import\s*\{\s*MigrationRollbackNotImplementedError\s*\}\s*from\s*["']\.\/rollback-errors["']/,
    );
    expect(ACTIONS_SOURCE).not.toMatch(/class\s+MigrationRollbackNotImplementedError/);
  });

  it("rollback-errors.ts defines the class with a stable NOT_IMPLEMENTED code", () => {
    expect(ERRORS_SOURCE).toMatch(/class\s+MigrationRollbackNotImplementedError/);
    expect(ERRORS_SOURCE).toMatch(/code\s*=\s*["']NOT_IMPLEMENTED["']/);
    // The errors module MUST NOT carry a top-of-file `"use server"`
    // directive — co-locating the class with the action is exactly
    // what broke the Vercel build. Anchor to start-of-line via the
    // multiline flag so a `"use server"` inside a comment (like this
    // one) doesn't false-trip.
    expect(ERRORS_SOURCE).not.toMatch(/^\s*["']use server["']\s*;?\s*$/m);
  });

  it("rollbackMigrationAction throws the NOT_IMPLEMENTED error", () => {
    // Find the action body and check it throws the dedicated error.
    // rollbackMigrationAction is the last export in actions.ts, so we
    // grab from its declaration through the end of file.
    const actionMatch = ACTIONS_SOURCE.match(
      /export\s+async\s+function\s+rollbackMigrationAction[\s\S]+$/,
    );
    expect(actionMatch, "action body must be present").not.toBeNull();
    const body = actionMatch?.[0] ?? "";
    expect(body).toMatch(/throw\s+new\s+MigrationRollbackNotImplementedError\s*\(\s*\)/);
  });

  it("does not invoke the rollbackMigration engine inside the action", () => {
    // rollbackMigrationAction is the last export in actions.ts, so we
    // grab from its declaration through the end of file.
    const actionMatch = ACTIONS_SOURCE.match(
      /export\s+async\s+function\s+rollbackMigrationAction[\s\S]+$/,
    );
    expect(actionMatch).not.toBeNull();
    const body = actionMatch?.[0] ?? "";
    expect(body).not.toMatch(/rollbackMigration\s*\(/);
  });

  it("still enforces auth + capability + ownership before refusing (no information leak)", () => {
    // rollbackMigrationAction is the last export in actions.ts, so we
    // grab from its declaration through the end of file.
    const actionMatch = ACTIONS_SOURCE.match(
      /export\s+async\s+function\s+rollbackMigrationAction[\s\S]+$/,
    );
    expect(actionMatch).not.toBeNull();
    const body = actionMatch?.[0] ?? "";

    const sessionIdx = body.indexOf("requireActiveMembership");
    const capIdx = body.indexOf("hasCapability");
    const ownerIdx = body.indexOf('throw new Error("Access denied")');
    const throwIdx = body.indexOf("MigrationRollbackNotImplementedError");

    expect(sessionIdx).toBeGreaterThan(0);
    expect(capIdx).toBeGreaterThan(sessionIdx);
    expect(ownerIdx).toBeGreaterThan(capIdx);
    expect(throwIdx).toBeGreaterThan(ownerIdx);
  });

  it("records a migration.rollback_refused audit row before throwing", () => {
    expect(ACTIONS_SOURCE).toMatch(/action:\s*["']migration\.rollback_refused["']/);
    const auditIdx = ACTIONS_SOURCE.indexOf("migration.rollback_refused");
    const throwIdx = ACTIONS_SOURCE.indexOf("MigrationRollbackNotImplementedError()");
    // The audit must be recorded before the throw — once the action
    // throws there's no chance to write.
    expect(auditIdx).toBeGreaterThan(0);
    expect(throwIdx).toBeGreaterThan(auditIdx);
  });
});

describe("P1-2 — POST /api/migrations/[id]/rollback (HTTP endpoint)", () => {
  it("does not import the rollbackMigration engine (active import is gone)", () => {
    const lines = ROUTE_SOURCE.split("\n");
    const activeImport = lines.find((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
      return /import\s*\{\s*rollbackMigration\s*\}/.test(line);
    });
    expect(activeImport).toBeUndefined();
  });

  it("returns 501 with code: NOT_IMPLEMENTED for the success path", () => {
    // The terminal response (after auth + ownership checks pass)
    // must be 501 + a NOT_IMPLEMENTED code. We pin both halves.
    expect(ROUTE_SOURCE).toMatch(/status:\s*501/);
    expect(ROUTE_SOURCE).toMatch(/code:\s*["']NOT_IMPLEMENTED["']/);
  });

  it("does not invoke the rollbackMigration engine in the handler", () => {
    // The engine call should be entirely absent from the route. A
    // commented-out reference is acceptable; an active call is not.
    const lines = ROUTE_SOURCE.split("\n");
    const activeCall = lines.find((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
      return /\brollbackMigration\s*\(/.test(line);
    });
    expect(activeCall).toBeUndefined();
  });

  it("still verifies ownership before refusing (404 path preserved)", () => {
    // The ownership check ("Organization mismatch" → 404) must still
    // exist so unauthorized callers can't probe job ids. The 501
    // refusal must come *after* the ownership check, not before.
    expect(ROUTE_SOURCE).toMatch(/Organization mismatch/);
    const ownershipIdx = ROUTE_SOURCE.indexOf("Organization mismatch");
    const statusIdx = ROUTE_SOURCE.indexOf("status: 501");
    expect(ownershipIdx).toBeGreaterThan(0);
    expect(statusIdx).toBeGreaterThan(ownershipIdx);
  });

  it("records a migration.rollback_refused audit row before refusing", () => {
    expect(ROUTE_SOURCE).toMatch(/action:\s*["']migration\.rollback_refused["']/);
    const auditIdx = ROUTE_SOURCE.indexOf("migration.rollback_refused");
    const statusIdx = ROUTE_SOURCE.indexOf("status: 501");
    expect(auditIdx).toBeGreaterThan(0);
    expect(statusIdx).toBeGreaterThan(auditIdx);
  });
});

describe("P1-2 — UI no longer promises rollback", () => {
  it("removes the misleading 'İstediğiniz zaman rollback yapabilirsiniz' line", () => {
    expect(NEW_PAGE_SOURCE).not.toMatch(/İstediğiniz zaman rollback yapabilirsiniz/);
  });

  it("communicates that v1 migrations are one-way", () => {
    // The replacement text must mention either "tek yönlü" (one-way)
    // or "destek" (support) so users know the new policy.
    expect(NEW_PAGE_SOURCE).toMatch(/(tek yönlü|tek yönlüdür|destek ekibiyle)/);
  });
});
