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
 * P3-3 bonus (audit v1.1 §7.4) — PII denylist.
 *
 * Callers occasionally slip personal data into `track()` props by
 * passing a whole entity (e.g. `track("user.invited", user)`). Once
 * a key lands in PostHog or Vercel Analytics it's effectively
 * permanent and flags us under GDPR. The denylist runs before every
 * sink and strips any key that matches a denied name (case-insensitive,
 * exact match on normalized key), replacing the value with the string
 * "[redacted:key-denied]" so the event shape stays intact for
 * downstream dashboards but the PII leaves.
 *
 * The denylist is intentionally conservative — it catches the keys
 * product code commonly mis-passes. New sensitive keys go here, not
 * in callers.
 */
export const PII_DENYLIST: readonly string[] = [
  "email",
  "emailaddress",
  "phone",
  "phonenumber",
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "secret",
  "otp",
  "totp",
  "ssn",
  "creditcard",
  "cardnumber",
  "cvv",
  "address",
  "streetaddress",
  "firstname",
  "lastname",
  "fullname",
  "dob",
  "dateofbirth",
  "ip",
  "ipaddress",
];

const DENIED = new Set(PII_DENYLIST);

/** Normalize a key name: lowercase, strip non-alphanumerics. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Remove denied keys from a props object. Returns a shallow copy —
 * callers' objects are never mutated. Unknown / non-denied keys pass
 * through untouched. Nested objects are NOT walked; callers should
 * flatten before tracking (the audit explicitly called out that
 * tracking a whole user object is the anti-pattern — do not "fix"
 * this by deep-walking).
 */
export function scrubPII(props: Props): Props {
  if (!props) return props;
  let scrubbed: Record<string, unknown> | null = null;
  for (const key of Object.keys(props)) {
    if (DENIED.has(normalizeKey(key))) {
      if (scrubbed === null) scrubbed = { ...props };
      scrubbed[key] = "[redacted:key-denied]";
    }
  }
  return scrubbed ?? props;
}

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
  // §7.4 PII denylist runs once, before fan-out. Every downstream
  // sink — including test sinks — sees the scrubbed payload so tests
  // that assert "track() was called with X" also assert the PII
  // redaction contract. Scrubbing is a no-op on empty props.
  const scrubbed = scrubPII(props);

  // Always dispatch to test sinks first, regardless of environment.
  // This lets `vitest` assert a track() call happened without
  // needing to stub `window.posthog` or mock `@vercel/analytics`.
  for (const sink of testSinks) {
    try {
      sink(event, scrubbed);
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
    posthog?.capture?.(event, scrubbed);
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
    va?.("event", { name: event, data: scrubbed });
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
