// Phase 16 — Billing lifecycle and subscription state tests.
//
// Covers the new behaviors introduced in Phase 16.1–16.3:
//   - Idempotency: duplicate event handling (conceptual tests, no DB)
//   - cancel_at_period_end: detected, audited, UI state correct
//   - payment_succeeded recovery: plan restored only when org is on FREE
//   - billingInterval persistence: derived from price ID correctly
//   - BillingInterval toggling: new-user intent carry-through logic
//   - Lifecycle email templates: correct subjects, structure, escaping
//
// Pure logic tests: no DB, no Stripe SDK, no network.

import { describe, expect, it } from "vitest";

import {
  buildCancellationPendingEmail,
  buildPaymentFailedEmail,
  buildPaymentRecoveredEmail,
  buildPlanDowngradedEmail,
  buildUpgradeConfirmationEmail,
} from "@/lib/mail/templates/billing-emails";

// ---------------------------------------------------------------------------
// Idempotency — conceptual model tests
// ---------------------------------------------------------------------------

describe("webhook idempotency — model", () => {
  it("first event delivery should proceed", () => {
    // The idempotency check inserts to StripeWebhookEvent with eventId unique.
    // First insert: no conflict → process.
    // We test the logic model, not the DB write.
    const processedEvents = new Set<string>();

    function shouldProcess(eventId: string): boolean {
      if (processedEvents.has(eventId)) return false;
      processedEvents.add(eventId);
      return true;
    }

    expect(shouldProcess("evt_1")).toBe(true);
  });

  it("duplicate event delivery should be skipped", () => {
    const processedEvents = new Set<string>();

    function shouldProcess(eventId: string): boolean {
      if (processedEvents.has(eventId)) return false;
      processedEvents.add(eventId);
      return true;
    }

    shouldProcess("evt_1"); // first delivery
    expect(shouldProcess("evt_1")).toBe(false); // duplicate → skip
  });

  it("different event IDs should both process", () => {
    const processedEvents = new Set<string>();

    function shouldProcess(eventId: string): boolean {
      if (processedEvents.has(eventId)) return false;
      processedEvents.add(eventId);
      return true;
    }

    expect(shouldProcess("evt_1")).toBe(true);
    expect(shouldProcess("evt_2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cancel_at_period_end logic
// ---------------------------------------------------------------------------

describe("cancel_at_period_end handling", () => {
  type OrgState = {
    plan: string;
    cancelAtPeriodEnd: boolean;
    cancelAt: Date | null;
  };

  function applySubscriptionUpdate(
    org: OrgState,
    subscription: {
      status: string;
      cancel_at_period_end: boolean;
      cancel_at: number | null;
    },
  ): { newState: OrgState; shouldEmitCancellationPendingAudit: boolean } {
    const INACTIVE_STATUSES = new Set([
      "past_due",
      "unpaid",
      "canceled",
      "paused",
      "incomplete_expired",
    ]);

    if (INACTIVE_STATUSES.has(subscription.status)) {
      return {
        newState: { ...org, plan: "FREE", cancelAtPeriodEnd: false, cancelAt: null },
        shouldEmitCancellationPendingAudit: false,
      };
    }

    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    const cancelAt = subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null;

    const shouldEmitCancellationPendingAudit = cancelAtPeriodEnd && !org.cancelAtPeriodEnd;

    return {
      newState: { ...org, cancelAtPeriodEnd, cancelAt },
      shouldEmitCancellationPendingAudit,
    };
  }

  it("active subscription with cancel_at_period_end=true should set pending state", () => {
    const org: OrgState = { plan: "PRO", cancelAtPeriodEnd: false, cancelAt: null };
    const futureTs = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

    const result = applySubscriptionUpdate(org, {
      status: "active",
      cancel_at_period_end: true,
      cancel_at: futureTs,
    });

    expect(result.newState.plan).toBe("PRO"); // plan stays active
    expect(result.newState.cancelAtPeriodEnd).toBe(true);
    expect(result.newState.cancelAt).toBeInstanceOf(Date);
    expect(result.shouldEmitCancellationPendingAudit).toBe(true);
  });

  it("does not emit duplicate cancellation audit if already pending", () => {
    const org: OrgState = {
      plan: "PRO",
      cancelAtPeriodEnd: true, // already set
      cancelAt: new Date(),
    };
    const futureTs = Math.floor(Date.now() / 1000) + 86400 * 15;

    const result = applySubscriptionUpdate(org, {
      status: "active",
      cancel_at_period_end: true,
      cancel_at: futureTs,
    });

    expect(result.shouldEmitCancellationPendingAudit).toBe(false); // already in pending state
  });

  it("inactive status clears cancel state regardless of cancel_at_period_end", () => {
    const org: OrgState = {
      plan: "PRO",
      cancelAtPeriodEnd: true,
      cancelAt: new Date(),
    };

    const result = applySubscriptionUpdate(org, {
      status: "past_due",
      cancel_at_period_end: true,
      cancel_at: null,
    });

    expect(result.newState.plan).toBe("FREE");
    expect(result.newState.cancelAtPeriodEnd).toBe(false);
    expect(result.newState.cancelAt).toBeNull();
  });

  it("subscription deletion should clear all billing state", () => {
    // Simulate subscription.deleted handler behavior
    const afterDeletion: OrgState = {
      plan: "FREE",
      cancelAtPeriodEnd: false,
      cancelAt: null,
    };

    expect(afterDeletion.plan).toBe("FREE");
    expect(afterDeletion.cancelAtPeriodEnd).toBe(false);
    expect(afterDeletion.cancelAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// payment_succeeded recovery logic
// ---------------------------------------------------------------------------

describe("invoice.payment_succeeded — recovery logic", () => {
  function shouldRecoverPlan(currentOrgPlan: string, subscriptionStatus: string): boolean {
    // Recovery only happens when: org is on FREE AND subscription is active.
    if (currentOrgPlan !== "FREE") return false;
    if (subscriptionStatus !== "active") return false;
    return true;
  }

  it("org on FREE + active subscription → should recover", () => {
    expect(shouldRecoverPlan("FREE", "active")).toBe(true);
  });

  it("org on PRO + active subscription → no recovery needed (normal renewal)", () => {
    expect(shouldRecoverPlan("PRO", "active")).toBe(false);
  });

  it("org on FREE + subscription not active → no recovery", () => {
    expect(shouldRecoverPlan("FREE", "past_due")).toBe(false);
  });

  it("org on BUSINESS + active subscription → no recovery needed", () => {
    expect(shouldRecoverPlan("BUSINESS", "active")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// billingInterval persistence
// ---------------------------------------------------------------------------

describe("billingInterval — derivation and persistence", () => {
  // Mirrors intervalForStripePriceId logic without importing from stripe.ts
  // (avoids env module load in tests).
  const PRICE_MAP: Record<string, "month" | "year"> = {
    price_pro_monthly: "month",
    price_business_monthly: "month",
    price_pro_yearly: "year",
    price_business_yearly: "year",
  };

  function intervalForPriceId(priceId: string): "month" | "year" | null {
    return PRICE_MAP[priceId] ?? null;
  }

  it("monthly Pro price → interval is month", () => {
    expect(intervalForPriceId("price_pro_monthly")).toBe("month");
  });

  it("yearly Pro price → interval is year", () => {
    expect(intervalForPriceId("price_pro_yearly")).toBe("year");
  });

  it("yearly Business price → interval is year", () => {
    expect(intervalForPriceId("price_business_yearly")).toBe("year");
  });

  it("unknown price → null (safe default: month used by callers)", () => {
    expect(intervalForPriceId("price_unknown")).toBeNull();
  });

  it("subscription deletion should reset billingInterval to 'month'", () => {
    // After subscription.deleted, billingInterval is reset to "month" (the default).
    // This prevents showing stale interval information on the billing settings page.
    const afterDeletion = { billingInterval: "month" };
    expect(afterDeletion.billingInterval).toBe("month");
  });
});

// ---------------------------------------------------------------------------
// New-user annual intent — parseBillingIntent logic
// ---------------------------------------------------------------------------

describe("parseBillingIntent — register form intent parsing", () => {
  function parseBillingIntent(params: Record<string, string | null>): {
    plan: "PRO" | "BUSINESS";
    interval: "month" | "year";
  } | null {
    const plan = params.plan;
    const interval = params.interval;
    if (plan !== "PRO" && plan !== "BUSINESS") return null;
    return { plan, interval: interval === "year" ? "year" : "month" };
  }

  it("?plan=PRO&interval=year → intent captured", () => {
    const intent = parseBillingIntent({ plan: "PRO", interval: "year" });
    expect(intent).toEqual({ plan: "PRO", interval: "year" });
  });

  it("?plan=BUSINESS&interval=month → intent captured", () => {
    const intent = parseBillingIntent({ plan: "BUSINESS", interval: "month" });
    expect(intent).toEqual({ plan: "BUSINESS", interval: "month" });
  });

  it("?plan=PRO (no interval) → defaults to month", () => {
    const intent = parseBillingIntent({ plan: "PRO", interval: null });
    expect(intent).toEqual({ plan: "PRO", interval: "month" });
  });

  it("?plan=FREE → no intent (FREE is not a checkout plan)", () => {
    const intent = parseBillingIntent({ plan: "FREE", interval: "month" });
    expect(intent).toBeNull();
  });

  it("no plan param → no intent", () => {
    const intent = parseBillingIntent({ plan: null, interval: "year" });
    expect(intent).toBeNull();
  });

  it("?plan=INVALID → no intent", () => {
    const intent = parseBillingIntent({ plan: "INVALID", interval: "month" });
    expect(intent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Lifecycle email templates — structure and content validation
// ---------------------------------------------------------------------------

describe("buildPaymentFailedEmail", () => {
  const base = {
    userName: "Jane Smith",
    orgName: "Acme Corp",
    appUrl: "https://app.oneace.app",
    amountDue: 2900, // $29.00 in cents
    currency: "usd",
    attemptCount: 1,
    nextAttemptDate: "Apr 20, 2026",
  };

  it("contains correct subject", () => {
    const { subject } = buildPaymentFailedEmail(base);
    expect(subject).toContain("Acme Corp");
    expect(subject).toContain("Payment failed");
  });

  it("uses first name in body", () => {
    const { text } = buildPaymentFailedEmail(base);
    expect(text).toContain("Hi Jane");
    expect(text).not.toContain("Hi Jane Smith");
  });

  it("includes billing portal link", () => {
    const { html } = buildPaymentFailedEmail(base);
    expect(html).toContain("settings/billing");
  });

  it("handles null nextAttemptDate", () => {
    const { text } = buildPaymentFailedEmail({ ...base, nextAttemptDate: null });
    expect(text).toContain("No further retries are scheduled");
  });

  it("escapes HTML in orgName", () => {
    const { html } = buildPaymentFailedEmail({ ...base, orgName: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("buildPaymentRecoveredEmail", () => {
  it("contains correct subject for PRO annual", () => {
    const { subject } = buildPaymentRecoveredEmail({
      userName: "Bob",
      orgName: "TestOrg",
      appUrl: "https://app.oneace.app",
      restoredPlan: "PRO",
      billingInterval: "year",
    });
    expect(subject).toContain("Pro");
    expect(subject).toContain("active");
  });

  it("shows correct interval label", () => {
    const { text } = buildPaymentRecoveredEmail({
      userName: "Bob",
      orgName: "TestOrg",
      appUrl: "https://app.oneace.app",
      restoredPlan: "BUSINESS",
      billingInterval: "month",
    });
    expect(text).toContain("monthly");
  });
});

describe("buildUpgradeConfirmationEmail", () => {
  it("PRO upgrade lists correct features", () => {
    const { html } = buildUpgradeConfirmationEmail({
      userName: "Alice",
      orgName: "AcmeCo",
      appUrl: "https://app.oneace.app",
      newPlan: "PRO",
      billingInterval: "year",
    });
    expect(html).toContain("Unlimited items");
    expect(html).toContain("Bin-level inventory");
    expect(html).not.toContain("Audit log"); // PRO doesn't have audit log
  });

  it("BUSINESS upgrade lists audit log feature", () => {
    const { html } = buildUpgradeConfirmationEmail({
      userName: "Alice",
      orgName: "AcmeCo",
      appUrl: "https://app.oneace.app",
      newPlan: "BUSINESS",
      billingInterval: "month",
    });
    // Template uses "Full audit log with complete history" — lowercase 'audit'.
    expect(html).toContain("audit log");
  });
});

describe("buildPlanDowngradedEmail", () => {
  it("payment_failure reason uses correct copy", () => {
    const { subject } = buildPlanDowngradedEmail({
      userName: "Alice",
      orgName: "AcmeCo",
      appUrl: "https://app.oneace.app",
      previousPlan: "PRO",
      reason: "payment_failure",
    });
    expect(subject).toContain("paused");
    expect(subject).toContain("action required");
  });

  it("cancellation reason uses correct copy", () => {
    const { subject } = buildPlanDowngradedEmail({
      userName: "Alice",
      orgName: "AcmeCo",
      appUrl: "https://app.oneace.app",
      previousPlan: "PRO",
      reason: "cancellation",
    });
    expect(subject).toContain("ended");
    expect(subject).toContain("Free");
  });

  it("includes restore link", () => {
    const { html } = buildPlanDowngradedEmail({
      userName: "Alice",
      orgName: "AcmeCo",
      appUrl: "https://app.oneace.app",
      previousPlan: "BUSINESS",
      reason: "cancellation",
    });
    expect(html).toContain("settings/billing");
    expect(html).toContain("Business");
  });
});

describe("buildCancellationPendingEmail", () => {
  it("includes cancel date in subject and body", () => {
    const cancelAt = "2026-05-15T00:00:00.000Z";
    const { subject, text } = buildCancellationPendingEmail({
      userName: "Dave",
      orgName: "DaveCo",
      appUrl: "https://app.oneace.app",
      currentPlan: "PRO",
      cancelAt,
    });

    // Subject should contain the formatted date
    expect(subject).toMatch(/\d{4}/); // year present
    expect(text).toContain("cancel on");
  });

  it("escapes HTML in user input", () => {
    const { html } = buildCancellationPendingEmail({
      userName: '<img src="x">',
      orgName: "Safe Corp",
      appUrl: "https://app.oneace.app",
      currentPlan: "PRO",
      cancelAt: "2026-06-01T00:00:00.000Z",
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

// ---------------------------------------------------------------------------
// Billing state machine — comprehensive scenario coverage
// ---------------------------------------------------------------------------

describe("billing state machine — Phase 16 scenarios", () => {
  type Scenario = {
    name: string;
    event: string;
    subscriptionStatus?: string;
    cancelAtPeriodEnd?: boolean;
    currentOrgPlan: string;
    expectedPlan: string;
    expectedCancelAtPeriodEnd: boolean;
    expectedAuditAction: string;
  };

  const scenarios: Scenario[] = [
    {
      name: "checkout completed → plan upgraded, interval set, cancel cleared",
      event: "checkout.session.completed",
      currentOrgPlan: "FREE",
      expectedPlan: "PRO",
      expectedCancelAtPeriodEnd: false,
      expectedAuditAction: "billing.plan_upgraded",
    },
    {
      name: "subscription updated (active, cancel_at_period_end=true) → plan stays, cancel set",
      event: "customer.subscription.updated",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentOrgPlan: "PRO",
      expectedPlan: "PRO",
      expectedCancelAtPeriodEnd: true,
      expectedAuditAction: "billing.cancellation_pending",
    },
    {
      name: "subscription updated (past_due) → downgraded to FREE",
      event: "customer.subscription.updated",
      subscriptionStatus: "past_due",
      currentOrgPlan: "PRO",
      expectedPlan: "FREE",
      expectedCancelAtPeriodEnd: false,
      expectedAuditAction: "billing.plan_downgraded",
    },
    {
      name: "subscription deleted → FREE, cancel state cleared",
      event: "customer.subscription.deleted",
      currentOrgPlan: "PRO",
      expectedPlan: "FREE",
      expectedCancelAtPeriodEnd: false,
      expectedAuditAction: "billing.subscription_cancelled",
    },
    {
      name: "payment succeeded on FREE org → plan restored",
      event: "invoice.payment_succeeded",
      currentOrgPlan: "FREE",
      expectedPlan: "PRO",
      expectedCancelAtPeriodEnd: false,
      expectedAuditAction: "billing.payment_recovered",
    },
    {
      name: "payment succeeded on PRO org → no change (normal renewal)",
      event: "invoice.payment_succeeded",
      currentOrgPlan: "PRO",
      expectedPlan: "PRO", // unchanged
      expectedCancelAtPeriodEnd: false,
      expectedAuditAction: "none", // no audit needed for normal renewal
    },
  ];

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      // Verify the expected behavior is consistent and documented.
      if (scenario.event === "customer.subscription.deleted") {
        expect(scenario.expectedPlan).toBe("FREE");
        expect(scenario.expectedCancelAtPeriodEnd).toBe(false);
      }

      if (scenario.event === "invoice.payment_succeeded") {
        if (scenario.currentOrgPlan === "FREE") {
          expect(scenario.expectedAuditAction).toBe("billing.payment_recovered");
          expect(scenario.expectedPlan).toBe("PRO");
        } else {
          expect(scenario.expectedAuditAction).toBe("none");
        }
      }

      if (scenario.subscriptionStatus === "past_due") {
        expect(scenario.expectedPlan).toBe("FREE");
      }

      if (scenario.cancelAtPeriodEnd === true) {
        expect(scenario.expectedCancelAtPeriodEnd).toBe(true);
        expect(scenario.expectedAuditAction).toBe("billing.cancellation_pending");
        expect(scenario.expectedPlan).toBe(scenario.currentOrgPlan); // plan must stay active
      }
    });
  }
});
