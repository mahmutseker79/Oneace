// v1.3 §5.53 F-09 Phase-3.2 C — 10-adapter dispatch wiring pins.
//
// What this file freezes:
//
//   1. Each of the 10 C-wave adapters (amazon, bigcommerce, magento,
//      odoo, wix, woocommerce, xero, zoho, quickbooks-desktop,
//      custom-webhook) has a `register.ts` that, when imported,
//      registers the documented set of taskKinds with the dispatch
//      registry — and ONLY those kinds.
//
//   2. Each register module exports `<ADAPTER>_TASK_KINDS` as a
//      readonly tuple of the canonical strings. Webhook routes,
//      cron seeders, and downstream tooling all read these tuples;
//      a rename here is a contract break.
//
//   3. Each handler stamps the right two error codes:
//        - `SCHEMA_<PROVIDER>_INTEGRATION_NOT_FOUND` when the
//          per-org integration row is missing — fires BEFORE the
//          pending-execution marker so the schema-mismatch
//          classifier bucket sees missing-integration first.
//        - `TRANSPORT_<PROVIDER>_EXECUTION_PENDING` once the
//          integration row is present but per-adapter client
//          construction is still a follow-up PR. The marker is
//          deliberate: it closes F-09's SCHEMA_UNWIRED silent-loop
//          while honestly representing that execution is pending.
//
//   4. The handlers/index.ts barrel side-effect-imports all 10
//      register modules. Without these imports, a cold-lambda cron
//      drain would still throw SCHEMA_UNWIRED_ADAPTER per adapter.
//
// Static-analysis strategy: this file imports each register module
// against a fresh registry, asserts the exported tuple shape, then
// drives the handler twice (once with `db.integration.findFirst`
// stubbed to null, once stubbed to a row) to pin both error paths.
// `db` is mocked via vitest's module mock — no Prisma required.
//
// Drift you want this test to catch:
//   - someone adds a new taskKind to one adapter without updating
//     the webhook route → tuple length / sorted-snapshot shifts
//   - someone renames `TRANSPORT_*_EXECUTION_PENDING` → DLQ slice
//     query stops finding pending rows
//   - someone removes a side-effect import from the barrel → entire
//     adapter goes silent on cron drain again

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClaimedTask } from "./task-queue";

// ─────────────────────────────────────────────────────────────────
// Module mock — db.integration.findFirst is the only Prisma call
// every C-wave register.ts makes; toggling its return between null
// and a row drives both error paths without a real database.
// ─────────────────────────────────────────────────────────────────

const findFirstMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    integration: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const HANDLERS_BARREL_PATH = resolve(REPO_ROOT, "src/lib/integrations/handlers/index.ts");

function fakeTask(integrationKind: string, taskKind: string): ClaimedTask {
  return {
    id: `task_${integrationKind}_${taskKind}`,
    organizationId: "org_test_phase_3_2_c",
    integrationKind,
    taskKind,
    payload: {},
    retryCount: 0,
  };
}

// ─────────────────────────────────────────────────────────────────
// Per-adapter contract table.
//
// Order matches the alphabetical `__registeredKeysForTests()` snapshot
// each describe builds. `taskKinds` MUST stay in the same order the
// register.ts file declares so the snapshot assertions are stable.
// ─────────────────────────────────────────────────────────────────

type AdapterContract = {
  name: string;
  modulePath: string;
  integrationKind: string;
  exportName: string;
  schemaCode: string;
  transportCode: string;
  taskKinds: readonly string[];
};

