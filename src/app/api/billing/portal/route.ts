"use server";

import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireActiveMembership } from "@/lib/session";
import { getStripeClient, hasStripe } from "@/lib/stripe";

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Billing Portal session so the org OWNER/ADMIN can manage
 * their subscription, update payment methods, or cancel.
 *
 * Returns { url } on success, { error } on failure.
 *
 * Requires: authenticated session + OWNER or ADMIN role + existing Stripe customer.
 */
export async function POST(_request: NextRequest) {
  if (!hasStripe) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe client unavailable." }, { status: 503 });
  }

  let membership: Awaited<ReturnType<typeof requireActiveMembership>>["membership"];
  try {
    const auth = await requireActiveMembership();
    membership = auth.membership;
  } catch {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only OWNER or ADMIN can access billing." }, { status: 403 });
  }

  const org = await db.organization.findUnique({
    where: { id: membership.organizationId },
    select: { stripeCustomerId: true },
  });

  if (!org?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found. Start a subscription first." },
      { status: 404 },
    );
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appUrl}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
