/**
 * P2-1 (audit v1.0 §11.6) — pin the compound indexes that back the
 * app's hottest list queries so a schema refactor can't silently
 * drop them.
 *
 * The audit called out sequential-scan behaviour for org-wide
 * list pages that filter by (organizationId, status): PurchaseOrder,
 * SalesOrder, StockTransfer. It also flagged the notifications
 * dropdown, which filters by (userId, readAt IS NULL) and would
 * otherwise scan a user's full notification history.
 *
 * Those indexes already exist in the schema; this test is the
 * regression fence. A rename or a careless block removal would
 * show up in CI instead of in a production EXPLAIN plan.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SCHEMA_PATH = join(process.cwd(), "prisma/schema.prisma");
const schema = readFileSync(SCHEMA_PATH, "utf8");

/**
 * Extract the body of a Prisma model block. Returns the contents
 * between `model <name> {` and its closing brace, or null if the
 * model is missing.
 */
function modelBody(name: string): string | null {
  const re = new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const match = schema.match(re);
  return match ? (match[1] ?? null) : null;
}

describe("hot-path compound indexes (§11.6)", () => {
  it("PurchaseOrder keeps @@index([organizationId, status])", () => {
    const body = modelBody("PurchaseOrder");
    expect(body).not.toBeNull();
    expect(body).toMatch(/@@index\(\[organizationId,\s*status\]\)/);
  });

  it("SalesOrder keeps @@index([organizationId, status])", () => {
    const body = modelBody("SalesOrder");
    expect(body).not.toBeNull();
    expect(body).toMatch(/@@index\(\[organizationId,\s*status\]\)/);
  });

  it("StockTransfer keeps @@index([organizationId, status])", () => {
    const body = modelBody("StockTransfer");
    expect(body).not.toBeNull();
    expect(body).toMatch(/@@index\(\[organizationId,\s*status\]\)/);
  });

  it("Notification keeps @@index([userId, readAt])", () => {
    // Powers the shell's unread-dropdown query:
    //   WHERE userId = $1 AND readAt IS NULL ORDER BY createdAt DESC
    // Dropping this index re-introduces the sequential scan the
    // audit flagged.
    const body = modelBody("Notification");
    expect(body).not.toBeNull();
    expect(body).toMatch(/@@index\(\[userId,\s*readAt\]\)/);
  });
});