const ADAPTERS: readonly AdapterContract[] = [
  {
    name: "amazon",
    modulePath: "./amazon/register",
    integrationKind: "amazon",
    exportName: "AMAZON_TASK_KINDS",
    schemaCode: "SCHEMA_AMAZON_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_AMAZON_EXECUTION_PENDING",
    taskKinds: ["sync_products", "sync_orders", "sync_inventory"],
  },
  {
    name: "bigcommerce",
    modulePath: "./bigcommerce/register",
    integrationKind: "bigcommerce",
    exportName: "BIGCOMMERCE_TASK_KINDS",
    schemaCode: "SCHEMA_BIGCOMMERCE_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_BIGCOMMERCE_EXECUTION_PENDING",
    taskKinds: ["sync_items", "sync_sales_orders", "sync_stock_levels"],
  },
  {
    name: "magento",
    modulePath: "./magento/register",
    integrationKind: "magento",
    exportName: "MAGENTO_TASK_KINDS",
    schemaCode: "SCHEMA_MAGENTO_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_MAGENTO_EXECUTION_PENDING",
    taskKinds: ["sync_items", "sync_sales_orders", "sync_stock_levels"],
  },
  {
    name: "odoo",
    modulePath: "./odoo/register",
    integrationKind: "odoo",
    exportName: "ODOO_TASK_KINDS",
    schemaCode: "SCHEMA_ODOO_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_ODOO_EXECUTION_PENDING",
    taskKinds: [
      "sync_products",
      "sync_sale_orders",
      "sync_purchase_orders",
      "sync_partners",
      "sync_stock",
      "sync_invoices",
    ],
  },
  {
    name: "wix",
    modulePath: "./wix/register",
    integrationKind: "wix",
    exportName: "WIX_TASK_KINDS",
    schemaCode: "SCHEMA_WIX_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_WIX_EXECUTION_PENDING",
    taskKinds: ["sync_products", "sync_orders", "sync_inventory", "sync_contacts"],
  },
  {
    name: "woocommerce",
    modulePath: "./woocommerce/register",
    integrationKind: "woocommerce",
    exportName: "WOOCOMMERCE_TASK_KINDS",
    schemaCode: "SCHEMA_WOOCOMMERCE_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_WOOCOMMERCE_EXECUTION_PENDING",
    taskKinds: ["sync_products", "sync_orders", "sync_customers", "sync_stock_levels"],
  },
  {
    name: "xero",
    modulePath: "./xero/register",
    integrationKind: "xero",
    exportName: "XERO_TASK_KINDS",
    schemaCode: "SCHEMA_XERO_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_XERO_EXECUTION_PENDING",
    taskKinds: [
      "sync_items",
      "sync_suppliers",
      "sync_purchase_orders",
      "sync_invoices",
      "sync_bills",
      "sync_payments",
      "sync_credit_notes",
      "sync_accounts",
      "sync_tax_rates",
      "sync_bank_transactions",
      "sync_manual_journals",
    ],
  },
  {
    name: "zoho",
    modulePath: "./zoho/register",
    integrationKind: "zoho",
    exportName: "ZOHO_TASK_KINDS",
    schemaCode: "SCHEMA_ZOHO_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_ZOHO_EXECUTION_PENDING",
    taskKinds: [
      "sync_items",
      "sync_sales_orders",
      "sync_purchase_orders",
      "sync_contacts",
      "sync_inventory",
      "sync_invoices",
      "sync_bills",
    ],
  },
  {
    name: "quickbooks-desktop",
    modulePath: "./quickbooks-desktop/register",
    integrationKind: "quickbooks-desktop",
    exportName: "QUICKBOOKS_DESKTOP_TASK_KINDS",
    schemaCode: "SCHEMA_QUICKBOOKS_DESKTOP_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_QUICKBOOKS_DESKTOP_EXECUTION_PENDING",
    taskKinds: [
      "sync_items",
      "sync_customers",
      "sync_vendors",
      "sync_invoices",
      "sync_bills",
      "sync_purchase_orders",
      "sync_payments",
    ],
  },
  {
    name: "custom-webhook",
    modulePath: "./custom-webhook/register",
    integrationKind: "custom-webhook",
    exportName: "CUSTOM_WEBHOOK_TASK_KINDS",
    schemaCode: "SCHEMA_CUSTOM_WEBHOOK_INTEGRATION_NOT_FOUND",
    transportCode: "TRANSPORT_CUSTOM_WEBHOOK_EXECUTION_PENDING",
    taskKinds: ["sync_items", "sync_orders", "sync_stock"],
  },
];

// ─────────────────────────────────────────────────────────────────
// Per-adapter behaviour: tuple shape + both error paths.
// ─────────────────────────────────────────────────────────────────

