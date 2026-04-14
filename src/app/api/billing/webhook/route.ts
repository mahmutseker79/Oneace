/**
 * Phase 12.3 + 14.1 — Stripe webhook handler.
 *
 * Route: POST /api/billing/webhook
 * Public: yes — Stripe POSTs here from outside; no session cookie.
 * Auth: Stripe signature verification using STRIPE_WEBHOOK_SECRET.
 *
 * Handled events:
 *   checkout.session.completed        — subscription payment confirmed
 *   customer.subscription.updated     — plan change / renewal / status change
 *   customer.subscription.deleted     — explicit cancellation
 *   invoice.payment_failed            — renewal payment failure (log + audit)
 *
 * Phase 14.1 fixes:
 *   - handleSubscriptionUpdated now checks subscription.status before
 *     updating the plan. past_due / unpaid / paused / canceled states all
 *     revert the org to FREE rather than keeping a paid plan active for
 *     a non-paying customer.
 *   - invoice.payment_failed is now handled — logs a structured warning
 *     and emits an audit event for OWNER/ADMIN visibility. Plan is NOT
 *     immediately downgraded here because Stripe has a retry schedule;
 *     the actual downgrade happens via subscription.updated → past_due.
 *   - All plan changes now emit a recordAudit event so OWNER/ADMIN can
 *     see billing history in the audit log.
 *
 * Safety rules (unchanged):
 *   - Raw body must be read before any parsing (Stripe signature check needs it).
 *   - Plan is ONLY updated after signature verification.
 *   - Unknown events are acknowledged (200) and silently ignored.
 *   - Stripe customer lookup is by stripeCustomerId, not by org id in metadata.
 *   - Missing env vars return 503 so Stripe knows to retry later.
 */

import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { recordAudit } from "@/lib/audit";
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
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET as string);
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
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
      default:
        logger.debug("stripe webhook: unhandled event type", { type: event.type });
    }
  } catch (err) {
    logger.error("stripe webhook: handler failed", {
      type: event.type,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the customer ID from a Stripe object that carries it as
 * either a string (ID) or an expanded Customer object.
 */
function resolveCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id;
}

/**
 * Look up the OneAce organization for a Stripe customer ID.
 * Returns null if not found (org may have been deleted, or event is for
 * a customer not yet linked to an org).
 */
async function findOrgByCustomer(customerId: string): Promise<{ id: string; plan: string } | null> {
  return db.organization.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, plan: true },
  });
}

// ---------------------------------------------------------------------------
// Subscription statuses that mean "this customer is not paying"
// ---------------------------------------------------------------------------

/**
 * Stripe subscription statuses that should revert the org to FREE.
 *
 * - past_due:  renewal failed, Stripe is retrying but payment not received
 * - unpaid:    renewal failed, Stripe gave up retrying
 * - canceled:  subscription explicitly cancelled (also handled by .deleted)
 * - paused:    subscription paused by the merchant (e.g. via billing portal)
 * - incomplete_expired: initial payment timed out and subscription expired
 *
 * Excluded (keep plan active):
 * - active:   subscription is paid and current
 * - trialing: free trial is in progress, convert to paid at trial end
 * - incomplete: initial payment pending — give benefit of doubt
 */
