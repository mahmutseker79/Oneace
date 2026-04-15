/**
 * Phase 12.3 + 14.1 + 16.1 — Stripe webhook handler.
 *
 * Route: POST /api/billing/webhook
 * Public: yes — Stripe POSTs here from outside; no session cookie.
 * Auth: Stripe signature verification using STRIPE_WEBHOOK_SECRET.
 *
 * Handled events:
 *   checkout.session.completed        — subscription payment confirmed
 *   customer.subscription.updated     — plan change / renewal / status / cancel_at_period_end
 *   customer.subscription.deleted     — explicit cancellation (period ended)
 *   invoice.payment_failed            — renewal payment failure (log + audit)
 *   invoice.payment_succeeded         — successful payment (recovery from past_due/unpaid)
 *
 * Phase 16.1 additions:
 *   - Webhook idempotency: Stripe event IDs are recorded in StripeWebhookEvent.
 *     Duplicate deliveries (Stripe retries) return 200 without reprocessing.
 *   - cancel_at_period_end support: when Stripe signals pending cancellation,
 *     we persist cancelAtPeriodEnd + cancelAt on the org and emit an audit event.
 *     Plan stays active until subscription.deleted fires.
 *   - invoice.payment_succeeded: restores paid plan when prior downgrade occurred.
 *   - billingInterval persistence: derived from price ID and stored on the org
 *     so the billing UI can show the correct interval after upgrade.
 *
 * Phase 16.2:
 *   - billingInterval written on checkout.session.completed and
 *     customer.subscription.updated (active path).
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
import { getMailer } from "@/lib/mail";
import {
  buildCancellationPendingEmail,
  buildPaymentFailedEmail,
  buildPaymentRecoveredEmail,
  buildPlanDowngradedEmail,
  buildUpgradeConfirmationEmail,
} from "@/lib/mail/templates/billing-emails";
import {
  getStripeClient,
  hasStripe,
  intervalForStripePriceId,
  planForStripePriceId,
} from "@/lib/stripe";

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

  // Phase 16.1 — Idempotency check.
  // Try to insert the event ID. If it already exists (unique constraint violation),
  // this is a retry delivery — return 200 without reprocessing.
  try {
    await db.stripeWebhookEvent.create({
      data: { eventId: event.id, eventType: event.type },
    });
  } catch (err) {
    // Prisma unique constraint violation code is P2002.
    const isUniqueViolation =
      err != null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002";
    if (isUniqueViolation) {
      logger.info("stripe webhook: duplicate event, skipping", { eventId: event.id });
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Any other DB error: fail so Stripe retries.
    logger.error("stripe webhook: idempotency check failed", {
      eventId: event.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Idempotency check failed." }, { status: 500 });
  }

  try {
    // Process the event. If processing fails, remove the idempotency record
    // so Stripe's retry delivery will reprocess it instead of being skipped.
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
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }
      default:
        logger.debug("stripe webhook: unhandled event type", { type: event.type });
    }
  } catch (err) {
    logger.error("Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    // Remove the idempotency record so Stripe's retry delivery will
    // reprocess this event instead of being silently skipped.
    try {
      await db.stripeWebhookEvent.delete({ where: { eventId: event.id } });
      logger.info("stripe webhook: removed failed event record for retry", { eventId: event.id });
    } catch (deleteErr) {
      logger.error("stripe webhook: failed to remove event record", {
        eventId: event.id,
        deleteErr: deleteErr instanceof Error ? deleteErr.message : String(deleteErr),
      });
    }

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
 *
 * Phase 16: also selects billingInterval and cancelAtPeriodEnd for
 * conditional logic, and OWNER's email/name for lifecycle emails.
 */
async function findOrgByCustomer(customerId: string): Promise<{
  id: string;
  name: string;
  plan: string;
  billingInterval: string;
  cancelAtPeriodEnd: boolean;
  ownerEmail: string | null;
  ownerName: string | null;
} | null> {
  const org = await db.organization.findUnique({
    where: { stripeCustomerId: customerId },
    select: {
      id: true,
      name: true,
      plan: true,
      billingInterval: true,
      cancelAtPeriodEnd: true,
      memberships: {
        where: { role: "OWNER" },
        select: { user: { select: { email: true, name: true } } },
        take: 1,
      },
    },
  });
  if (!org) return null;
  const owner = org.memberships[0]?.user ?? null;
  return {
    id: org.id,
    name: org.name,
    plan: org.plan,
    billingInterval: org.billingInterval,
    cancelAtPeriodEnd: org.cancelAtPeriodEnd,
    ownerEmail: owner?.email ?? null,
    ownerName: owner?.name ?? null,
  };
}

/**
 * Fire-and-forget lifecycle email helper.
 * Failures are logged but never bubble up to break webhook processing.
 */
