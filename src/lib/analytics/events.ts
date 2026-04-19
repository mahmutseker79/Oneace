/**
 * PostHog Event Taxonomy
 *
 * Audit v1.1 §5.20 reorganization:
 * -------------------------------------
 * v1.0 defined 19 event constants but only 1 had a call site in the
 * app — a textbook "measurement theater" shape where the taxonomy
 * looks comprehensive in code but the dashboard is empty. To fix this
 * without kicking a full telemetry rewrite into Phase 2.2, the
 * constants are now split into two named objects:
 *
 *   - `AnalyticsEvents` — events that are *wired* to at least one
 *     call site via `track()` from `@/lib/instrumentation`. Adding a
 *     new entry here requires a matching call site; a pinned test
 *     enforces the invariant.
 *
 *   - `PlannedAnalyticsEvents` — events that cannot be wired with
 *     current infrastructure (usually "first-time X" events, which
 *     need a per-user state lookup). Kept here so the taxonomy is
 *     visible and PRs can light them up once the enabling
 *     infrastructure lands. Each entry carries a JSDoc note with
 *     the unblocker.
 *
 * Call sites must use the `track()` facade in
 * `@/lib/instrumentation`, which fans out to PostHog + Vercel
 * Analytics + test sinks. `trackEvent()` below is a deprecated alias
 * retained only so existing call sites don't break — new code uses
 * `track()`.
 */

export const AnalyticsEvents = {
  // --- Activation (wired) ---
  SIGNUP_COMPLETED: "signup_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // --- Feature adoption (wired) ---
  TWO_FACTOR_ENABLED: "two_factor_enabled",
  ITEM_IMAGE_UPLOADED: "item_image_uploaded",

  // --- v1.2 §5.33 — activation call-site follow-through ---
  // These lived in PlannedAnalyticsEvents at v1.1 close because the
  // enabling seams (server-action return shape for first-event detection,
  // client-side track() placement) weren't wired yet. v1.2 Phase-3.1
  // adds: (a) an `isFirst` boolean on create/complete server actions
  // computed from a Prisma count === 0 check within the same request,
  // (b) a `track()` call-site in the companion client form which fires
  // the one-time FIRST_* event when isFirst is true AND the steady-state
  // event (ITEM_CREATED / COUNT_STARTED / BARCODE_SCANNED) on every
  // success. Firing from the client form (not the server action) is
  // deliberate — `track()` is a no-op on the server, so placing it in
  // the form is what actually gets events into PostHog.
  ITEM_CREATED: "item_created",
  FIRST_ITEM_CREATED: "first_item_created",
  FIRST_WAREHOUSE_CREATED: "first_warehouse_created",
  COUNT_STARTED: "count_started",
  FIRST_COUNT_COMPLETED: "first_count_completed",
  BARCODE_SCANNED: "barcode_scanned",
  FIRST_SCAN: "first_scan",

  // --- v1.3 §5.52 F-08 — rate-limit 429 signal ---
  // Fires from middleware.ts whenever a request is rejected with
  // HTTP 429 by the default 120 req/min per-IP limiter. Before
  // v1.5.26 these 429s were silent in PostHog — a single abusive
  // tenant or a caller hot-looping an endpoint hit the limit
  // without any dashboard signal, so the only way we learned was
  // via a support ticket from the throttled caller.
  //
  // Emitted server-side. `track()` is a no-op on the server, so
  // middleware emits a structured `logger.warn` with `tag:
  // "rate_limit.hit"` — the log drain relays it to PostHog.
  // The constant still lives here so the taxonomy is one file.
  //
  // Payload shape (keys on the log line):
  //   - path (request pathname, e.g. "/api/items")
  //   - ip (first x-forwarded-for entry, or "unknown")
  //   - limit (the 120 req/min cap)
  //   - retryAfter (seconds until the window resets)
  //   - reset (epoch seconds when the window resets)
  // No PII; no user id, no auth header, no body.
  RATE_LIMIT_HIT: "rate_limit.hit",

  // --- v1.3 §5.51 F-07 — plan-limit friction signal ---
  // Fires client-side from a create/import form when the server action
  // returns `{ code: "PLAN_LIMIT" }`. The point is to make upgrade
  // friction VISIBLE in PostHog — the dependabot-burn lens of v1.3
  // also extends to silent limit hits: without this event, the only
  // signal that a Starter tenant is bouncing off the 100-item ceiling
  // is that the user stops using the product. With it, the funnel
  // shows `plan_limit_hit` → `upgrade_clicked` (or its absence) so
  // pricing can decide whether to adjust limits or nudge UI.
  // Payload: `{ limitKey, limit, current }` — enough to slice the
  // dashboard by which limit is hitting which tier, without leaking
  // PII (no item names, no userId — `track()` attaches posthog
  // distinct_id automatically for signed-in users).
  PLAN_LIMIT_HIT: "plan_limit_hit",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

/**
 * Events that cannot be wired from the current app surface — usually
 * because they need "is this the user's first X?" logic that doesn't
 * exist yet. Listed here so future audit passes don't re-discover
 * them as gaps; each has a JSDoc note explaining the unblocker.
 */
export const PlannedAnalyticsEvents = {
  // --- Conversion (wiring lives in Stripe webhook / server-side) ---
  /** Wired from server-side billing webhook once receipts ship. */
  UPGRADE_CLICKED: "upgrade_clicked",
  /** Wired from server-side billing webhook once receipts ship. */
  CHECKOUT_STARTED: "checkout_started",
  /** Fires from Stripe webhook; queue for v1.2 (needs server sink). */
  SUBSCRIPTION_CREATED: "subscription_created",

  // --- Retention (needs server-side sink — still blocked on v1.2 §7.x) ---
  /** Queue: movement-log server action — blocked on server-sink story. */
  MOVEMENT_LOGGED: "movement_logged",
  /** Queue: per-report page mount effect — blocked on SSR-safe track(). */
  REPORT_VIEWED: "report_viewed",
  /** Queue: export action completion — blocked on server-sink story. */
  REPORT_EXPORTED: "report_exported",
  /** Queue: PO-create server action — blocked on server-sink story. */
  PO_CREATED: "po_created",

  // --- Feature adoption (queued) ---
  /** Queue for v1.3: bin-create server action. */
  BIN_CREATED: "bin_created",
} as const;

interface PostHogClient {
  capture?: (event: string, properties?: Record<string, unknown>) => void;
  identify?: (userId: string, properties?: Record<string, unknown>) => void;
  reset?: () => void;
}

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

/**
 * @deprecated Use `track()` from `@/lib/instrumentation` instead.
 *
 * `track()` fans out to PostHog AND Vercel Analytics AND test sinks
 * via a single entry point, while this function only covers PostHog
 * and silently drops events on the server (no SSR warning). Retained
 * for transitional back-compat; callers should migrate.
 */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    const posthog = window.posthog;
    if (posthog?.capture) {
      posthog.capture(event, properties);
    }
  } catch (err) {
    console.debug("Failed to track event:", err);
  }
}

/**
 * Identify the current user.
 * Called after login/signup to set user properties.
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    const posthog = window.posthog;
    if (posthog?.identify) {
      posthog.identify(userId, properties);
    }
  } catch (err) {
    console.debug("Failed to identify user:", err);
  }
}

/**
 * Clear user identification (e.g., on logout).
 */
export function resetUser() {
  if (typeof window === "undefined") return;

  try {
    const posthog = window.posthog;
    if (posthog?.reset) {
      posthog.reset();
    }
  } catch (err) {
    console.debug("Failed to reset user:", err);
  }
}
