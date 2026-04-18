// v1.2 P2 §5.39 — Admin session revocation pin.
//
// The audit flagged the total absence of a session-revocation surface:
// no UI, no API, no way for a user to end an old device. The fix lands:
//
//   - GET  /api/account/sessions                 (list)
//   - POST /api/account/sessions/[id]/revoke     (one)
//   - POST /api/account/sessions/revoke-all      (everything else)
//   - /settings/security/sessions                (page)
//
// This is a static-analysis test. We do NOT hit Prisma, Better-Auth,
// or the network — we read source and pin the invariants:
//
//   1. Every route file carries an `@openapi-tag` matching the one
//      declared in docs/openapi.yaml (§5.32 parity rule).
//   2. Every route goes through `requireSession` — not
//      `requireActiveMembership`. A stolen-laptop user with zero
//      memberships must still be able to revoke.
//   3. Every route is rate-limited. The budgets picked during the fix
//      are pinned so a later tweak is deliberate.
//   4. The single-revoke route self-guards (current session id) and
//      scopes deletion by userId.
//   5. The revoke-all route excludes the current session via a NOT
//      filter.
//   6. The page + client pair exists and the client talks to all
//      three endpoints.
//   7. The security index page links to `/settings/security/sessions`
//      so the UI is discoverable.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

