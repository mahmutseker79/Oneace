# ADR-005 — Integration handler registry

**Status:** Accepted
**Decided:** 2026-04-19
**Context:** v1.3 audit §5.53 F-09 remediation — Phase-3.2 B-1 precursor
**Supersedes:** none
**Superseded by:** none

---

## 1. Context

v1.5.23 landed the durable `IntegrationTask` queue + DLQ primitive (F-09). The
primitive ships with:

- `enqueue(task)` — insert row, return task id.
- `claimDueTasks({ limit })` — `FOR UPDATE SKIP LOCKED` row claim.
- `markDone(taskId)` / `markFailure(taskId, error)` — terminal transitions.
- `classifyError(err)` — bucket into `auth / rate-limit / 5xx / 4xx /
  schema-mismatch / transport / unknown`.
- `/api/cron/integration-tasks` — 30-minute drain loop.

What's missing is the **dispatch contract**: the route currently calls a
placeholder `dispatchTask()` that throws `SCHEMA_UNWIRED_ADAPTER`. Before we
start wiring the 15 adapters (Shopify, QuickBooks, Amazon, BigCommerce,
Magento, Odoo, WooCommerce, Wix, Xero, Zoho, custom-webhook, …) each of them
needs to bind to the same registry surface — otherwise every adapter PR will
reinvent a dispatcher and the cron route will accumulate a 15-way switch.

This ADR fixes the registry surface **before** any adapter wires itself, so
every adapter PR is a pure "handler add" diff — never a cron-route diff.

## 2. Decision

Introduce `src/lib/integrations/task-dispatch-registry.ts` with two exports:

```ts
export type IntegrationKind = string;       // "shopify" | "quickbooks" | …
export type TaskKind        = string;       // "sync_products" | "webhook_received" | …
export type TaskHandler     = (task: ClaimedTask) => Promise<void>;

export function registerHandler(
  integrationKind: IntegrationKind,
  taskKind:        TaskKind,
  fn:              TaskHandler,
): void;

export function dispatch(task: ClaimedTask): Promise<void>;
```

Behaviour contract:

1. **Registry is a module-level `Map<string, TaskHandler>`** keyed by
   `` `${integrationKind}:${taskKind}` ``. First registration wins; a second
   `registerHandler` for the same key throws synchronously (catches the
   "two files register the same handler" bug at module-load time, not 30
   minutes later when the cron fires).
2. **`dispatch(task)` looks up `` `${task.integrationKind}:${task.taskKind}` ``**
   and invokes the handler. If missing, it throws an `Error` with
   `code = "SCHEMA_UNWIRED_ADAPTER"` — `classifyError` routes this to the
   `schema-mismatch` bucket so the DLQ dashboard surfaces it as a wiring
   regression, not a runtime bug.
3. **Handlers re-throw on failure.** They do not absorb errors, do not log,
   do not enqueue follow-up retries. The queue loop owns all retry
   scheduling. Absorbing was the F-09 failure mode; the registry must
   preserve the "throw → row fails → backoff curve" contract.
4. **Handlers must tag thrown errors with a code**, following the
   `classifyError` convention: `AUTH_*`, `REFRESH_*`, `RATE_LIMIT_*`,
   `SCHEMA_*`, `TRANSPORT_*`, or `HTTP_<status>`. An untagged throw falls
   into `unknown`, which is acceptable but defeats per-kind alerting.
5. **The cron route stays thin.** `/api/cron/integration-tasks` calls
   `dispatch(task)` — it does not know any adapter exists. Each adapter
   module side-effect-registers its handlers at import time; the route
   imports a single `src/lib/integrations/handlers/index.ts` barrel that
   imports every adapter's `register.ts` file.

## 3. Adapter wiring shape

Every adapter PR adds one file (`register.ts`) and touches the
barrel (`src/lib/integrations/handlers/index.ts`). Example — Shopify:

```ts
// src/lib/integrations/shopify/register.ts
import { registerHandler } from "@/lib/integrations/task-dispatch-registry";
import { ShopifySyncEngine } from "./shopify-sync";

registerHandler("shopify", "sync_products", async (task) => {
  const engine = new ShopifySyncEngine({ organizationId: task.organizationId });
  await engine.syncProducts(task.payload as ShopifySyncProductsPayload);
});

registerHandler("shopify", "webhook_received", async (task) => {
  const engine = new ShopifySyncEngine({ organizationId: task.organizationId });
  await engine.handleWebhook(task.payload as ShopifyWebhookPayload);
});
```

The adapter's existing in-process catch blocks change from:

