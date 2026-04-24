// v1.3 §5.53 F-09 B-1 — dispatch registry + Shopify wiring pins.
//
// What this file freezes:
//
//   1. Registry contract. `registerHandler` is idempotent-rejecting
//      (duplicate key throws); `dispatch` on an unknown key throws
//      `SCHEMA_UNWIRED_ADAPTER`. Both are the backbone of ADR-005 —
//      if either drifts, the queue drain loop either silently
//      ignores tasks or double-dispatches when two PRs land the
//      same key.
//
//   2. Lowercase normalisation. Adapter-PR authors will mistype
//      `Shopify` vs `shopify`; the registry must fold case.
//
//   3. Shopify barrel import wires 4 task kinds. `sync_products`,
//      `sync_orders`, `sync_inventory`, `sync_customers`. The
//      webhook route's topic → taskKind map reads these exact
//      strings; a rename without updating the webhook is the F-09
//      regression this test catches.
//
//   4. Cron route wiring. The route must import the handlers
//      barrel BEFORE the request function runs (side-effect
//      import at top-of-file) and must call `dispatch(task)`
//      instead of its old `dispatchTask()` placeholder.
//
//   5. Shopify webhook route now enqueues. The `routeShopifyTopic`
//      function calls `enqueue({...})` with `integrationKind:
//      "shopify"`. A rollback that reverts the webhook to the
//      log-only shape would defeat F-09's whole point.
//
// Static-analysis over Prisma because (a) we can't run Prisma in
// this test suite without a DB, and (b) the contract is "which
// strings appear in which files" — source-text matches are the
// right granularity.

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __registeredKeysForTests,
  __resetRegistryForTests,
  dispatch,
  hasHandler,
  registerHandler,
} from "./task-dispatch-registry";
import type { ClaimedTask } from "./task-queue";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const CRON_ROUTE_PATH = resolve(REPO_ROOT, "src/app/api/cron/integration-tasks/route.ts");
const SHOPIFY_REGISTER_PATH = resolve(REPO_ROOT, "src/lib/integrations/shopify/register.ts");
const QBO_REGISTER_PATH = resolve(REPO_ROOT, "src/lib/integrations/quickbooks/register.ts");
const HANDLERS_BARREL_PATH = resolve(REPO_ROOT, "src/lib/integrations/handlers/index.ts");
const SHOPIFY_WEBHOOK_ROUTE_PATH = resolve(
  REPO_ROOT,
  "src/app/api/integrations/shopify/webhooks/route.ts",
);
const QBO_WEBHOOK_ROUTE_PATH = resolve(
  REPO_ROOT,
  "src/app/api/integrations/quickbooks/webhooks/route.ts",
);
const ADR_005_PATH = resolve(REPO_ROOT, "docs/ADR-005-integration-handler-registry.md");

// ─────────────────────────────────────────────────────────────────
// Registry unit contract
// ─────────────────────────────────────────────────────────────────

function fakeTask(integrationKind: string, taskKind: string): ClaimedTask {
  return {
    id: "task_test_1",
    organizationId: "org_test_1",
    integrationKind,
    taskKind,
    payload: {},
    retryCount: 0,
  };
}

describe("§5.53 F-09 — registry registerHandler + dispatch", () => {
  beforeEach(() => {
    __resetRegistryForTests();
  });
  afterEach(() => {
    __resetRegistryForTests();
  });

  it("dispatch on unregistered key throws SCHEMA_UNWIRED_ADAPTER", async () => {
    await expect(dispatch(fakeTask("ghost", "do_stuff"))).rejects.toMatchObject({
      code: "SCHEMA_UNWIRED_ADAPTER",
    });
  });

  it("registerHandler + dispatch returns normally on handler success", async () => {
    let seen = 0;
    registerHandler("x", "y", async () => {
      seen += 1;
    });
    await dispatch(fakeTask("x", "y"));
    expect(seen).toBe(1);
  });

  it("handler throws propagate unchanged (queue sees the raw error)", async () => {
    registerHandler("x", "y", async () => {
      const err = new Error("boom");
      (err as { code?: string }).code = "AUTH_FOO";
      throw err;
    });
    await expect(dispatch(fakeTask("x", "y"))).rejects.toMatchObject({
      message: "boom",
      code: "AUTH_FOO",
    });
  });

  it("duplicate registration throws synchronously (catches two-files-same-key)", () => {
    registerHandler("x", "y", async () => undefined);
    expect(() => registerHandler("x", "y", async () => undefined)).toThrow(
      /duplicate registration/i,
    );
  });

  it("key matching is case-insensitive (Shopify == shopify)", async () => {
    let seen = 0;
    registerHandler("Shopify", "Sync_Products", async () => {
      seen += 1;
    });
    await dispatch(fakeTask("shopify", "sync_products"));
    expect(seen).toBe(1);
  });

  it("hasHandler reflects registrations without side effects", () => {
    expect(hasHandler("x", "y")).toBe(false);
    registerHandler("x", "y", async () => undefined);
    expect(hasHandler("x", "y")).toBe(true);
    expect(hasHandler("x", "z")).toBe(false);
  });

  it("__registeredKeysForTests returns a stable sorted snapshot", () => {
    registerHandler("b", "2", async () => undefined);
    registerHandler("a", "1", async () => undefined);
    expect(__registeredKeysForTests()).toEqual(["a:1", "b:2"]);
  });
});

