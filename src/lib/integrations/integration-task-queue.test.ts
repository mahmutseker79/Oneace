// v1.3 §5.53 F-09 — IntegrationTask durable queue + DLQ.
//
// What this test pins (and why):
//
//   1. The backoff curve is frozen. `BACKOFF_MS = [1m, 5m, 30m, 2h,
//      8h]` is a design contract, not an implementation detail — the
//      audit references these exact waits, and the runbook quotes
//      "1 + 5 + 30 ≈ 36 min to dead-letter". A cleanup that drops
//      entries or reorders them would silently change the dead-letter
//      SLO.
//
//   2. `MAX_RETRIES === 3`. The dead-letter email body references
//      this value textually ("failed after 3 retries") and the
//      runbook quotes it. Change this and the email + docs lie.
//
//   3. `backoffMsFor()` clamps on both ends. Negative input must not
//      return `undefined`; out-of-range must not crash. Both are
//      defense against a future ceiling bump that forgets to extend
//      `BACKOFF_MS` in lock-step.
//
//   4. `classifyError()` maps each documented bucket correctly. The
//      buckets drive per-kind dashboards and alerting; a silent
//      reshuffle would move, say, a 429 from `rate-limit` into
//      `4xx` and invalidate every Grafana panel that splits on
//      `lastErrorKind`.
//
//   5. Schema + migration shape. The Prisma model must exist with
//      exactly the columns the helpers read; the migration must
//      create the table and the two indexes the cron + DLQ view
//      walk. A rename without updating both is how §5.53 regressions
//      happen.
//
// Why static-analysis instead of running Prisma: the goal is "did
// someone move the cheese", not "does the DB round-trip". The file
// shape is the contract — the runtime behavior is guarded by the
// `claimDueTasks` SQL at call time.

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { BACKOFF_MS, MAX_RETRIES, backoffMsFor, classifyError, errorMessage } from "./task-queue";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SCHEMA_PATH = resolve(REPO_ROOT, "prisma/schema.prisma");
const MIGRATION_PATH = resolve(
  REPO_ROOT,
  "prisma/migrations/20260419000000_integration_task_dlq/migration.sql",
);
const ROUTE_PATH = resolve(REPO_ROOT, "src/app/api/cron/integration-tasks/route.ts");
const VERCEL_JSON_PATH = resolve(REPO_ROOT, "vercel.json");
const OPENAPI_PATH = resolve(REPO_ROOT, "docs/openapi.yaml");

describe("§5.53 F-09 — backoff curve is the design contract", () => {
  it("BACKOFF_MS is exactly [1m, 5m, 30m, 2h, 8h] in that order", () => {
    expect(BACKOFF_MS).toEqual([
      1 * 60_000,
      5 * 60_000,
      30 * 60_000,
      2 * 60 * 60_000,
      8 * 60 * 60_000,
    ]);
  });

  it("MAX_RETRIES is 3 (matches dead-letter email copy + runbook)", () => {
    expect(MAX_RETRIES).toBe(3);
  });

  it("backoffMsFor(0..4) returns each curve entry", () => {
    expect(backoffMsFor(0)).toBe(60_000);
    expect(backoffMsFor(1)).toBe(5 * 60_000);
    expect(backoffMsFor(2)).toBe(30 * 60_000);
    expect(backoffMsFor(3)).toBe(2 * 60 * 60_000);
    expect(backoffMsFor(4)).toBe(8 * 60 * 60_000);
  });

  it("backoffMsFor(-1) clamps to the first entry (defensive)", () => {
    expect(backoffMsFor(-1)).toBe(BACKOFF_MS[0]);
  });

  it("backoffMsFor(99) clamps to the last entry (defensive)", () => {
    expect(backoffMsFor(99)).toBe(BACKOFF_MS[BACKOFF_MS.length - 1]);
  });
});

describe("§5.53 F-09 — classifyError bucket mapping is stable", () => {
  it("undefined/null → unknown", () => {
    expect(classifyError(undefined)).toBe("unknown");
    expect(classifyError(null)).toBe("unknown");
  });

  it("`AUTH_*` / `REFRESH_*` codes → auth", () => {
    expect(classifyError({ code: "AUTH_FAILED" })).toBe("auth");
    expect(classifyError({ code: "AUTH_TOKEN_EXPIRED" })).toBe("auth");
    expect(classifyError({ code: "OAUTH_REFRESH_FAILED" })).toBe("auth");
  });

  it("rate-limit codes → rate-limit", () => {
    expect(classifyError({ code: "RATE_LIMIT_EXCEEDED" })).toBe("rate-limit");
    expect(classifyError({ code: "API_RATE-LIMIT" })).toBe("rate-limit");
  });

  it("`SCHEMA_*` codes → schema-mismatch", () => {
    expect(classifyError({ code: "SCHEMA_MISMATCH" })).toBe("schema-mismatch");
    expect(classifyError({ code: "SCHEMA_UNWIRED_ADAPTER" })).toBe("schema-mismatch");
  });

  it("`TRANSPORT_*` / ECONNRESET / ETIMEDOUT → transport", () => {
    expect(classifyError({ code: "TRANSPORT_FAILURE" })).toBe("transport");
    expect(classifyError({ code: "ECONNRESET" })).toBe("transport");
    expect(classifyError({ code: "ETIMEDOUT" })).toBe("transport");
  });

  it("`HTTP_<status>` codes route by numeric status", () => {
    expect(classifyError({ code: "HTTP_401" })).toBe("auth");
    expect(classifyError({ code: "HTTP_403" })).toBe("auth");
    expect(classifyError({ code: "HTTP_429" })).toBe("rate-limit");
    expect(classifyError({ code: "HTTP_500" })).toBe("5xx");
    expect(classifyError({ code: "HTTP_503" })).toBe("5xx");
    expect(classifyError({ code: "HTTP_404" })).toBe("4xx");
    expect(classifyError({ code: "HTTP_400" })).toBe("4xx");
  });

  it("`statusCode` on the error is a fallback path", () => {
    expect(classifyError({ statusCode: 401 })).toBe("auth");
    expect(classifyError({ statusCode: 403 })).toBe("auth");
    expect(classifyError({ statusCode: 429 })).toBe("rate-limit");
    expect(classifyError({ statusCode: 502 })).toBe("5xx");
    expect(classifyError({ statusCode: 422 })).toBe("4xx");
  });

  it("fetch-throws → transport (TypeError / AbortError names)", () => {
    const t = new TypeError("Failed to fetch");
    expect(classifyError(t)).toBe("transport");
    const a = new Error("aborted");
    a.name = "AbortError";
    expect(classifyError(a)).toBe("transport");
  });

  it("bare Error with no code / statusCode → unknown", () => {
    expect(classifyError(new Error("boom"))).toBe("unknown");
  });
});

