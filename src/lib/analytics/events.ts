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
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

/**
 * Events that cannot be wired from the current app surface — usually
 * because they need "is this the user's first X?" logic that doesn't
 * exist yet. Listed here so future audit passes don't re-discover
 * them as gaps; each has a JSDoc note explaining the unblocker.
 */
export const PlannedAnalyticsEvents = {
  /** Needs per-user first-event tracking (e.g. `user.firstItemAt`). */
  FIRST_ITEM_CREATED: "first_item_created",
  /** Needs per-user first-event tracking (e.g. `user.firstWarehouseAt`). */
  FIRST_WAREHOUSE_CREATED: "first_warehouse_created",
  /** Needs per-user first-event tracking (e.g. `user.firstScanAt`). */
  FIRST_SCAN: "first_scan",
  /** Needs per-user first-event tracking (e.g. `user.firstCountAt`). */
  FIRST_COUNT_COMPLETED: "first_count_completed",

  // --- Conversion (wiring lives in Stripe webhook / server-side) ---
  /** Wired from server-side billing webhook once receipts ship. */
  UPGRADE_CLICKED: "upgrade_clicked",
  /** Wired from server-side billing webhook once receipts ship. */
  CHECKOUT_STARTED: "checkout_started",
  /** Fires from Stripe webhook; queue for v1.2 (needs server sink). */
  SUBSCRIPTION_CREATED: "subscription_created",

  // --- Retention (wired inline with the respective create/view actions in v1.2) ---
  /** Queue for v1.2: item-create server action. */
  ITEM_CREATED: "item_created",
  /** Queue for v1.2: movement-log server action. */
  MOVEMENT_LOGGED: "movement_logged",
  /** Queue for v1.2: count-start server action. */
  COUNT_STARTED: "count_started",
  /** Queue for v1.2: per-report page mount effect. */
  REPORT_VIEWED: "report_viewed",
  /** Queue for v1.2: export action completion. */
  REPORT_EXPORTED: "report_exported",
  /** Queue for v1.2: PO-create server action. */
  PO_CREATED: "po_created",

  // --- Feature adoption (queued) ---
  /** Queue for v1.2: bin-create server action. */
  BIN_CREATED: "bin_created",
  /** Queue for v1.2: scanner success handler (needs debounce). */
  BARCODE_SCANNED: "barcode_scanned",
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