function sendLifecycleEmail(
  to: string,
  email: { subject: string; text: string; html: string },
): void {
  void (async () => {
    try {
      const mailer = getMailer();
      await mailer.send({ to, ...email });
    } catch (err) {
      logger.warn("stripe webhook: lifecycle email send failed", {
        to,
        subject: email.subject,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  })();
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

  // Phase 16.2 — derive interval from metadata (set by checkout route).
  // Fall back to "month" if not present (e.g. old checkout sessions).
  const interval = session.metadata?.interval === "year" ? "year" : "month";

  const org = await findOrgByCustomer(customerId);
  const previousPlan = org?.plan ?? "FREE";

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan: planName,
      billingInterval: interval,
      stripeSubscriptionId: subscriptionId ?? undefined,
      // Clear any pending cancellation state (checkout = new/re-subscription).
      cancelAtPeriodEnd: false,
      cancelAt: null,
    },
  });

  logger.info("stripe: plan activated via checkout", { customerId, plan: planName, interval });

  if (org) {
    await recordAudit({
      organizationId: org.id,
      actorId: null,
      action: "billing.plan_upgraded",
      entityType: "billing",
      entityId: org.id,
      metadata: {
        previousPlan,
        newPlan: planName,
        billingInterval: interval,
        stripeCustomerId: customerId,
        source: "checkout.session.completed",
      },
    });

    // Phase 16.7 — upgrade confirmation email (fire-and-forget).
    if (org.ownerEmail) {
      const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";
      sendLifecycleEmail(
        org.ownerEmail,
        buildUpgradeConfirmationEmail({
          userName: org.ownerName ?? org.ownerEmail,
          orgName: org.name,
          appUrl,
          newPlan: planName,
          billingInterval: interval,
        }),
      );
    }
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
        data: {
          plan: "FREE",
          // Preserve billingInterval for potential recovery display.
          // Cancel state is irrelevant when already downgraded.
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
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

        // Phase 16.7 — downgrade email (fire-and-forget).
        if (org.ownerEmail) {
          const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";
          sendLifecycleEmail(
            org.ownerEmail,
            buildPlanDowngradedEmail({
              userName: org.ownerName ?? org.ownerEmail,
              orgName: org.name,
              appUrl,
              previousPlan,
              reason: "payment_failure",
            }),
          );
        }
      }
    }
    return;
  }

  // Phase 16.1 — Handle cancel_at_period_end BEFORE updating plan.
  // When cancel_at_period_end is true, the subscription is still active (paid)
  // but will not renew. We persist this state so the UI can show a warning.
  // The plan remains active — we do NOT downgrade here.
  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  const cancelAt = subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null;

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

  // Phase 16.2 — derive interval from the active price ID.
  const interval = intervalForStripePriceId(priceId) ?? "month";

  const org = await findOrgByCustomer(customerId);
  const previousPlan = org?.plan ?? "FREE";
  const previousCancelAtPeriodEnd = org?.cancelAtPeriodEnd ?? false;

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan,
      billingInterval: interval,
      stripeSubscriptionId: subscription.id,
      cancelAtPeriodEnd,
      cancelAt,
    },
  });

  logger.info("stripe: plan updated via subscription change", {
    customerId,
    plan,
    interval,
    status: subscription.status,
    cancelAtPeriodEnd,
  });

  if (org) {
    // Emit plan change audit if plan actually changed.
    if ((plan as string) !== previousPlan) {
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
          billingInterval: interval,
          stripeCustomerId: customerId,
          subscriptionStatus: subscription.status,
          source: "customer.subscription.updated",
        },
      });
    }

    // Phase 16.1 — Emit cancellation pending audit when state transitions to true.
    if (cancelAtPeriodEnd && !previousCancelAtPeriodEnd) {
      await recordAudit({
        organizationId: org.id,
        actorId: null,
        action: "billing.cancellation_pending",
        entityType: "billing",
        entityId: org.id,
        metadata: {
          plan,
          cancelAt: cancelAt?.toISOString() ?? null,
          stripeCustomerId: customerId,
          source: "customer.subscription.updated",
        },
      });

      // Phase 16.7 — cancellation pending email (fire-and-forget).
      if (org.ownerEmail && cancelAt) {
        const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";
        sendLifecycleEmail(
          org.ownerEmail,
          buildCancellationPendingEmail({
            userName: org.ownerName ?? org.ownerEmail,
            orgName: org.name,
            appUrl,
            currentPlan: plan,
            cancelAt: cancelAt.toISOString(),
          }),
        );
      }
    }

    // Phase 16.1 — Emit cancellation cleared audit when cancel_at_period_end is reversed.
    // This happens when a user re-enables a subscription they previously cancelled.
    if (!cancelAtPeriodEnd && previousCancelAtPeriodEnd) {
      await recordAudit({
        organizationId: org.id,
        actorId: null,
        action: "billing.cancellation_cleared",
        entityType: "billing",
        entityId: org.id,
        metadata: {
          plan,
          stripeCustomerId: customerId,
          source: "customer.subscription.updated",
        },
      });
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = resolveCustomerId(subscription.customer);
  if (!customerId) return;

  const org = await findOrgByCustomer(customerId);
  const previousPlan = org?.plan ?? "FREE";

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan: "FREE",
      stripeSubscriptionId: null,
      billingInterval: "month", // reset to default
      cancelAtPeriodEnd: false, // cancellation is now final
      cancelAt: null,
    },
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

    // Phase 16.7 — subscription ended email (fire-and-forget).
    if (org.ownerEmail) {
      const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";
      sendLifecycleEmail(
        org.ownerEmail,
        buildPlanDowngradedEmail({
          userName: org.ownerName ?? org.ownerEmail,
          orgName: org.name,
          appUrl,
          previousPlan,
          reason: "cancellation",
        }),
      );
    }
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

    // Phase 16.7 — payment failed email (fire-and-forget).
    if (org.ownerEmail) {
      const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";
      const nextAttemptDate = invoice.next_payment_attempt
        ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
            new Date(invoice.next_payment_attempt * 1000),
          )
        : null;
      sendLifecycleEmail(
        org.ownerEmail,
        buildPaymentFailedEmail({
          userName: org.ownerName ?? org.ownerEmail,
          orgName: org.name,
          appUrl,
          amountDue,
          currency,
          attemptCount: invoice.attempt_count ?? 1,
          nextAttemptDate,
        }),
      );
    }
  }
}

