/**
 * PostHog Event Taxonomy
 *
 * Type-safe event definitions for product analytics.
 * All events are categorized by user journey stage:
 * - Activation: Getting users engaged
 * - Conversion: Monetization milestones
 * - Retention: Core feature usage
 * - Feature adoption: Advanced capabilities
 */

export const AnalyticsEvents = {
  // --- Activation events ---
  SIGNUP_COMPLETED: "signup_completed",
  FIRST_ITEM_CREATED: "first_item_created",
  FIRST_WAREHOUSE_CREATED: "first_warehouse_created",
  FIRST_SCAN: "first_scan",
  FIRST_COUNT_COMPLETED: "first_count_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // --- Conversion events ---
  UPGRADE_CLICKED: "upgrade_clicked",
  CHECKOUT_STARTED: "checkout_started",
  SUBSCRIPTION_CREATED: "subscription_created",

  // --- Retention events (core workflows) ---
  ITEM_CREATED: "item_created",
  MOVEMENT_LOGGED: "movement_logged",
  COUNT_STARTED: "count_started",
  REPORT_VIEWED: "report_viewed",
  REPORT_EXPORTED: "report_exported",
  PO_CREATED: "po_created",

  // --- Feature adoption ---
  TWO_FACTOR_ENABLED: "two_factor_enabled",
  BIN_CREATED: "bin_created",
  BARCODE_SCANNED: "barcode_scanned",
  ITEM_IMAGE_UPLOADED: "item_image_uploaded",
} as const;

/**
 * Track a product event with optional properties.
 *
 * Safe to call from client or server contexts. Returns silently if
 * PostHog is not initialized or key is not set.
 */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    const posthog = (window as any).posthog;
    if (posthog?.capture) {
      posthog.capture(event, properties);
    }
  } catch (err) {
    // Silently fail — analytics should never break the app
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
    const posthog = (window as any).posthog;
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
    const posthog = (window as any).posthog;
    if (posthog?.reset) {
      posthog.reset();
    }
  } catch (err) {
    console.debug("Failed to reset user:", err);
  }
}
