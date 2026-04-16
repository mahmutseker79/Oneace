/**
 * Phase 12.3 + 13.4 — Billing settings page at /settings/billing.
 *
 * Phase 13.4 enhances this with:
 * - Plan feature summary showing what the current plan includes
 * - Limit indicators (items used/allowed, warehouses, members)
 * - Specific "what you'd unlock" copy for upgrade prompts
 */

"use client";

// Phase 16.4 — Vercel Analytics for billing conversion events.
// @vercel/analytics — installed.
import { track } from "@vercel/analytics";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types passed from server component wrapper
// ---------------------------------------------------------------------------

export type BillingPageProps = {
  plan: "FREE" | "PRO" | "BUSINESS";
  canManageBilling: boolean;
  hasStripe: boolean;
  hasCustomer: boolean;
  hasAnnualBilling: boolean;
  checkoutSuccess: boolean;
  checkoutCancelled: boolean;
  // Phase 13.4 — usage data for limit indicators
  currentItems: number;
  currentWarehouses: number;
  currentMembers: number;
  // Phase 16.2 — subscription truth (billing interval + cancellation state)
  billingInterval: "month" | "year";
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null; // ISO string or null
  // Phase 16.3 — billing intent from register fallback (shown as banner + pre-selects toggle)
  intentPlan?: "PRO" | "BUSINESS";
  intentInterval?: "month" | "year";
  // Phase 1 UX — show "portal return" info banner after returning from Stripe portal
  portalReturn?: boolean;
};

// ---------------------------------------------------------------------------
// Plan display data
// ---------------------------------------------------------------------------

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free",
  PRO: "Pro",
  BUSINESS: "Business",
};

type PlanFeature = { label: string; included: boolean | string };

const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  FREE: [
    { label: "Up to 100 items", included: true },
    { label: "1 warehouse location", included: true },
    { label: "Up to 3 team members", included: true },
    { label: "Barcode scanning & offline counts", included: true },
    { label: "Stock movements ledger", included: true },
    { label: "Bin-level tracking", included: false },
    { label: "Purchase orders & receiving", included: false },
    { label: "Exports (CSV & Excel)", included: false },
    { label: "Reports & audit log", included: false },
  ],
  PRO: [
    { label: "Unlimited items", included: true },
    { label: "Unlimited warehouse locations", included: true },
    { label: "Up to 10 team members", included: true },
    { label: "Barcode scanning & offline counts", included: true },
    { label: "Bin-level tracking + putaway", included: true },
    { label: "Purchase orders & scan-assisted receiving", included: true },
    { label: "CSV & Excel exports", included: true },
    { label: "Reports (stock value, movements, bins)", included: true },
    { label: "Audit log", included: false },
  ],
  BUSINESS: [
    { label: "Unlimited items", included: true },
    { label: "Unlimited warehouse locations", included: true },
    { label: "Unlimited team members", included: true },
    { label: "Barcode scanning & offline counts", included: true },
    { label: "Bin-level tracking + putaway", included: true },
    { label: "Purchase orders & scan-assisted receiving", included: true },
    { label: "CSV & Excel exports", included: true },
    { label: "Reports (stock value, movements, bins)", included: true },
    { label: "Audit log (full history)", included: true },
  ],
};

// ---------------------------------------------------------------------------
// Limit bar — visual indicator of limit usage
// ---------------------------------------------------------------------------

function LimitBar({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number | null; // null = unlimited
}) {
  if (max === null) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium tabular-nums">
            {current.toLocaleString()}
            <span className="text-muted-foreground font-normal"> / ∞</span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary/30 w-[15%]" />
        </div>
      </div>
    );
  }

  const pct = Math.min(100, (current / max) * 100);
  const isNear = pct >= 80;
  const isAt = current >= max;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={`font-medium tabular-nums ${isAt ? "text-destructive" : isNear ? "text-amber-600 dark:text-amber-400" : ""}`}
        >
          {current}
          <span className="text-muted-foreground font-normal"> / {max}</span>
          {isAt && <span className="ml-1 text-xs">⚠</span>}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isAt ? "bg-destructive" : isNear ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client component
// ---------------------------------------------------------------------------