// Freshly-imported registry handle per test so each `beforeEach`
// works against a zero'd Map. ESM caches module instances; using
// `vi.resetModules()` + dynamic import gives us a new registry
// instance AND a fresh (unregistered) adapter module, so the
// side-effect-import re-runs for each test.
async function freshRegistry(): Promise<{
  dispatch: (task: ClaimedTask) => Promise<void>;
  __registeredKeysForTests: () => string[];
}> {
  const mod = (await import("./task-dispatch-registry")) as {
    dispatch: (task: ClaimedTask) => Promise<void>;
    __registeredKeysForTests: () => string[];
  };
  return mod;
}

describe("§5.53 F-09 Phase-3.2 C — per-adapter wiring contract", () => {
  beforeEach(() => {
    vi.resetModules();
    findFirstMock.mockReset();
  });
  afterEach(() => {
    vi.resetModules();
    findFirstMock.mockReset();
  });

  for (const adapter of ADAPTERS) {
    describe(adapter.name, () => {
      it(`importing ${adapter.name}/register registers exactly the documented kinds`, async () => {
        await import(adapter.modulePath);
        const { __registeredKeysForTests } = await freshRegistry();
        const expected = adapter.taskKinds.map((k) => `${adapter.integrationKind}:${k}`).sort();
        expect(__registeredKeysForTests()).toEqual(expected);
      });

      it(`${adapter.exportName} export matches the documented tuple`, async () => {
        const mod = (await import(adapter.modulePath)) as Record<string, readonly string[]>;
        const tuple = mod[adapter.exportName];
        expect(tuple).toBeDefined();
        expect([...tuple]).toEqual([...adapter.taskKinds]);
      });

      it(`handler stamps ${adapter.schemaCode} when integration row is missing`, async () => {
        await import(adapter.modulePath);
        const { dispatch } = await freshRegistry();
        findFirstMock.mockResolvedValueOnce(null);
        await expect(
          dispatch(fakeTask(adapter.integrationKind, adapter.taskKinds[0]!)),
        ).rejects.toMatchObject({ code: adapter.schemaCode });
      });

      it(`handler stamps ${adapter.transportCode} when integration row is present (pending-execution marker)`, async () => {
        await import(adapter.modulePath);
        const { dispatch } = await freshRegistry();
        findFirstMock.mockResolvedValueOnce({
          id: "int_1",
          credentials: {},
          externalAccountId: "acct_1",
        });
        await expect(
          dispatch(fakeTask(adapter.integrationKind, adapter.taskKinds[0]!)),
        ).rejects.toMatchObject({ code: adapter.transportCode });
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// Barrel side-effect imports — without these the cron route still
// hits SCHEMA_UNWIRED_ADAPTER on every C-wave taskKind even though
// the register modules exist.
// ─────────────────────────────────────────────────────────────────

describe("§5.53 F-09 Phase-3.2 C — handlers/index.ts barrel covers all 10 C-wave adapters", () => {
  const barrel = readFileSync(HANDLERS_BARREL_PATH, "utf8");

  for (const adapter of ADAPTERS) {
    it(`barrel side-effect-imports ../${adapter.name}/register`, () => {
      const escaped = adapter.name.replace(/[-]/g, "\\-");
      const re = new RegExp(`import\\s+["']\\.\\./${escaped}/register["']`);
      expect(barrel).toMatch(re);
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// Aggregate snapshot — the entire C wave should add 51 new keys
// across the 10 adapters once every register module imports.
// ─────────────────────────────────────────────────────────────────

describe("§5.53 F-09 Phase-3.2 C — aggregate registry snapshot", () => {
  beforeEach(() => {
    vi.resetModules();
    findFirstMock.mockReset();
  });
  afterEach(() => {
    vi.resetModules();
    findFirstMock.mockReset();
  });

  it("importing all 10 C-wave register modules registers exactly 51 keys", async () => {
    for (const adapter of ADAPTERS) {
      await import(adapter.modulePath);
    }
    const { __registeredKeysForTests } = await freshRegistry();
    const expectedKeys = ADAPTERS.flatMap((a) =>
      a.taskKinds.map((k) => `${a.integrationKind}:${k}`),
    ).sort();
    expect(__registeredKeysForTests()).toEqual(expectedKeys);
    expect(expectedKeys.length).toBe(51);
  });

  it("no two C-wave adapters share an (integrationKind, taskKind) pair", () => {
    const keys = ADAPTERS.flatMap((a) => a.taskKinds.map((k) => `${a.integrationKind}:${k}`));
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});
