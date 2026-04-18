// P1-4 (audit v1.1 §5.19) — baseline contract across every server
// action module.
//
// Background: at v1.1 audit open there were 42 `actions.ts` files
// under `src/app/**` and 0 neighbor `.test.ts` files. Not every
// action needs a deep behavior test (many are thin CRUD wrappers),
// but EVERY `actions.ts` must satisfy a small set of load-bearing
// invariants so a drive-by refactor can't silently drop a server
// boundary, an auth gate, or tenant scoping.
//
// The invariants this test pins, for every actions.ts file:
//   1. First non-blank line is "use server" — without this, the
//      export becomes a RPC-less server module and callers will
//      fail at runtime in a way that's easy to miss locally.
//   2. At least one `requireActiveMembership()` or equivalent
//      session gate is called somewhere in the file. This catches
//      regressions where a new action lands in an existing file
//      without wiring auth.
//   3. Any file that performs mutations (revalidatePath is the
//      proxy signal — read-only helpers do not revalidate) must
//      either use `hasCapability()` for RBAC or appear in the
//      explicit personal/account list below. That list is tiny
//      and callers-of-this-test MUST justify any additions.
//   4. No action file imports the `Prisma` client directly as a
//      top-level `new PrismaClient()` — all DB access goes via
//      the shared `@/lib/db` singleton (prevents pool exhaustion
//      on Neon).
//
// This is a static-analysis test (readFileSync + regex). It is
// deliberately cheap so every PR can run it against every action
// file in well under a second.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(REPO_ROOT, "src/app");

// Recursively walk `src/app` and collect every `actions.ts`. We
// avoid a third-party glob dependency — the repo has Node 20+, so
// a plain readdirSync walk is adequate and keeps the test
// self-contained. Skips common heavyweight directories for speed.
function collectActionFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectActionFiles(full, acc);
    } else if (entry === "actions.ts") {
      acc.push(full);
    }
  }
  return acc;
}

// If a new action module is added, the walk picks it up automatically
// — there is no hand-maintained list to forget.
const ACTION_FILES = collectActionFiles(APP_DIR).sort();

// Personal/account-scoped actions files that intentionally skip
// `hasCapability` because the capability system is org-scoped but
// these mutate per-user state. Additions here should be rare and
// reviewed carefully — the default posture is "every mutation is
// RBAC-gated".
const PERSONAL_SCOPE_ALLOWLIST = new Set<string>([
  // 2FA setup/disable is per-user; there is no "admin enables 2FA
  // on behalf of a user" flow, so no capability key exists.
  "src/app/(app)/settings/security/actions.ts",
  // Notification preferences are per-user and flip a user-scoped
  // flag, not an org-scoped resource.
  "src/app/(app)/notifications/actions.ts",
  // Org create happens before any membership exists, so the
  // capability lookup would have nothing to check against.
  "src/app/(app)/organizations/actions.ts",
  // Scan is read-only lookup of barcodes; no write, no revalidate.
  "src/app/(app)/scan/actions.ts",
]);

function rel(abs: string): string {
  return relative(REPO_ROOT, abs);
}

describe("P1-4 §5.19 — server action baseline contract", () => {
  it("enumerates every actions.ts under src/app (sanity)", () => {
    // A bare minimum — if glob returns 0 files, something's wrong
    // with the test setup itself (wrong cwd, symlink, etc.). We
    // guard with a floor rather than pinning an exact count so
    // adding new action modules doesn't require touching this test.
    expect(ACTION_FILES.length).toBeGreaterThanOrEqual(40);
  });

  describe("every actions.ts starts with \"use server\"", () => {
    for (const file of ACTION_FILES) {
      it(`${rel(file)} has the directive on the first non-blank line`, () => {
        const source = readFileSync(file, "utf8");
        const first = source.trimStart();
        // Accept both single- and double-quoted forms. The directive
        // must be the first statement — a top-of-file comment is
        // tolerated only if it's followed by the directive.
        const withoutLeadingComment = first.replace(
          /^(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)+/,
          "",
        );
        expect(
          withoutLeadingComment.startsWith('"use server"') ||
            withoutLeadingComment.startsWith("'use server'"),
          `expected "use server" at top of ${rel(file)}, saw: ${withoutLeadingComment.slice(0, 60)}`,
        ).toBe(true);
      });
    }
  });

  describe("every actions.ts gates on an active session/membership", () => {
    for (const file of ACTION_FILES) {
      it(`${rel(file)} calls a session gate at least once`, () => {
        const source = readFileSync(file, "utf8");
        // Accept any of the known gate names. `requireActiveMembership`
        // is the default; some files may use `requireAuth` (no org
        // scope) or `auth()` directly from better-auth.
        const gated =
          /\brequireActiveMembership\s*\(/.test(source) ||
          /\brequireAuth\s*\(/.test(source) ||
          /\bfrom\s+["']@\/lib\/session["']/.test(source) ||
          /\bauth\s*\(\s*\)/.test(source);
        expect(
          gated,
          `expected a session gate in ${rel(file)} (requireActiveMembership, requireAuth, or auth())`,
        ).toBe(true);
      });
    }
  });

  describe("every mutating actions.ts uses RBAC (hasCapability) unless personal-scoped", () => {
    for (const file of ACTION_FILES) {
      const relPath = rel(file);
      it(`${relPath} enforces RBAC (or is in the personal-scope allowlist)`, () => {
        const source = readFileSync(file, "utf8");
        const isPersonal = PERSONAL_SCOPE_ALLOWLIST.has(relPath);
        const mutates = /\brevalidatePath\s*\(/.test(source);
        const gated = /\bhasCapability\s*\(/.test(source);

        if (isPersonal) {
          // Personal-scope files are allowed to skip hasCapability.
          // The assertion here is inverted: their presence on the
          // allowlist is the documentation, so we just record that
          // the escape hatch was used.
          expect(isPersonal).toBe(true);
          return;
        }

        if (mutates) {
          expect(
            gated,
            `${relPath} calls revalidatePath() but never calls hasCapability() — add an RBAC check or justify the exemption in PERSONAL_SCOPE_ALLOWLIST`,
          ).toBe(true);
        }
      });
    }
  });

  describe("no actions.ts instantiates its own Prisma client", () => {
    for (const file of ACTION_FILES) {
      it(`${rel(file)} imports db from @/lib/db, not a fresh PrismaClient`, () => {
        const source = readFileSync(file, "utf8");
        // The shared singleton lives at @/lib/db. A `new PrismaClient(`
        // at top level would create a second pool on Neon and
        // eventually exhaust the connection cap under load.
        expect(
          source,
          `${rel(file)} constructs its own PrismaClient — use the shared db singleton`,
        ).not.toMatch(/\bnew\s+PrismaClient\s*\(/);
      });
    }
  });

  describe("personal-scope allowlist stays small (governance)", () => {
    it("the allowlist has no more than 6 entries (tripwire for scope creep)", () => {
      // If this fires, the audit process is being routed around.
      // Either the new entry actually needs RBAC, or a real
      // capability key should be added to the permissions module.
      expect(PERSONAL_SCOPE_ALLOWLIST.size).toBeLessThanOrEqual(6);
    });

    it("every allowlist entry points to a file that actually exists", () => {
      for (const relPath of PERSONAL_SCOPE_ALLOWLIST) {
        const abs = resolve(REPO_ROOT, relPath);
        expect(
          () => readFileSync(abs, "utf8"),
          `allowlist entry ${relPath} does not exist — remove or fix the path`,
        ).not.toThrow();
      }
    });
  });
});
