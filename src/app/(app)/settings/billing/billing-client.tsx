/**
 * Phase 12.3 — Billing settings page at /settings/billing.
 *
 * Shows the org's current plan and upgrade/manage CTAs.
 * OWNER and ADMIN can initiate checkout or open the billing portal.
 * Other roles see the plan read-only.
 *
 * When Stripe is not configured (no STRIPE_SECRET_KEY), the page
 * renders an informational state — no broken UI.
 */

"use client";

import { ArrowRight, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types passed from server component wrapper
// ---------------------------------------------------------------------------

export type BillingPageProps = {
  plan: "FREE" | "PRO" | "BUSINESS";
  canManageBilling: boolean;
  hasStripe: boolean;
  hasCustomer: boolean;
  checkoutSuccess: boolean;
  checkoutCancelled: boolean;
};

// ---------------------------------------------------------------------------
// Plan display helpers
// ---------------------------------------------------------------------------

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free",
  PRO: "Pro",
  BUSINESS: "Business",
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  FREE: "Basic inventory tracking for small teams.",
  PRO: "Full warehouse ops: bins, purchase orders, Excel exports, alerts.",
  BUSINESS: "Unlimited scale with audit log and priority support.",
};

// ---------------------------------------------------------------------------
// Client component
// ---------------------------------------------------------------------------

export function BillingPage({
  plan,
  canManageBilling,
  hasStripe,
  hasCustomer,
  checkoutSuccess,
  checkoutCancelled,
}: BillingPageProps) {
  const router = useRouter();
  const [isRedirecting, startTransition] = useTransition();

  async function handleUpgrade(targetPlan: "PRO" | "BUSINESS") {
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: targetPlan }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch {
        // Error handled gracefully — user stays on page
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
        // Error handled gracefully
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Billing &amp; Plan</h2>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing details.
        </p>
      </div>

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

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Current plan
            <Badge variant={plan === "FREE" ? "secondary" : "default"} className="ml-1">
              {PLAN_LABELS[plan] ?? plan}
            </Badge>
          </CardTitle>
          <CardDescription>{PLAN_DESCRIPTIONS[plan] ?? ""}</CardDescription>
        </CardHeader>

        {canManageBilling && hasStripe ? (
          <CardContent className="space-y-3">
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
              <div className="flex flex-wrap gap-2">
                {plan === "FREE" ? (
                  <Button onClick={() => handleUpgrade("PRO")} disabled={isRedirecting}>
                    {isRedirecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    Upgrade to Pro — $29/mo
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
                  Upgrade to Business — $79/mo
                </Button>
              </div>
            ) : null}
          </CardContent>
        ) : canManageBilling && !hasStripe ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Billing is not yet configured. Contact your administrator or check the environment
              setup.
            </p>
          </CardContent>
        ) : null}
      </Card>

      <Separator />

      {/* Pricing link */}
      <p className="text-sm text-muted-foreground">
        View the full{" "}
        <Link href="/pricing" className="text-primary hover:underline">
          pricing page
        </Link>{" "}
        to compare plan features.
      </p>
    </div>
  );
}
