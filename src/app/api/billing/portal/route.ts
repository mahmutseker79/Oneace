/**
 * @openapi-tag: /billing/portal
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
"use server";

import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hasCapability } from "@/lib/permissions";
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

  // P0-1 remediation: centralized capability check.
  if (!hasCapability(membership.role, "org.billing")) {
    return NextResponse.json(
      { error: "You do not have permission to access billing." },
      { status: 403 },
    );
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

  // Phase 1 UX — ?portal=1 on return URL triggers a server-side data
  // refresh so the billing page reflects changes made in the portal
  // (e.g. plan downgrade, payment method update, cancellation).
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appUrl}/settings/billing?portal=1`,
  });

  return NextResponse.json({ url: session.url });
}