/**
 * Phase 16.1 — invoice.payment_succeeded handler.
 *
 * Fires on every successful invoice payment, including:
 *   - Initial subscription payment (handled by checkout.session.completed too)
 *   - Renewal payments (subscription continues — no plan change needed)
 *   - Recovery payments (payment succeeds after prior past_due/unpaid)
 *
 * The key case we handle here is recovery: if the org is currently on FREE
 * due to a prior payment failure + subscription.updated(past_due), and a
 * subsequent payment succeeds, we restore the paid plan from the subscription.
 *
 * Safety: We look up the active subscription to determine the plan, not
 * the invoice alone, to avoid reading stale data. If the org is already
 * on the correct plan (normal renewal), we emit no audit event.
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = resolveCustomerId(invoice.customer);
  if (!customerId) return;

  // Only handle subscription invoices (not one-off charges).
  if (!invoice.subscription) return;

  const org = await findOrgByCustomer(customerId);
  if (!org) return;

  // If the org is NOT on FREE, this is a normal renewal — nothing to restore.
  // (The subscription.updated handler already set the plan correctly.)
  if (org.plan !== "FREE") return;

  // Org is on FREE but a payment just succeeded — this is a recovery.
  // Fetch the actual subscription to derive the plan from the current price.
  const stripe = getStripeClient();
  if (!stripe) return;

  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription as { id: string }).id;

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    logger.warn("stripe: could not retrieve subscription for payment recovery", {
      customerId,
      subscriptionId,
      err: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // Only recover if the subscription is now active.
  if (subscription.status !== "active") {
    logger.info("stripe: payment succeeded but subscription not active, no recovery", {
      customerId,
      subscriptionStatus: subscription.status,
    });
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  if (!priceId) return;

  const plan = planForStripePriceId(priceId);
  if (!plan) {
    logger.warn("stripe: unknown priceId on payment recovery", { priceId, customerId });
    return;
  }

  const interval = intervalForStripePriceId(priceId) ?? "month";

  await db.organization.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan,
      billingInterval: interval,
      stripeSubscriptionId: subscriptionId,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    },
  });

  logger.info("stripe: plan restored via payment recovery", { customerId, plan, interval });

  await recordAudit({
    organizationId: org.id,
    actorId: null,
    action: "billing.payment_recovered",
    entityType: "billing",
    entityId: org.id,
    metadata: {
      restoredPlan: plan,
      billingInterval: interval,
      stripeCustomerId: customerId,
      invoiceId: invoice.id,
      subscriptionId,
      source: "invoice.payment_succeeded",
    },
  });

  // Phase 16.7 — payment recovered email (fire-and-forget).
  if (org.ownerEmail) {
    const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";
    sendLifecycleEmail(
      org.ownerEmail,
      buildPaymentRecoveredEmail({
        userName: org.ownerName ?? org.ownerEmail,
        orgName: org.name,
        appUrl,
        restoredPlan: plan,
        billingInterval: interval,
      }),
    );
  }
}