export function BillingPage({
  plan,
  canManageBilling,
  hasStripe,
  hasCustomer,
  hasAnnualBilling,
  checkoutSuccess,
  checkoutCancelled,
  currentItems,
  currentWarehouses,
  currentMembers,
  billingInterval: initialBillingInterval,
  cancelAtPeriodEnd,
  cancelAt,
  intentPlan,
  intentInterval,
  portalReturn,
}: BillingPageProps) {
  const [isRedirecting, startTransition] = useTransition();
  // Phase 16.2 — initialize from real DB value, not always "month".
  // Phase 16.3 — intent from register flow overrides if present (and plan is FREE).
  // For FREE plan orgs, billingInterval is "month" (default) but the toggle
  // only appears for paid plans so this initialization is safe for all cases.
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    plan === "FREE" && intentInterval ? intentInterval : initialBillingInterval,
  );

  async function handleUpgrade(targetPlan: "PRO" | "BUSINESS") {
    // Phase 16.4 — track checkout started event.
    void track("checkout_started", { plan: targetPlan, interval: billingInterval, from: plan });

    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: targetPlan, interval: billingInterval }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch {
        // stays on page
      }
    });
  }

  async function handleManage() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/portal", { method: "POST" });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch {
        // stays on page
      }
    });
  }

  const features = PLAN_FEATURES[plan] ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Billing &amp; Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your subscription and billing details.
        </p>
      </div>

      {/* Phase 16.3 — Billing intent banner (shown when checkout failed during registration) */}
      {plan === "FREE" && intentPlan && hasStripe ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            You selected the{" "}
            <strong>
              {intentPlan} {intentInterval === "year" ? "Annual" : "Monthly"}
            </strong>{" "}
            plan during sign-up. Use the upgrade button below to complete your subscription.
          </span>
        </div>
      ) : null}

      {/* Phase 16.1 — Pending cancellation banner */}
      {cancelAtPeriodEnd && cancelAt ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Your subscription is set to cancel on{" "}
            <strong>
              {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                new Date(cancelAt),
              )}
            </strong>
            . You will be moved to the Free plan at that time. To keep your plan, reactivate your
            subscription in the billing portal.
          </span>
        </div>
      ) : null}

      {/* Portal return banner */}
      {portalReturn ? (
        <div className="flex items-center gap-2 rounded-md border px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          Your billing details have been updated.
        </div>
      ) : null}

      {/* Success / cancellation banners */}
      {checkoutSuccess ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Your plan has been upgraded. It may take a few moments to reflect.
        </div>
      ) : null}
      {checkoutCancelled ? (
        <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
          Checkout was cancelled. Your plan was not changed.
        </div>
      ) : null}

      {/* Current plan + usage — Phase 6C: gradient border for active plans */}
      <Card className={plan !== "FREE" ? "border-primary/30 shadow-lg shadow-primary/5" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Current plan
            <Badge variant={plan === "FREE" ? "secondary" : "default"} className="ml-1">
              {PLAN_LABELS[plan] ?? plan}
            </Badge>
          </CardTitle>
          <CardDescription>
            {plan === "FREE"
              ? "You're on the Free plan."
              : plan === "PRO"
                ? initialBillingInterval === "year"
                  ? "You're on the Pro plan — $23/mo billed annually ($276/yr)."
                  : "You're on the Pro plan — $29/month."
                : initialBillingInterval === "year"
                  ? "You're on the Business plan — $63/mo billed annually ($756/yr)."
                  : "You're on the Business plan — $79/month."}
          </CardDescription>
        </CardHeader>

        {/* Plan feature checklist */}
        <CardContent className="space-y-4">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-sm">
                {f.included ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                )}
                <span className={f.included ? "" : "text-muted-foreground/60"}>{f.label}</span>
              </div>
            ))}
          </div>

          {/* Usage indicators — shown for all plans */}
          <div className="space-y-3 rounded-xl border bg-surface-sunken p-4">
            <p className="text-overline text-muted-foreground">Resource Usage</p>
            <LimitBar label="Items" current={currentItems} max={plan === "FREE" ? 100 : null} />
            <LimitBar
              label="Warehouse locations"
              current={currentWarehouses}
              max={plan === "FREE" ? 1 : null}
            />
            <LimitBar
              label="Team members"
              current={currentMembers}
              max={plan === "FREE" ? 3 : plan === "PRO" ? 10 : null}
            />
          </div>
        </CardContent>

        {/* Billing actions */}
        {canManageBilling ? (
          <CardFooter className="flex flex-col gap-3 border-t pt-4">
            {/* Phase 15.1 — annual/monthly toggle (only when annual billing configured) */}
            {hasStripe && hasAnnualBilling && plan !== "BUSINESS" ? (
              <div className="flex w-full items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setBillingInterval("month");
                    void track("billing_interval_changed", { interval: "month", plan });
                  }}
                  className={`font-medium transition-colors ${
                    billingInterval === "month"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = billingInterval === "month" ? "year" : "month";
                    setBillingInterval(next);
                    void track("billing_interval_changed", { interval: next, plan });
                  }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    billingInterval === "year" ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      billingInterval === "year" ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="flex items-center gap-1.5 font-medium">
                  Annual
                  <Badge className="bg-emerald-600 px-1.5 py-0 text-[10px] text-white">
                    Save 20%
                  </Badge>
                </span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {hasStripe ? (
                <>
                  {hasCustomer ? (
                    <Button variant="outline" onClick={handleManage} disabled={isRedirecting}>
                      {isRedirecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Manage billing
                    </Button>
                  ) : null}
                  {plan !== "BUSINESS" ? (
                    <>
                      {plan === "FREE" ? (
                        <Button onClick={() => handleUpgrade("PRO")} disabled={isRedirecting}>
                          {isRedirecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                          {billingInterval === "year"
                            ? "Upgrade to Pro — $23/mo"
                            : "Upgrade to Pro — $29/mo"}
                        </Button>
                      ) : null}
                      <Button
                        variant={plan === "FREE" ? "outline" : "default"}
                        onClick={() => handleUpgrade("BUSINESS")}
                        disabled={isRedirecting}
                      >
                        {isRedirecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                        {billingInterval === "year"
                          ? "Upgrade to Business — $63/mo"
                          : "Upgrade to Business — $79/mo"}
                      </Button>
                    </>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Billing is not yet configured. Contact your administrator.
                </p>
              )}
            </div>
          </CardFooter>
        ) : null}
      </Card>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          View the full{" "}
          <Link href="/pricing" className="text-primary hover:underline">
            pricing page
          </Link>{" "}
          to compare plan features.
        </p>
        {plan !== "BUSINESS" && (
          <p className="text-sm">
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              Compare plans →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
