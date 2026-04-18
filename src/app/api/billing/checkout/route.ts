"use server";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import {
  type BillingInterval,
  getStripeClient,
  hasStripe,
  stripePriceIdForPlan,
} from "@/lib/stripe";

// P3-3 (audit v1.1 §5.30) — replace inline body validation with zod.
// `interval` silently fell back to "month" on unknown values before,
// which is a user-visible footgun (yearly selection silently downgrades
// without a 400). We now reject unknown intervals explicitly.
const checkoutBodySchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
  interval: z.enum(["month", "year"]).default("month"),
});

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for a subscription upgrade.
 *
 * Body: { plan: "PRO" | "BUSINESS" }
 *
 * Requires: authenticated session + OWNER or ADMIN role (only they can
 * change billing). Returns { url } on success, { error } on failure.
 *
 * Safety:
 *   - Does NOT mark the org as paid. Plan state is only updated by
 *     the webhook handler after Stripe confirms payment.
 *   - Reuses an existing Stripe customer if stripeCustomerId is already
 *     set on the org, so a second checkout attempt doesn't create
 *     a duplicate customer.
 *   - Returns 503 cleanly when Stripe is not configured.
 */
export async function POST(request: NextRequest) {
  if (!hasStripe) {
    return NextResponse.json(
      { error: "Billing is not configured. Set Stripe env vars." },
      { status: 503 },
    );
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe client unavailable." }, { status: 503 });
  }

  // Auth
  let membership: Awaited<ReturnType<typeof requireActiveMembership>>["membership"];
  try {
    const auth = await requireActiveMembership();
    membership = auth.membership;
  } catch {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  // P0-1 remediation: centralized capability check. Previously this used
  // an inline role comparison that drifted from the permissions module and
  // would need to be updated by hand if the billing role set ever changed.
  if (!hasCapability(membership.role, "org.billing")) {
    return NextResponse.json(
      { error: "You do not have permission to manage billing." },
      { status: 403 },
    );
  }

  // Parse body — §5.30: zod schema above owns the plan + interval
  // contract. A malformed JSON or an unknown value is a 400; the old
  // inline check silently downgraded unknown intervals to "month".
  let plan: "PRO" | "BUSINESS";
  let interval: BillingInterval;
  try {
    const raw = await request.json();
    const parsed = checkoutBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    plan = parsed.data.plan;
    interval = parsed.data.interval;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const priceId = stripePriceIdForPlan(plan, interval);
  if (!priceId) {
    // If yearly price ID not configured, fall back to monthly
    const fallbackId = interval === "year" ? stripePriceIdForPlan(plan, "month") : null;
    if (fallbackId) {
      interval = "month";
    } else {
      return NextResponse.json(
        { error: `Price ID for ${plan} plan is not configured.` },
        { status: 503 },
      );
    }
  }

  // Re-resolve after potential fallback. At this point interval has been
  // validated (possibly downgraded to "month" if yearly wasn't configured),
  // so the result is guaranteed non-null.
  const resolvedPriceId = stripePriceIdForPlan(plan, interval) as string;

  // Load org to get or create Stripe customer
  const org = await db.organization.findUnique({
    where: { id: membership.organizationId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  // Reuse existing Stripe customer or create a new one
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { organizationId: org.id },
    });
    customerId = customer.id;
    await db.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customer.id },
    });
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url: `${appUrl}/settings/billing?cancelled=1`,
    metadata: { organizationId: org.id, plan, interval },
    // Allow promo codes
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { organizationId: org.id, plan, interval },
    },
  });

  return NextResponse.json({ url: session.url });
}
