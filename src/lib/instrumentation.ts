/**
 * P3-5 (audit v1.0 §10.4) — minimal product-telemetry facade.
 *
 * Problem the audit described:
 * --------------------------------
 * Billing, analytics/events, and Sentry are each wired into the
 * product at *different* seams. `billing-client.tsx` imports
 * `track` directly from `@vercel/analytics`; `lib/analytics/events`
 * wraps PostHog with its own `trackEvent`; Sentry breadcrumbs are
 * set from random call sites. There is no single place where a
 * feature author can emit a product event and trust that it
 * reaches every configured sink — so new features tend to skip
 * telemetry entirely, and the drift compounds.
 *
 * Scope of this shim:
 * --------------------------------
 * This module is intentionally the thinnest possible facade so
 * it can land without waiting on a full telemetry migration
 * (which would be a Phase-7+ project). It MUST:
 *
 *   1. Expose a single `track(event, props?)` entry point that is
 *      safe to call on the server (no-op), during SSR (no-op),
 *      and in the browser (fan-out to available sinks).
 *   2. Fan out to PostHog (via `window.posthog`) and Vercel
 *      Analytics (via `@vercel/analytics`) when each is present.
 *      A missing sink is not an error — the call is a no-op for
 *      that sink only.
 *   3. Never throw. Telemetry failures must not break a user
 *      action; the audit explicitly called out `track()` calls
 *      that threw inside a transition breaking the transition.
 *   4. Allow unit tests to observe fan-out without wiring a real
 *      browser — exported `__registerTestSink` and
 *      `__clearTestSinks` are the seam.
 *
 * Explicit non-goals:
 * --------------------------------
 * * Typed event registry. `lib/analytics/events` already owns
 *   the taxonomy via `AnalyticsEvents`; duplicating it here
 *   would fork the source of truth. `track()` takes a plain
 *   `string` and callers are expected to pass an
 *   `AnalyticsEvents.*` constant.
 * * Server-side dispatch. Server events belong in audit-log
 *   (`src/lib/audit.ts`) or Sentry breadcrumbs today. If that
 *   changes, extend this facade — do not fork it.
 */

type Props = Record<string, unknown> | undefined;

/** A test sink — registered by tests, invoked on every track(). */
type TestSink = (event: string, props: Props) => void;
const testSinks: TestSink[] = [];

/**
 * Track a product event.
 *
 * - Server / SSR: no-op (returns immediately).
 * - Browser: fans out to every configured sink; swallows any
 *   throw so a failing sink can't break the caller.
 * - Tests: additionally dispatches to every registered test sink.
 *
 * Intentionally synchronous so callers can use it inline inside a
 * `startTransition(() => { ... })` without chaining a promise.
 * The Vercel Analytics `track` is fire-and-forget; PostHog's
 * `capture` is likewise sync (it queues internally). If a future
 * sink is async, wrap it here, don't leak it to callers.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  // Always dispatch to test sinks first, regardless of environment.
  // This lets `vitest` assert a track() call happened without
  // needing to stub `window.posthog` or mock `@vercel/analytics`.
  for (const sink of testSinks) {
    try {
      sink(event, props);
    } catch {
      // Test sink failures are swallowed to keep the invariant
      // "track() never throws". A test that wants a hard failure
      // can `expect(sink).toHaveBeenCalledWith(...)` on a spy.
    }
  }

  // Server / SSR short-circuit. No window → no browser sinks.
  if (typeof window === "undefined") return;

  // Browser fan-out. Each sink is its own try/catch because one
  // sink throwing must not prevent the others from receiving the
  // event.
  try {
    const posthog = (window as { posthog?: { capture?: (e: string, p?: Props) => void } }).posthog;
    posthog?.capture?.(event, props);
  } catch {
    // posthog failures are silent by design. An audit breadcrumb
    // would itself require a sink; don't infinite-loop.
  }

  // Vercel Analytics is loaded as a <script> by the Analytics
  // component and attaches `window.va`. We call it through the
  // global rather than importing `@vercel/analytics` directly
  // because that package's `track()` triggers the client bundle
  // even on server imports. Guarded with typeof checks so SSR
  // stays a no-op.
  try {
    const va = (window as { va?: (action: "event", payload: { name: string; data?: Props }) => void }).va;
    va?.("event", { name: event, data: props });
  } catch {
    // Same rationale as posthog — swallow.
  }
}

/**
 * Register a sink for tests. Returns a dispose function.
 * Use inside `beforeEach` to capture events for assertion.
 */
export function __registerTestSink(sink: TestSink): () => void {
  testSinks.push(sink);
  return () => {
    const idx = testSinks.indexOf(sink);
    if (idx !== -1) testSinks.splice(idx, 1);
  };
}

/** Drop every registered test sink. Safe to call between tests. */
export function __clearTestSinks(): void {
  testSinks.length = 0;
}