```ts
} catch (error) {
  result.errors.push({ error: error.message });
  logger.error("Shopify sync failed", { error });
}
```

to:

```ts
} catch (error) {
  const code = stampIntegrationErrorCode(error); // HTTP_<status> | AUTH_* | RATE_LIMIT_* | TRANSPORT_* | …
  await enqueue({
    integrationKind: "shopify",
    taskKind:        context.entityType === "PRODUCT" ? "sync_products" : "sync_orders",
    organizationId:  context.organizationId,
    payload:         serialiseContext(context),
  });
  throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code });
}
```

The `throw` is load-bearing — without it, the cron's `claimDueTasks` never
sees the failure, so the backoff never fires. The `await enqueue` is what
lets the **next** drain window pick up where the current one died (rate-limit
pauses, auth-refresh loops, etc.). Both are required; dropping either one
puts us back in the F-09 failure mode.

## 4. Alternatives considered

| Option                                   | Rejected because                                                                                                                                                                          |
|------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Per-adapter cron route**               | 15 cron entries in `vercel.json`, 15 tags in OpenAPI parity, 15 health checks. Every drain-semantics fix becomes a 15-way patch.                                                          |
| **Switch-in-route**                      | `/api/cron/integration-tasks/route.ts` grows a `switch (task.integrationKind)` that every adapter PR must edit. Merge conflicts multiply; the route file becomes the hot-spot for churn. |
| **Event bus (Redis pub/sub, SQS)**       | Adds a runtime dependency this codebase doesn't have yet. The queue *is* the bus — we don't need a second transport for dispatch.                                                         |
| **Per-adapter `/api/integrations/<kind>/drain` + admin trigger** | Fans the cron config out and couples the admin UI to the drain loop. The queue is already organisation-scoped; we don't need another axis of multiplexing.            |
| **Reflection / filesystem discovery**    | Handlers registered via `import.meta.glob` or dynamic import make bundling unreliable on Vercel edge. Explicit import barrel is 10 lines and behaves the same at build time.              |

## 5. Consequences

**Good:**
- Cron route is stable forever; adapter PRs never touch it.
- Registry is the single swap point for a future **worker-loop** migration
  (e.g. if we move off Vercel cron to a long-running worker on Fly, the
  registry stays, only the loop body changes).
- Handler contract is three lines to audit — `registerHandler(kind, taskKind, fn)` —
  so reviewers can spot a missing error-code stamp at a glance.
- `SCHEMA_UNWIRED_ADAPTER` throws at drain time, not at enqueue time. That
  means a partially-wired adapter enqueues tasks safely; the DLQ dashboard
  surfaces the gap instead of silently dropping work.

**Bad / to monitor:**
- Module-load ordering. If `/api/cron/integration-tasks/route.ts` imports
  the barrel late, the first-ever drain on a cold lambda instance might
  race the registration. Mitigated by putting `import "@/lib/integrations/handlers"`
  at the **top** of the route file (side-effect import), before any
  route-handler code runs.
- Per-adapter payload schemas are untyped at the registry boundary — the
  handler casts `task.payload`. We accept this: typing through the
  registry would force a discriminated union covering all 15 adapters,
  which is churn. Each adapter owns its own payload validation.

## 6. Rollout

1. Ship this ADR + `task-dispatch-registry.ts` + pinned test (empty
   registry: `dispatch` on an unregistered key throws `SCHEMA_UNWIRED_ADAPTER`).
2. Swap the placeholder in `/api/cron/integration-tasks/route.ts` to call
   `dispatch(task)`. Tag `v1.5.24-integration-dispatch-registry`.
3. B-1 Shopify wiring: add `shopify/register.ts`, mutate the catches,
   pinned test. Tag `v1.5.25-f09-shopify-wiring`.
4. B-2 QuickBooks wiring: same shape, different error-code mapping (OAuth
   refresh). Tag `v1.5.26-f09-quickbooks-wiring`.
5. Remaining 13 adapters: ticketed individually against the audit's
   F-09 follow-up section.

## 7. Review pointers

- `src/lib/integrations/task-queue.ts` — the primitive this ADR binds to.
- `src/lib/integrations/integration-task-queue.test.ts` — pinned
  contracts (backoff curve, MAX_RETRIES, classifier buckets).
- `src/app/api/cron/integration-tasks/route.ts` — the drain loop; this
  ADR freezes the call-site as `dispatch(task)`.
- `ONEACE-FULL-STACK-AUDIT-v1.3.md §5.53` — the F-09 finding this remediation
  traces back to.
