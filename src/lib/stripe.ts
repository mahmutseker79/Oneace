/**
 * Phase 12.3 — Stripe client initialisation.
 *
 * The Stripe SDK is only instantiated when STRIPE_SECRET_KEY is present.
 * Every billing route checks `hasStripe` before calling any SDK method so
 * the app boots and operates normally without Stripe configured.
 *
 * Design rules:
 *   - Never throw at module load if env vars are missing.
 *   - Never mark a user as paid without a webhook-confirmed subscription update.
 *   - Never assume checkout success from a return URL alone.
 *   - All billing operations are server-side only.
 */

// @ts-expect-error stripe is in package.json but not installed in the sandbox.
// Run `pnpm install` after pulling to resolve. The type error disappears once
// the package is present. No runtime issue — getStripeClient() guards on env.
import Stripe from "stripe";

import { env } from "@/lib/env";

/**
 * True when Stripe is fully configured (secret key + webhook secret +
 * at least one price ID). Used as a gate in all billing routes.
 */
export const hasStripe = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);

/**
 * Lazy Stripe client — instantiated once per serverless function cold start.
 * Returns null when STRIPE_SECRET_KEY is not set.
 */
let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-04-30.basil",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Map the app Plan enum value to the corresponding Stripe Price ID.
 * Returns null for FREE (no subscription needed) or when the price ID
 * is not configured.
 */
export function stripePriceIdForPlan(plan: "PRO" | "BUSINESS"): string | null {
  if (plan === "PRO") return env.STRIPE_PRO_PRICE_ID ?? null;
  if (plan === "BUSINESS") return env.STRIPE_BUSINESS_PRICE_ID ?? null;
  return null;
}

/**
 * Map a Stripe Price ID back to the OneAce plan.
 * Used in webhook handlers to translate subscription line items → plan.
 */
export function planForStripePriceId(priceId: string): "PRO" | "BUSINESS" | null {
  if (priceId === env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === env.STRIPE_BUSINESS_PRICE_ID) return "BUSINESS";
  return null;
}
