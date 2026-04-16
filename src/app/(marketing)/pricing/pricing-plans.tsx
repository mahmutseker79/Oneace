"use client";

/**
 * Phase 15.1 — PricingPlans client component.
 *
 * Handles the monthly/annual billing interval toggle and displays
 * plan cards with correct prices and CTA hrefs.
 *
 * The toggle is client-side (interactive) but the plan data and
 * feature comparison table remain server-rendered in page.tsx.
 */

import { ArrowRight, Check, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ANNUAL_DISCOUNT_PCT, ANNUAL_MONTHLY_EQUIVALENT, ANNUAL_TOTAL_PRICE } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Interval = "month" | "year";

type PlanCardData = {
  id: "free" | "pro" | "business";
  name: string;
  featured: boolean;
  badge?: string;
  description: string;
  highlight?: string;
  highlightAnnual?: string;
};

const PLAN_CARDS: PlanCardData[] = [
  {
    id: "free",
    name: "Free",
    featured: false,
    description:
      "Get started with core inventory tracking, barcode scanning, and stock counts. No credit card required.",
  },
  {
    id: "pro",
    name: "Pro",
    featured: true,
    badge: "Best value",
    description:
      "Unlimited items and warehouses, purchase orders, bin tracking, and full exports. Replaces Sortly Ultra at 1/5 the price.",
    highlight: "Sortly Ultra is $149/mo for just 2,000 items.",
    highlightAnnual: "Save $72/year vs monthly billing.",
  },
  {
    id: "business",
    name: "Business",
    featured: false,
    description:
      "Unlimited team, audit log, and priority support. Replaces Sortly Premium at under 1/4 the price.",
    highlight: "Sortly Premium is $299/mo for 5,000 items.",
    highlightAnnual: "Save $120/year vs monthly billing.",
  },
];

// ---------------------------------------------------------------------------
// Price display helpers
// ---------------------------------------------------------------------------

function planPrice(
  id: "free" | "pro" | "business",
  interval: Interval,
): { amount: string; note: string; annualTotal?: string } {
  if (id === "free") return { amount: "$0", note: "forever" };
  const tier = id === "pro" ? "PRO" : "BUSINESS";
  if (interval === "year") {
    return {
      amount: `$${ANNUAL_MONTHLY_EQUIVALENT[tier]}`,
      note: "per month",
      annualTotal: `Billed $${ANNUAL_TOTAL_PRICE[tier]}/year`,
    };
  }
  return {
    amount: id === "pro" ? "$29" : "$79",
    note: "per month",
  };
}

function planCta(id: "free" | "pro" | "business", interval: Interval): string {
  if (id === "free") return "Get started free";
  // Phase 12.8 — clearer annual CTA: "Get started" is less confusing than "trial"
  if (interval === "year") return "Get started — billed annually";
  return "Get started — 14 days free";
}

function planCtaHref(id: "free" | "pro" | "business", interval: Interval): string {
  if (id === "free") return "/register";
  // Route to checkout with interval query param
  // The checkout route reads interval from the request body, not URL —
  // this href opens the billing settings page which initiates checkout.
  // For signed-in users it will use the billing page; for new users, register first.
  return `/register?plan=${id === "pro" ? "PRO" : "BUSINESS"}&interval=${interval}`;
}

// Top features shown in plan card (max 8)
const CARD_FEATURES: Record<string, string[]> = {
  free: [
    "Up to 100 items",
    "1 warehouse location",
    "Up to 3 team members",
    "Barcode scanning (offline)",
    "Stock counts",
    "Stock movements ledger",
    "Reorder points",
  ],
  pro: [
    "Unlimited items",
    "Unlimited warehouse locations",
    "Up to 10 team members",
    "Bin-level inventory tracking",
    "Purchase orders & receiving",
    "Multi-warehouse transfer wizard",
    "CSV & Excel exports",
    "Reports (stock value, movements, bins)",
  ],
  business: [
    "Unlimited items",
    "Unlimited warehouse locations",
    "Unlimited team members",
    "All Pro features",
    "Audit log (full history)",
    "Priority support",
  ],
};

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

function IntervalToggle({
  interval,
  onChange,
  showAnnual,
}: {
  interval: Interval;
  onChange: (i: Interval) => void;
  showAnnual: boolean;
}) {
  if (!showAnnual) return null;

  return (
    <div className="flex items-center justify-center gap-2 rounded-full bg-muted p-1">
      <button
        type="button"
        onClick={() => onChange("month")}
        className={`px-4 py-2 text-sm font-medium transition-all rounded-full ${
          interval === "month"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("year")}
        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all rounded-full ${
          interval === "year"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Annual
        <Badge className="bg-success px-1.5 py-0 text-[10px] text-white">
          Save {ANNUAL_DISCOUNT_PCT}%
        </Badge>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PricingPlans({ showAnnual }: { showAnnual: boolean }) {
  const [interval, setInterval] = useState<Interval>("month");

  return (
    <div className="space-y-6">
      <IntervalToggle interval={interval} onChange={setInterval} showAnnual={showAnnual} />

      <div className="mx-auto grid max-w-5xl gap-6 grid-cols-1 md:grid-cols-3">
        {PLAN_CARDS.map((plan) => {
          const pricing = planPrice(plan.id, interval);
          const cta = planCta(plan.id, interval);
          const ctaHref = planCtaHref(plan.id, interval);
          const features = CARD_FEATURES[plan.id] ?? [];
          const highlight =
            interval === "year" && plan.highlightAnnual ? plan.highlightAnnual : plan.highlight;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col transition-all ${
                plan.featured
                  ? "border border-primary shadow-lg ring-2 ring-primary/30 md:scale-105"
                  : "border border-border/60"
              }`}
            >
              {plan.badge ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary px-3 text-primary-foreground">{plan.badge}</Badge>
                </div>
              ) : null}

              <CardHeader className="pb-4 pt-6">
                <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{pricing.amount}</span>
                  <span className="text-sm text-muted-foreground">/ {pricing.note}</span>
                </div>
                {pricing.annualTotal ? (
                  <p className="text-xs text-success font-medium">{pricing.annualTotal}</p>
                ) : null}
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                {highlight ? (
                  <div className="mt-1 flex items-start gap-1.5 rounded-md bg-success-light px-2.5 py-1.5">
                    <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <p className="text-xs text-success">{highlight}</p>
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="flex-1 space-y-2">
                {features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>

              <CardFooter className="pt-4">
                <Button
                  asChild
                  className={`w-full ${plan.featured ? "shadow-sm" : ""}`}
                  variant={plan.featured ? "default" : "outline"}
                  size="lg"
                >
                  <Link href={ctaHref}>
                    {cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {interval === "year"
          ? "Annual plans billed upfront. Cancel anytime — unused months refunded."
          : "All plans include a 14-day free trial of Pro features. Cancel anytime."}
      </p>
    </div>
  );
}