function readFile(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const LIST_ROUTE = "src/app/api/account/sessions/route.ts";
const REVOKE_ROUTE = "src/app/api/account/sessions/[id]/revoke/route.ts";
const REVOKE_ALL_ROUTE = "src/app/api/account/sessions/revoke-all/route.ts";
const PAGE = "src/app/(app)/settings/security/sessions/page.tsx";
const CLIENT = "src/app/(app)/settings/security/sessions/sessions-client.tsx";
const SECURITY_INDEX = "src/app/(app)/settings/security/page.tsx";
const OPENAPI = "docs/openapi.yaml";

// ──────────────────────────────────────────────────────────────────
// 1. Route shape + openapi-tag (§5.32 parity)
// ──────────────────────────────────────────────────────────────────

describe("§5.39 — every session route carries the right @openapi-tag", () => {
  it(`${LIST_ROUTE} tags /account/sessions`, () => {
    expect(readFile(LIST_ROUTE)).toMatch(/@openapi-tag:\s*\/account\/sessions\b/);
  });

  it(`${REVOKE_ROUTE} tags /account/sessions/{id}/revoke`, () => {
    expect(readFile(REVOKE_ROUTE)).toMatch(/@openapi-tag:\s*\/account\/sessions\/\{id\}\/revoke\b/);
  });

  it(`${REVOKE_ALL_ROUTE} tags /account/sessions/revoke-all`, () => {
    expect(readFile(REVOKE_ALL_ROUTE)).toMatch(/@openapi-tag:\s*\/account\/sessions\/revoke-all\b/);
  });

  it("docs/openapi.yaml declares all three paths", () => {
    const openapi = readFile(OPENAPI);
    expect(openapi).toMatch(/^\s*\/account\/sessions:/m);
    expect(openapi).toMatch(/^\s*\/account\/sessions\/\{id\}\/revoke:/m);
    expect(openapi).toMatch(/^\s*\/account\/sessions\/revoke-all:/m);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. Auth guard — requireSession, not requireActiveMembership
// ──────────────────────────────────────────────────────────────────

describe("§5.39 — routes guard with requireSession (stolen-laptop path)", () => {
  // Picking `requireActiveMembership` would lock out a user whose
  // only membership was deactivated — exactly the user who most
  // needs to revoke a stale session. Pin the narrower guard.
  for (const rel of [LIST_ROUTE, REVOKE_ROUTE, REVOKE_ALL_ROUTE]) {
    it(`${rel} imports and calls requireSession`, () => {
      const src = readFile(rel);
      expect(src, `${rel} must import requireSession from @/lib/session`).toMatch(
        /import\s*\{[^}]*\brequireSession\b[^}]*\}\s*from\s*["']@\/lib\/session["']/,
      );
      expect(src).toMatch(/await\s+requireSession\s*\(/);
      // Match the call site (trailing `(`) so the docstring that
      // explains *why* we avoid `requireActiveMembership` doesn't
      // false-positive this guard.
      expect(
        src,
        `${rel} must NOT call requireActiveMembership — membershipless users must be able to revoke`,
      ).not.toMatch(/requireActiveMembership\s*\(/);
    });
  }
});

// ──────────────────────────────────────────────────────────────────
// 3. Rate-limit budgets — pinned so tweaks are deliberate
// ──────────────────────────────────────────────────────────────────

describe("§5.39 — rate-limit budgets are pinned", () => {
  it("list: 30 / minute per user", () => {
    const src = readFile(LIST_ROUTE);
    expect(src).toMatch(/account:sessions:list:/);
    expect(src).toMatch(/max:\s*30/);
    expect(src).toMatch(/windowSeconds:\s*60/);
  });

  it("revoke-one: 10 / minute per user", () => {
    const src = readFile(REVOKE_ROUTE);
    expect(src).toMatch(/account:sessions:revoke:/);
    expect(src).toMatch(/max:\s*10/);
    expect(src).toMatch(/windowSeconds:\s*60/);
  });

  it("revoke-all: 5 / hour per user", () => {
    const src = readFile(REVOKE_ALL_ROUTE);
    expect(src).toMatch(/account:sessions:revoke-all:/);
    expect(src).toMatch(/max:\s*5/);
    expect(src).toMatch(/windowSeconds:\s*3600/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 4/5. Revoke-one / revoke-all safety semantics
// ──────────────────────────────────────────────────────────────────

describe("§5.39 — revoke-one semantics", () => {
  const src = readFile(REVOKE_ROUTE);

  it("refuses self-revoke with a CURRENT_SESSION code", () => {
    // The UI relies on the code to render the current row as
    // disabled. Rename-proofing: pin the literal.
    expect(src).toMatch(/id\s*===\s*currentSessionId/);
    expect(src).toContain("CURRENT_SESSION");
  });

  it("scopes delete by { id, userId }", () => {
    // Without the userId filter a crafted request could delete a
    // session belonging to another user. The scoping is the whole
    // ownership check; the 404 mapping depends on count===0.
    expect(src).toMatch(
      /db\.session\.deleteMany\s*\(\s*\{\s*where:\s*\{\s*id,\s*userId\s*\}\s*,?\s*\}/,
    );
  });

  it("returns 404 when no row was deleted (never 403)", () => {
    // 404 vs 403 is a probe-resistance choice — 403 would confirm
    // the id exists but belongs to someone else.
    expect(src).toMatch(/result\.count\s*===\s*0/);
    expect(src).toMatch(/status:\s*404/);
  });
});

describe("§5.39 — revoke-all semantics", () => {
  const src = readFile(REVOKE_ALL_ROUTE);

  it("excludes the current session via a NOT filter", () => {
    expect(src).toMatch(
      /db\.session\.deleteMany\s*\(\s*\{\s*where:\s*\{\s*userId,\s*NOT:\s*\{\s*id:\s*currentSessionId\s*\}\s*\}\s*,?\s*\}/,
    );
  });

  it("reports keptSessionId so the UI can render the survivor", () => {
    expect(src).toContain("keptSessionId");
  });
});

// ──────────────────────────────────────────────────────────────────
// 6. Page + client pair — client calls all three endpoints
// ──────────────────────────────────────────────────────────────────

describe("§5.39 — sessions page + client", () => {
  const page = readFile(PAGE);
  const client = readFile(CLIENT);

  it("page uses requireSession (no org requirement)", () => {
    expect(page).toMatch(/requireSession/);
    expect(page).not.toMatch(/requireActiveMembership/);
  });

  it("page imports SessionsClient", () => {
    expect(page).toMatch(/import\s*\{\s*SessionsClient\s*\}/);
  });

  it("client is marked 'use client'", () => {
    expect(client.startsWith('"use client"') || client.startsWith("'use client'")).toBe(true);
  });

  it("client talks to /api/account/sessions/[id]/revoke", () => {
    // Template literal with encodeURIComponent(id) is the shape we
    // pin. Catches a naive `${id}` regression that leaves the path
    // vulnerable to a slash-injection edge case.
    expect(client).toMatch(/\/api\/account\/sessions\/\$\{encodeURIComponent\(id\)\}\/revoke/);
  });

  it("client talks to /api/account/sessions/revoke-all", () => {
    expect(client).toContain("/api/account/sessions/revoke-all");
  });

  it("client marks the current session with a 'This device' affordance", () => {
    // Tiny UX pin — without this the user cannot tell which row is
    // theirs and might revoke it.
    expect(client).toContain("This device");
  });
});

// ──────────────────────────────────────────────────────────────────
// 7. Discoverability — /settings/security links to the new page
// ──────────────────────────────────────────────────────────────────

describe("§5.39 — security index surfaces the sessions page", () => {
  const src = readFile(SECURITY_INDEX);

  it("links to /settings/security/sessions", () => {
    expect(src).toMatch(/href=["']\/settings\/security\/sessions["']/);
  });
});