const INACTIVE_STATUSES = new Set([
  "past_due",
  "unpaid",
  "canceled",
  "paused",
  "incomplete_expired",
]);

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const customerId = resolveCustomerId(session.customer);
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);

  if (!customerId) return;

  const planName = (session.metadata?.plan ?? null) as "PRO" | "BUSINESS" | null;
  if (!planName) {
    logger.warn("stripe: checkout.session.completed missing plan metadata", { customerId });
    return;
  }

  const org = await findOrgByCustomer(customerId);
  const previousPlan = org?.plan ?? "FREE";

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan: planName,
      stripeSubscriptionId: subscriptionId ?? undefined,
    },
  });

  logger.info("stripe: plan activated via checkout", { customerId, plan: planName });

  if (org) {
    await recordAudit({
      organizationId: org.id,
      actorId: null, // system-initiated
      action: "billing.plan_upgraded",
      entityType: "billing",
      entityId: org.id,
      metadata: {
        previousPlan,
        newPlan: planName,
        stripeCustomerId: customerId,
        source: "checkout.session.completed",
      },
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = resolveCustomerId(subscription.customer);
  if (!customerId) return;

  // Phase 14.1: check subscription status BEFORE deciding the plan.
  // Non-paying statuses (past_due, unpaid, paused, etc.) revert to FREE.
  if (INACTIVE_STATUSES.has(subscription.status)) {
    const org = await findOrgByCustomer(customerId);
    const previousPlan = org?.plan ?? "FREE";

    if (previousPlan !== "FREE") {
      await db.organization.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan: "FREE" },
      });

      logger.warn("stripe: plan reverted to FREE due to subscription status", {
        customerId,
        status: subscription.status,
        previousPlan,
      });

      if (org) {
        await recordAudit({
          organizationId: org.id,
          actorId: null,
          action: "billing.plan_downgraded",
          entityType: "billing",
          entityId: org.id,
          metadata: {
            previousPlan,
            newPlan: "FREE",
            stripeCustomerId: customerId,
            subscriptionStatus: subscription.status,
            source: "customer.subscription.updated",
          },
        });
      }
    }
    return;
  }

  // Subscription is active (or trialing) — update plan from price ID.
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  if (!priceId) return;

  const plan = planForStripePriceId(priceId);
  if (!plan) {
    logger.warn("stripe: unknown priceId on subscription.updated", {
      priceId,
      customerId,
      status: subscription.status,
    });
    return;
  }

  const org = await findOrgByCustomer(customerId);
  const previousPlan = org?.plan ?? "FREE";

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: { plan, stripeSubscriptionId: subscription.id },
  });

  logger.info("stripe: plan updated via subscription change", {
    customerId,
    plan,
    status: subscription.status,
  });

  if (org && (plan as string) !== previousPlan) {
    // plan is "PRO" | "BUSINESS"; previousPlan is the prior org.plan string.
    // Upgrade: was FREE and moving to any paid plan, OR PRO → BUSINESS.
    const isUpgrade = previousPlan === "FREE" || (previousPlan === "PRO" && plan === "BUSINESS");

    await recordAudit({
      organizationId: org.id,
      actorId: null,
      action: isUpgrade ? "billing.plan_upgraded" : "billing.plan_downgraded",
      entityType: "billing",
      entityId: org.id,
      metadata: {
        previousPlan,
        newPlan: plan,
        stripeCustomerId: customerId,
        subscriptionStatus: subscription.status,
        source: "customer.subscription.updated",
      },
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = resolveCustomerId(subscription.customer);
  if (!customerId) return;

  const org = await findOrgByCustomer(customerId);
  const previousPlan = org?.plan ?? "FREE";

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: { plan: "FREE", stripeSubscriptionId: null },
  });

  logger.info("stripe: plan reverted to FREE on subscription deletion", { customerId });

  if (org && previousPlan !== "FREE") {
    await recordAudit({
      organizationId: org.id,
      actorId: null,
      action: "billing.subscription_cancelled",
      entityType: "billing",
      entityId: org.id,
      metadata: {
        previousPlan,
        newPlan: "FREE",
        stripeCustomerId: customerId,
        source: "customer.subscription.deleted",
      },
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Payment failed — do NOT immediately downgrade.
  // Stripe will retry and send subscription.updated with past_due when retries
  // are exhausted. That's where the actual plan downgrade happens.
  // This handler logs the event and creates an audit trail only.

  const customerId = resolveCustomerId(invoice.customer);
  if (!customerId) return;

  const amountDue = invoice.amount_due ?? 0;
  const currency = invoice.currency ?? "usd";

  logger.warn("stripe: invoice payment failed", {
    customerId,
    invoiceId: invoice.id,
    amountDue,
    currency,
    attemptCount: invoice.attempt_count,
  });

  const org = await findOrgByCustomer(customerId);
  if (org) {
    await recordAudit({
      organizationId: org.id,
      actorId: null,
      action: "billing.payment_failed",
      entityType: "billing",
      entityId: org.id,
      metadata: {
        stripeCustomerId: customerId,
        invoiceId: invoice.id,
        amountDue,
        currency,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt,
      },
    });
  }
}