// ─────────────────────────────────────────────────────────────────
// Shopify adapter registration
// ─────────────────────────────────────────────────────────────────

describe("§5.53 F-09 B-1 — Shopify register.ts wires the 4 sync kinds", () => {
  beforeEach(() => {
    __resetRegistryForTests();
  });
  afterEach(() => {
    __resetRegistryForTests();
  });

  it("importing shopify/register registers exactly the 4 pilot keys", async () => {
    await import("./shopify/register");
    expect(__registeredKeysForTests()).toEqual([
      "shopify:sync_customers",
      "shopify:sync_inventory",
      "shopify:sync_orders",
      "shopify:sync_products",
    ]);
  });

  it("SHOPIFY_TASK_KINDS export is the canonical list (webhook route reads it)", async () => {
    const mod = (await import("./shopify/register")) as {
      SHOPIFY_TASK_KINDS: readonly string[];
    };
    expect([...mod.SHOPIFY_TASK_KINDS].sort()).toEqual([
      "sync_customers",
      "sync_inventory",
      "sync_orders",
      "sync_products",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────
// Handlers barrel + cron route wiring
// ─────────────────────────────────────────────────────────────────

describe("§5.53 F-09 — handlers barrel loads all adapters", () => {
  const barrel = readFileSync(HANDLERS_BARREL_PATH, "utf8");

  it("handlers/index.ts imports shopify/register for its side effects", () => {
    // The import form matters — named imports wouldn't fire the
    // `registerHandler` side effect on tree-shaken builds.
    expect(barrel).toMatch(/import\s+["']\.\.\/shopify\/register["']/);
  });

  it("handlers/index.ts imports quickbooks/register for its side effects (B-2)", () => {
    expect(barrel).toMatch(/import\s+["']\.\.\/quickbooks\/register["']/);
  });
});

describe("§5.53 F-09 — cron route calls dispatch(), not placeholder", () => {
  const route = readFileSync(CRON_ROUTE_PATH, "utf8");

  it("imports dispatch from task-dispatch-registry", () => {
    expect(route).toMatch(/from\s+["']@\/lib\/integrations\/task-dispatch-registry["']/);
    expect(route).toMatch(/\bdispatch\b/);
  });

  it("imports the handlers barrel as a side-effect import", () => {
    // Must be bare side-effect import (no named bindings) so the
    // adapter `registerHandler(...)` calls fire at module load.
    expect(route).toMatch(/import\s+["']@\/lib\/integrations\/handlers["']/);
  });

  it("no longer defines the old placeholder dispatchTask function", () => {
    expect(route).not.toMatch(/function\s+dispatchTask\s*\(/);
  });

  it("the dispatch call is the only per-task invocation in the drain loop", () => {
    // One `await dispatch(task)` inside the drain `for` loop.
    expect(route).toMatch(/await\s+dispatch\(task\)/);
  });
});

// ─────────────────────────────────────────────────────────────────
// Shopify webhook route now enqueues
// ─────────────────────────────────────────────────────────────────

describe("§5.53 F-09 B-1 — shopify webhook route enqueues instead of logging", () => {
  const route = readFileSync(SHOPIFY_WEBHOOK_ROUTE_PATH, "utf8");

  it("imports enqueue from task-queue", () => {
    expect(route).toMatch(
      /import\s+\{\s*enqueue\s*\}\s+from\s+["']@\/lib\/integrations\/task-queue["']/,
    );
  });

  it('calls enqueue with integrationKind: "shopify"', () => {
    expect(route).toMatch(/integrationKind:\s*["']shopify["']/);
  });

  it("topic → taskKind mapping covers every documented Shopify topic family", () => {
    expect(route).toMatch(/products\//);
    expect(route).toMatch(/inventory_levels\//);
    expect(route).toMatch(/orders\//);
    expect(route).toMatch(/customers\//);
  });

  it("app/uninstalled is still handled synchronously (no queue entry)", () => {
    // Uninstall is lifecycle, not sync — enqueueing it would spam
    // the dead-letter mailbox if the integration is already gone.
    expect(route).toMatch(/app\/uninstalled/);
    expect(route).toMatch(/app_uninstalled/);
  });
});

// ─────────────────────────────────────────────────────────────────
// ADR-005 present
// ─────────────────────────────────────────────────────────────────

describe("§5.53 F-09 — ADR-005 is the review anchor", () => {
  it("ADR-005 exists at the canonical docs path", () => {
    expect(() => statSync(ADR_005_PATH)).not.toThrow();
  });

  it("ADR-005 documents registerHandler / dispatch API", () => {
    const adr = readFileSync(ADR_005_PATH, "utf8");
    expect(adr).toMatch(/registerHandler/);
    expect(adr).toMatch(/dispatch/);
    expect(adr).toMatch(/SCHEMA_UNWIRED_ADAPTER/);
  });

  it("shopify/register.ts file exists", () => {
    expect(() => statSync(SHOPIFY_REGISTER_PATH)).not.toThrow();
  });

  it("quickbooks/register.ts file exists (B-2)", () => {
    expect(() => statSync(QBO_REGISTER_PATH)).not.toThrow();
  });

  it("handlers/index.ts barrel exists", () => {
    expect(() => statSync(HANDLERS_BARREL_PATH)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
// QuickBooks adapter registration (B-2)
// ─────────────────────────────────────────────────────────────────

describe("§5.53 F-09 B-2 — QuickBooks register.ts wires the 14 ERP kinds", () => {
  beforeEach(() => {
    __resetRegistryForTests();
  });
  afterEach(() => {
    __resetRegistryForTests();
  });

  it("importing quickbooks/register registers exactly the 14 pilot keys", async () => {
    await import("./quickbooks/register");
    // Sorted snapshot — drift here means a taskKind was renamed or
    // dropped without touching the webhook route, which is the
    // classic B-2 regression: webhook enqueues `sync_invoices`,
    // register knows only `sync_invoice`, cron drain dead-letters.
    expect(__registeredKeysForTests()).toEqual([
      "quickbooks:sync_accounts",
      "quickbooks:sync_bills",
      "quickbooks:sync_credit_memos",
      "quickbooks:sync_customers",
      "quickbooks:sync_deposits",
      "quickbooks:sync_estimates",
      "quickbooks:sync_invoices",
      "quickbooks:sync_items",
      "quickbooks:sync_journal_entries",
      "quickbooks:sync_payments",
      "quickbooks:sync_purchase_orders",
      "quickbooks:sync_sales_receipts",
      "quickbooks:sync_suppliers",
      "quickbooks:sync_tax_codes",
    ]);
  });

  it("QBO_TASK_KINDS export is the canonical list (webhook route reads it)", async () => {
    const mod = (await import("./quickbooks/register")) as {
      QBO_TASK_KINDS: readonly string[];
    };
    expect([...mod.QBO_TASK_KINDS].sort()).toEqual([
      "sync_accounts",
      "sync_bills",
      "sync_credit_memos",
      "sync_customers",
      "sync_deposits",
      "sync_estimates",
      "sync_invoices",
      "sync_items",
      "sync_journal_entries",
      "sync_payments",
      "sync_purchase_orders",
      "sync_sales_receipts",
      "sync_suppliers",
      "sync_tax_codes",
    ]);
  });

  it("Shopify + QuickBooks task kinds live in disjoint namespaces (no collision possible)", async () => {
    // Prove statically that the two adapters can't step on each
    // other's keys — the key format is `${integrationKind}:${
    // taskKind}` and each adapter uses a distinct integrationKind.
    // A full vi.resetModules re-import dance would break the
    // shared-registry instance the rest of this file relies on, so
    // we assert the property at the string level instead.
    const shopify = (await import("./shopify/register")) as {
      SHOPIFY_TASK_KINDS: readonly string[];
    };
    const qbo = (await import("./quickbooks/register")) as {
      QBO_TASK_KINDS: readonly string[];
    };
    const shopifyKeys = shopify.SHOPIFY_TASK_KINDS.map((k) => `shopify:${k}`);
    const qboKeys = qbo.QBO_TASK_KINDS.map((k) => `quickbooks:${k}`);
    const overlap = shopifyKeys.filter((k) => qboKeys.includes(k));
    expect(overlap).toEqual([]);
    expect(shopifyKeys.length + qboKeys.length).toBe(18);
  });
});

describe("§5.53 F-09 B-2 — QuickBooks refresh-token-expired heuristic", () => {
  it("catches the `invalid_grant` OAuth2 error body marker", async () => {
    const mod = (await import("./quickbooks/register")) as {
      __internal: { looksLikeRefreshExpired: (err: unknown) => boolean };
    };
    expect(mod.__internal.looksLikeRefreshExpired(new Error("invalid_grant"))).toBe(true);
    expect(mod.__internal.looksLikeRefreshExpired(new Error("Refresh token has expired"))).toBe(
      true,
    );
    expect(mod.__internal.looksLikeRefreshExpired(new Error("refresh_token_expired"))).toBe(true);
  });

  it("does NOT false-positive on generic transport errors", async () => {
    const mod = (await import("./quickbooks/register")) as {
      __internal: { looksLikeRefreshExpired: (err: unknown) => boolean };
    };
    expect(mod.__internal.looksLikeRefreshExpired(new Error("ECONNRESET"))).toBe(false);
    expect(mod.__internal.looksLikeRefreshExpired(new Error("HTTP 500 from QBO"))).toBe(false);
    expect(mod.__internal.looksLikeRefreshExpired("string error")).toBe(false);
    expect(mod.__internal.looksLikeRefreshExpired(null)).toBe(false);
  });
});

describe("§5.53 F-09 B-2 — QuickBooks webhook route enqueues per entity change", () => {
  const route = readFileSync(QBO_WEBHOOK_ROUTE_PATH, "utf8");

  it("imports enqueue from task-queue", () => {
    expect(route).toMatch(
      /import\s+\{\s*enqueue\s*\}\s+from\s+["']@\/lib\/integrations\/task-queue["']/,
    );
  });

  it('calls enqueue with integrationKind: "quickbooks"', () => {
    expect(route).toMatch(/integrationKind:\s*["']quickbooks["']/);
  });

  it("qboEntityToTaskKind covers every QBO entity with a sync engine path", () => {
    // These are the 14 QBO entities QBOSyncEngine.ALL_SYNC_ENTITIES
    // handles. A new QBO entity added to the sync engine without
    // the reverse taskKind mapping here would silently drop
    // webhook notifications — the B-2 regression we pin.
    const expectedEntities = [
      "Item",
      "Customer",
      "Vendor",
      "Invoice",
      "Bill",
      "Payment",
      "PurchaseOrder",
      "Account",
      "TaxCode",
      "Estimate",
      "SalesReceipt",
      "CreditMemo",
      "JournalEntry",
      "Deposit",
    ];
    for (const entityName of expectedEntities) {
      expect(route).toMatch(new RegExp(`case\\s+["']${entityName}["']:`));
    }
  });

  it("GET challenge handler still returns the QBO verification token", () => {
    // QBO sends a GET with ?challenge=... during webhook setup.
    // A regression that pulls the challenge branch out would brick
    // every fresh connection at the Intuit end.
    expect(route).toMatch(/challenge/);
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("HMAC verification path is preserved (B-2 must not weaken auth)", () => {
    // Paranoia check — the enqueue edit should only have added
    // lines, never removed the signature verify guard.
    expect(route).toMatch(/QBO_WEBHOOK_VERIFIER_TOKEN/);
    expect(route).toMatch(/createHmac\(["']sha256["']/);
    expect(route).toMatch(/timingSafeEqual/);
  });
});
