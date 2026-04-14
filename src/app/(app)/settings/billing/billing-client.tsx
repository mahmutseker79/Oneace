/**
 * Phase 12.3 + 13.4 — Billing settings page at /settings/billing.
 *
 * Phase 13.4 enhances this with:
 * - Plan feature summary showing what the current plan includes
 * - Limit indicators (items used/allowed, warehouses, members)
 * - Specific "what you'd unlock" copy for upgrade prompts
 */

"use client";

import { ArrowRight, Check, CheckCircle2, CreditCard, Loader2, Minus } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

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
  checkoutSuccess: boolean;
  checkoutCancelled: boolean;
  // Phase 13.4 — usage data for limit indicators
  currentItems: number;
  currentWarehouses: number;
  currentMembers: number;
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
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{current.toLocaleString()} / Unlimited</span>
      </div>
    );
  }

  const pct = Math.min(100, (current / max) * 100);
  const isNear = pct >= 80;
  const isAt = current >= max;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={`font-medium ${isAt ? "text-destructive" : isNear ? "text-amber-600" : ""}`}
        >
          {current} / {max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            isAt ? "bg-destructive" : isNear ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
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
  checkoutSuccess,
  checkoutCancelled,
  currentItems,
  currentWarehouses,
  currentMembers,
}: BillingPageProps) {
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

      {/* Current plan + usage */}
      <Card>
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
                ? "You're on the Pro plan — $29/month."
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

          {/* Usage indicators — shown for FREE plan only */}
          {plan === "FREE" ? (
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Usage</p>
              <LimitBar label="Items" current={currentItems} max={100} />
              <LimitBar label="Warehouse locations" current={currentWarehouses} max={1} />
              <LimitBar label="Team members" current={currentMembers} max={3} />
            </div>
          ) : plan === "PRO" ? (
            <div className="space-y-3 rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Usage</p>
              <LimitBar label="Items" current={currentItems} max={null} />
              <LimitBar label="Warehouse locations" current={currentWarehouses} max={null} />
              <LimitBar label="Team members" current={currentMembers} max={10} />
            </div>
          ) : null}
        </CardContent>

        {/* Billing actions */}
        {canManageBilling ? (
          <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
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
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Billing is not yet configured. Contact your administrator.
              </p>
            )}
          </CardFooter>
        ) : null}
      </Card>

      <Separator />

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
