/**
 * Phase 12.3 — Stripe webhook handler.
 *
 * Route: POST /api/billing/webhook
 * Public: yes — Stripe POSTs here from outside; no session cookie.
 * Auth: Stripe signature verification using STRIPE_WEBHOOK_SECRET.
 *
 * Handled events:
 *   checkout.session.completed   — subscription payment confirmed
 *   customer.subscription.updated — plan change / renewal
 *   customer.subscription.deleted — cancellation / lapse
 *
 * Safety rules:
 *   - Raw body must be read before any parsing (Stripe signature check needs it).
 *   - Plan is ONLY updated after signature verification.
 *   - Unknown events are acknowledged (200) and silently ignored.
 *   - Stripe customer lookup is by stripeCustomerId, not by org id in metadata
 *     alone, to prevent spoofed metadata attacks.
 *   - Missing env vars return 503 so Stripe knows to retry later.
 */

import { type NextRequest, NextResponse } from "next/server";
// @ts-expect-error stripe is in package.json; run `pnpm install` to resolve.
import type Stripe from "stripe";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getStripeClient, hasStripe, planForStripePriceId } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  if (!hasStripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe unavailable." }, { status: 503 });
  }

  // Stripe requires the raw body for signature verification.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    logger.warn("stripe webhook: signature verification failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  logger.info("stripe webhook received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        // Unhandled event type — acknowledge and ignore.
        logger.debug("stripe webhook: unhandled event type", { type: event.type });
    }
  } catch (err) {
    logger.error("stripe webhook: handler failed", {
      type: event.type,
      err: err instanceof Error ? err.message : String(err),
    });
    // Return 500 so Stripe retries the event.
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (!customerId) return;

  const planName = (session.metadata?.plan ?? null) as "PRO" | "BUSINESS" | null;
  if (!planName) return;

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan: planName,
      stripeSubscriptionId: subscriptionId ?? undefined,
    },
  });

  logger.info("stripe: plan activated via checkout", { customerId, plan: planName });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  if (!priceId) return;

  const plan = planForStripePriceId(priceId);
  if (!plan) {
    logger.warn("stripe: unknown priceId on subscription.updated", { priceId });
    return;
  }

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: { plan, stripeSubscriptionId: subscription.id },
  });

  logger.info("stripe: plan updated via subscription change", { customerId, plan });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  // Cancelled subscription → revert to FREE
  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: { plan: "FREE", stripeSubscriptionId: null },
  });

  logger.info("stripe: plan reverted to FREE on subscription deletion", { customerId });
}