describe("§5.53 F-09 — errorMessage is safe for the lastError column", () => {
  it("string errors pass through", () => {
    expect(errorMessage("boom")).toBe("boom");
  });

  it("Error instance → its message", () => {
    expect(errorMessage(new Error("nope"))).toBe("nope");
  });

  it("null / undefined render as sentinel, not crash", () => {
    expect(errorMessage(undefined)).toBe("(no error)");
    expect(errorMessage(null)).toBe("(no error)");
  });

  it("truncates runaway messages to protect the TEXT column", () => {
    const long = "x".repeat(2000);
    const out = errorMessage(long, 50);
    expect(out.length).toBe(51); // 50 chars + ellipsis
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("§5.53 F-09 — Prisma schema declares IntegrationTask", () => {
  const schema = readFileSync(SCHEMA_PATH, "utf8");

  it("model IntegrationTask exists", () => {
    expect(schema).toMatch(/model\s+IntegrationTask\s*\{/);
  });

  it("has every column the task-queue helpers read", () => {
    const model = schema.slice(schema.indexOf("model IntegrationTask"));
    // Take the model block up to the first closing `}` at column 0 —
    // good enough for a sanity scan.
    const block = model.slice(0, model.indexOf("\n}"));
    for (const field of [
      "organizationId",
      "integrationKind",
      "taskKind",
      "payload",
      "status",
      "retryCount",
      "nextAttemptAt",
      "lastError",
      "lastErrorKind",
    ]) {
      expect(block, `expected field "${field}"`).toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it("declares both indexes the cron + DLQ view walk", () => {
    const model = schema.slice(schema.indexOf("model IntegrationTask"));
    const block = model.slice(0, model.indexOf("\n}"));
    expect(block).toMatch(/@@index\(\[status,\s*nextAttemptAt\]\)/);
    expect(block).toMatch(/@@index\(\[organizationId,\s*integrationKind\]\)/);
  });

  it("Organization model declares the back-relation", () => {
    // A dangling Prisma relation is a validate-time error; pin it
    // here so a rename on either side fails fast rather than at
    // `prisma generate` time in CI.
    expect(schema).toMatch(/integrationTasks\s+IntegrationTask\[\]/);
  });
});

describe("§5.53 F-09 — migration SQL creates the table idempotently", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("CREATE TABLE IF NOT EXISTS is idempotent (re-apply safe)", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "IntegrationTask"/);
  });

  it("creates both indexes idempotently", () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS "IntegrationTask_status_nextAttemptAt_idx"/);
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "IntegrationTask_organizationId_integrationKind_idx"/,
    );
  });

  it("FK to Organization uses ON DELETE CASCADE via conditional ALTER", () => {
    // The conditional ALTER is what makes the migration safe to
    // re-apply on top of a partially-applied DB. Pin both halves.
    expect(sql).toMatch(/IntegrationTask_organizationId_fkey/);
    expect(sql).toMatch(/ON DELETE CASCADE/);
    expect(sql).toMatch(/DO \$\$/);
    expect(sql).toMatch(/IF NOT EXISTS/);
  });
});

describe("§5.53 F-09 — cron route + wiring", () => {
  it("route file exists at the canonical path", () => {
    expect(() => statSync(ROUTE_PATH)).not.toThrow();
  });

  it("route declares the openapi-tag the parity test expects", () => {
    const route = readFileSync(ROUTE_PATH, "utf8");
    expect(route).toMatch(/@openapi-tag:\s*\/cron\/integration-tasks/);
  });

  it("route uses CRON_SECRET Bearer auth (matches sibling crons)", () => {
    const route = readFileSync(ROUTE_PATH, "utf8");
    expect(route).toContain("CRON_SECRET");
    expect(route).toMatch(/Bearer/);
  });

  it("route pins runtime=nodejs (Prisma cannot run on edge)", () => {
    const route = readFileSync(ROUTE_PATH, "utf8");
    expect(route).toMatch(/runtime\s*=\s*["']nodejs["']/);
  });

  it("vercel.json registers the cron at the documented schedule", () => {
    const vercel = JSON.parse(readFileSync(VERCEL_JSON_PATH, "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    const entry = vercel.crons?.find((c) => c.path === "/api/cron/integration-tasks");
    expect(entry).toBeDefined();
    // 30-minute cadence matches the other queue-drain crons; a
    // drift here would silently move the dead-letter SLO.
    expect(entry?.schedule).toBe("*/30 * * * *");
  });

  it("openapi.yaml declares the route (parity pin)", () => {
    const yaml = readFileSync(OPENAPI_PATH, "utf8");
    expect(yaml).toMatch(/^\s*\/cron\/integration-tasks:/m);
  });
});
