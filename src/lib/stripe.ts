/**
 * Phase 12.3 + 15.1 — Stripe client initialisation and plan/interval mapping.
 *
 * Phase 15.1 adds annual billing support:
 *   - BillingInterval type ("month" | "year")
 *   - stripePriceIdForPlan(plan, interval) — now accepts interval param
 *   - planForStripePriceId(priceId) — handles BOTH monthly and yearly price IDs
 *   - hasAnnualBilling — true when yearly price IDs are configured
 *   - ANNUAL_DISCOUNT_PCT — shared constant for UI discount display
 *
 * Design rules:
 *   - Never throw at module load if env vars are missing.
 *   - Never mark a user as paid without a webhook-confirmed subscription update.
 *   - Interval is a checkout-time dimension; plan tier (FREE/PRO/BUSINESS) is unchanged.
 *   - Annual and monthly subscriptions both map to the same plan tier.
 *   - Monthly billing continues to work unchanged when yearly price IDs are absent.
 */

import Stripe from "stripe";

import { env } from "@/lib/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Billing frequency. Determines which Stripe price ID is used. */
export type BillingInterval = "month" | "year";

// ---------------------------------------------------------------------------
// Client initialisation
// ---------------------------------------------------------------------------

/**
 * True when Stripe is fully configured (secret key + webhook secret).
 * Used as a gate in all billing routes.
 */
export const hasStripe = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);

/**
 * True when annual price IDs are configured.
 * When false, the pricing page toggle is hidden and annual checkout is disabled.
 */
export const hasAnnualBilling = Boolean(
  env.STRIPE_PRO_YEARLY_PRICE_ID || env.STRIPE_BUSINESS_YEARLY_PRICE_ID,
);

/**
 * Approximate annual discount shown on the pricing page.
 * $29/mo × 12 = $348. Annual = $276 ($23/mo). Savings: ~20.7%.
 */
export const ANNUAL_DISCOUNT_PCT = 20;

/**
 * Annual prices in USD cents/month equivalent (for display).
 * Monthly: PRO $29, BUSINESS $79
 * Annual:  PRO $23/mo ($276/yr), BUSINESS $63/mo ($756/yr)
 */
export const ANNUAL_MONTHLY_EQUIVALENT: Record<"PRO" | "BUSINESS", number> = {
  PRO: 23,
  BUSINESS: 63,
};

/**
 * Annual prices in USD (total yearly amount billed upfront).
 */
export const ANNUAL_TOTAL_PRICE: Record<"PRO" | "BUSINESS", number> = {
  PRO: 276,
  BUSINESS: 756,
};

// ---------------------------------------------------------------------------
// Stripe SDK client
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Plan ↔ Price ID mapping
// ---------------------------------------------------------------------------

/**
 * Map plan + interval to the corresponding Stripe Price ID.
 *
 * Returns null when:
 *   - plan is FREE (no subscription needed)
 *   - the price ID env var is not configured
 *   - interval is "year" but yearly price IDs are not configured
 *     (callers should fall back to monthly in this case)
 *
 * @param plan    - Plan tier ("PRO" | "BUSINESS")
 * @param interval - Billing interval (default: "month")
 */
export function stripePriceIdForPlan(
  plan: "PRO" | "BUSINESS",
  interval: BillingInterval = "month",
): string | null {
  if (interval === "year") {
    if (plan === "PRO") return env.STRIPE_PRO_YEARLY_PRICE_ID ?? null;
    if (plan === "BUSINESS") return env.STRIPE_BUSINESS_YEARLY_PRICE_ID ?? null;
    return null;
  }
  // Monthly (default)
  if (plan === "PRO") return env.STRIPE_PRO_PRICE_ID ?? null;
  if (plan === "BUSINESS") return env.STRIPE_BUSINESS_PRICE_ID ?? null;
  return null;
}

/**
 * Map a Stripe Price ID back to the OneAce plan tier.
 *
 * Phase 15.1: now checks BOTH monthly and yearly price IDs.
 * Annual and monthly subscriptions both yield the same plan tier.
 *
 * Used in webhook handlers to translate subscription line items → plan.
 */
export function planForStripePriceId(priceId: string): "PRO" | "BUSINESS" | null {
  // Monthly price IDs
  if (priceId === env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === env.STRIPE_BUSINESS_PRICE_ID) return "BUSINESS";
  // Annual price IDs (same tier, different interval)
  if (priceId === env.STRIPE_PRO_YEARLY_PRICE_ID) return "PRO";
  if (priceId === env.STRIPE_BUSINESS_YEARLY_PRICE_ID) return "BUSINESS";
  return null;
}

/**
 * Determine the billing interval from a Stripe Price ID.
 * Returns null when the price ID is not recognized.
 */
export function intervalForStripePriceId(priceId: string): BillingInterval | null {
  if (priceId === env.STRIPE_PRO_PRICE_ID || priceId === env.STRIPE_BUSINESS_PRICE_ID) {
    return "month";
  }
  if (
    priceId === env.STRIPE_PRO_YEARLY_PRICE_ID ||
    priceId === env.STRIPE_BUSINESS_YEARLY_PRICE_ID
  ) {
    return "year";
  }
  return null;
}
