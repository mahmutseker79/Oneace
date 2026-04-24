/**
 * Audit v1.3 §5.53 F-09 — Integration task dispatch registry.
 *
 * This module is the single seam between the generic queue drain
 * (`/api/cron/integration-tasks/route.ts`) and the 15 adapter-
 * specific handlers (shopify, quickbooks, amazon, …).
 *
 * Why a registry instead of a switch? See `docs/ADR-005-integration-
 * handler-registry.md`. Short version:
 *
 *   - The cron route should stay thin; adapter PRs should never
 *     touch it.
 *   - A module-level Map keyed by `kind:taskKind` is the simplest
 *     thing that lets every adapter PR be a one-file add.
 *   - An unregistered key must throw `SCHEMA_UNWIRED_ADAPTER` so
 *     `classifyError()` routes it to `schema-mismatch` — partially
 *     wired adapters surface on the DLQ dashboard instead of
 *     silently looping.
 *
 * Load order: every adapter ships a sibling `register.ts` that
 * calls `registerHandler(...)` at module top-level (side-effect
 * import). The cron route imports a single barrel at
 * `src/lib/integrations/handlers` before any request handler runs,
 * so the first cold-lambda drain sees a fully populated registry.
 */

import type { ClaimedTask } from "./task-queue";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/** Matches an adapter directory name under `src/lib/integrations/`. */
export type IntegrationKind = string;

/** Adapter-defined, documented in that adapter's README. */
export type TaskKind = string;

/**
 * A dispatch handler. Must re-throw on failure so the cron loop's
 * `markFailure` sees a classifier-friendly error. Handlers MUST NOT
 * absorb errors, log-and-swallow, or enqueue follow-up retries —
 * the queue layer owns all retry scheduling.
 *
 * Handlers SHOULD stamp thrown errors with a `code` following the
 * `classifyError` convention: `AUTH_*`, `REFRESH_*`, `RATE_LIMIT_*`,
 * `SCHEMA_*`, `TRANSPORT_*`, or `HTTP_<status>`. An untagged throw
 * falls into the `unknown` bucket, which is valid but defeats
 * per-kind alerting.
 */
export type TaskHandler = (task: ClaimedTask) => Promise<void>;

// ─────────────────────────────────────────────────────────────────
// Registry state
// ─────────────────────────────────────────────────────────────────

/**
 * Key format: `${integrationKind}:${taskKind}`. Lowercased so
 * adapter-PR typos like `Shopify` vs `shopify` don't split the
 * registry silently.
 */
const registry = new Map<string, TaskHandler>();

function keyOf(integrationKind: IntegrationKind, taskKind: TaskKind): string {
  return `${integrationKind.toLowerCase()}:${taskKind.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Register a handler for `(integrationKind, taskKind)`. First
 * registration wins; a second registration for the same key throws
 * synchronously at module-load time. That turns a "two files
 * register the same handler" bug into a cold-start crash rather
 * than a 30-minutes-later mystery.
 */
export function registerHandler(
  integrationKind: IntegrationKind,
  taskKind: TaskKind,
  fn: TaskHandler,
): void {
  const key = keyOf(integrationKind, taskKind);
  if (registry.has(key)) {
    throw new Error(
      `task-dispatch-registry: duplicate registration for "${key}" — each (integrationKind, taskKind) pair must be registered exactly once (audit §5.53 F-09)`,
    );
  }
  registry.set(key, fn);
}

/**
 * Dispatch a claimed task to its registered handler. Throws
 * `SCHEMA_UNWIRED_ADAPTER` if no handler is registered — this
 * routes through `classifyError()` into the `schema-mismatch`
 * bucket and eventually the DLQ so ops sees a partially-wired
 * adapter surface.
 */
export async function dispatch(task: ClaimedTask): Promise<void> {
  const key = keyOf(task.integrationKind, task.taskKind);
  const handler = registry.get(key);
  if (!handler) {
    const err = new Error(
      `No handler registered for integrationKind="${task.integrationKind}" taskKind="${task.taskKind}" (audit §5.53 F-09 adapter wiring pending)`,
    );
    (err as { code?: string }).code = "SCHEMA_UNWIRED_ADAPTER";
    throw err;
  }
  await handler(task);
}

// ─────────────────────────────────────────────────────────────────
// Test-only helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Returns `true` iff a handler is registered for the given pair.
 * Exported for tests; production code should never branch on this —
 * it should call `dispatch()` and let the `SCHEMA_UNWIRED_ADAPTER`
 * throw surface the wiring gap in the DLQ.
 */
export function hasHandler(integrationKind: IntegrationKind, taskKind: TaskKind): boolean {
  return registry.has(keyOf(integrationKind, taskKind));
}

/**
 * Reset the registry. Test-only. Do not import from production
 * code paths — a cold cron instance might race against a reset.
 */
export function __resetRegistryForTests(): void {
  registry.clear();
}

/**
 * Snapshot the currently-registered keys. Test-only; gives pinned
 * tests a stable way to assert "B-1 shopify wiring landed".
 */
export function __registeredKeysForTests(): string[] {
  return [...registry.keys()].sort();
}
