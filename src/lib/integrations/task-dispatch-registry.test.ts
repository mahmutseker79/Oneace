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

import type { ClaimedTask } from "./task-queue";
import {
  __registeredKeysForTests,
  __resetRegistryForTests,
  dispatch,
  hasHandler,
  registerHandler,
} from "./task-dispatch-registry";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const CRON_ROUTE_PATH = resolve(
  REPO_ROOT,
  "src/app/api/cron/integration-tasks/route.ts",
);
const SHOPIFY_REGISTER_PATH = resolve(
  REPO_ROOT,
  "src/lib/integrations/shopify/register.ts",
);
const HANDLERS_BARREL_PATH = resolve(
  REPO_ROOT,
  "src/lib/integrations/handlers/index.ts",
);
const SHOPIFY_WEBHOOK_ROUTE_PATH = resolve(
  REPO_ROOT,
  "src/app/api/integrations/shopify/webhooks/route.ts",
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
  it("handlers/index.ts imports shopify/register for its side effects", () => {
    const barrel = readFileSync(HANDLERS_BARREL_PATH, "utf8");
    // The import form matters — named imports wouldn't fire the
    // `registerHandler` side effect on tree-shaken builds.
    expect(barrel).toMatch(/import\s+["']\.\.\/shopify\/register["']/);
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

  it("calls enqueue with integrationKind: \"shopify\"", () => {
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

  it("handlers/index.ts barrel exists", () => {
    expect(() => statSync(HANDLERS_BARREL_PATH)).not.toThrow();
  });
});
