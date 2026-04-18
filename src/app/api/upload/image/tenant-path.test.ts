/**
 * P1-8 (audit v1.0 §5.14) — pin the tenant-scoped upload contract.
 *
 * Static analysis of the route source. The POST handler MUST:
 *   1. Pull `membership` out of `requireActiveMembership` so it can
 *      read the active org id.
 *   2. Validate the org id against `ORG_ID_PATTERN` before using it
 *      as a filesystem path segment (path traversal defence).
 *   3. Use the validated id as a directory under `UPLOAD_ROOT`.
 *   4. Include the org id in the returned URL so downstream code can
 *      tenancy-check attachments.
 *
 * A live integration test would need a DB and session fixture; these
 * cheap contract checks pair with `attachment.test.ts` (which covers
 * the validator) to catch accidental regression of the shape.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROUTE_PATH = join(process.cwd(), "src/app/api/upload/image/route.ts");
const source = readFileSync(ROUTE_PATH, "utf8");

describe("/api/upload/image tenant scoping (§5.14)", () => {
  it("destructures membership from requireActiveMembership", () => {
    expect(source).toMatch(/requireActiveMembership\s*\(\s*\)/);
    expect(source).toMatch(/\{\s*session\s*,\s*membership\s*\}/);
  });

  it("defines an org-id whitelist pattern", () => {
    expect(source).toMatch(/ORG_ID_PATTERN\s*=\s*\/\^/);
  });

  it("sanitises the org id before using it as a path segment", () => {
    expect(source).toMatch(/ORG_ID_PATTERN\.test\(\s*orgId\s*\)/);
  });

  it("writes uploads under an org-scoped directory", () => {
    expect(source).toMatch(/join\(\s*UPLOAD_ROOT\s*,\s*orgId\s*\)/);
  });

  it("returns the org id as part of the public URL", () => {
    expect(source).toMatch(/\/uploads\/items\/\$\{orgId\}\//);
  });

  it("keeps the legacy UPLOAD_DIR name out of the file", () => {
    // The audit change renamed the constant; a re-introduction would
    // hint at a bad rebase that dropped the tenancy guard.
    expect(source).not.toMatch(/\bUPLOAD_DIR\b/);
  });
});
