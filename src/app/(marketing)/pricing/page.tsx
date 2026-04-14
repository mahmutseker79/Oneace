import { ArrowRight, Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Pricing — OneAce",
  description:
    "Simple, transparent pricing for OneAce inventory management. Start free, scale when you need to.",
};

// ---------------------------------------------------------------------------
// Plan data — aligned with the real Plan enum: FREE | PRO | BUSINESS
// ---------------------------------------------------------------------------

type FeatureValue = string | boolean | null;

type PricingFeature = {
  label: string;
  free: FeatureValue;
  pro: FeatureValue;
  business: FeatureValue;
};

const PRICING_FEATURES: PricingFeature[] = [
  { label: "Items", free: "Up to 100", pro: "Unlimited", business: "Unlimited" },
  { label: "Locations (warehouses)", free: "1", pro: "Unlimited", business: "Unlimited" },
  { label: "Team members", free: "Up to 3", pro: "Up to 10", business: "Unlimited" },
  { label: "Barcode scanning", free: true, pro: true, business: true },
  { label: "Offline stock counts", free: true, pro: true, business: true },
  { label: "Stock movements ledger", free: true, pro: true, business: true },
  { label: "CSV exports", free: true, pro: true, business: true },
  { label: "Bin-level inventory tracking", free: null, pro: true, business: true },
  { label: "Purchase orders & receiving", free: null, pro: true, business: true },
  { label: "Multi-warehouse transfers", free: null, pro: true, business: true },
  { label: "Excel exports", free: null, pro: true, business: true },
  { label: "Low-stock alerts", free: null, pro: true, business: true },
  { label: "Audit log", free: null, pro: null, business: true },
  { label: "Priority support", free: null, pro: null, business: true },
];

type Plan = {
  id: "free" | "pro" | "business";
  name: string;
  price: string;
  priceNote: string;
  description: string;
  cta: string;
  ctaHref: string;
  featured: boolean;
  badge?: string;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceNote: "forever",
    description: "For individuals and small teams getting started with inventory tracking.",
    cta: "Get started free",
    ctaHref: "/register",
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    priceNote: "per month",
    description:
      "For growing teams who need bin tracking, purchase orders, and full warehouse ops.",
    cta: "Start Pro trial",
    ctaHref: "/register",
    featured: true,
    badge: "Most popular",
  },
  {
    id: "business",
    name: "Business",
    price: "$79",
    priceNote: "per month",
    description:
      "For operations teams that need unlimited scale, audit trails, and priority support.",
    cta: "Start Business trial",
    ctaHref: "/register",
    featured: false,
  },
];

// ---------------------------------------------------------------------------
// Feature value display
// ---------------------------------------------------------------------------

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === null) {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  }
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-primary" />;
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  return (
    <div className="space-y-0">
      {/* Header */}
      <section className="border-b border-border/60 bg-gradient-to-b from-accent/30 to-background px-4 py-16 text-center sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl space-y-4">
          <Badge variant="secondary" className="px-3 py-1 text-xs">
            Transparent pricing
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple pricing. No surprises.
          </h1>
          <p className="text-muted-foreground">
            Start free with no credit card. Upgrade when your team or catalog grows.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.featured
                  ? "border-primary shadow-md ring-1 ring-primary/20"
                  : "border-border/60"
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
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/ {plan.priceNote}</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>

              <CardContent className="flex-1 space-y-2">
                {PRICING_FEATURES.filter((f) => f[plan.id] !== null && f[plan.id] !== false)
                  .slice(0, 8)
                  .map((feature) => (
                    <div key={feature.label} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        {typeof feature[plan.id] === "string" ? (
                          <>
                            <span className="font-medium">{feature[plan.id]}</span>{" "}
                            {feature.label.toLowerCase()}
                          </>
                        ) : (
                          feature.label
                        )}
                      </span>
                    </div>
                  ))}
              </CardContent>

              <CardFooter className="pt-4">
                <Button
                  asChild
                  className="w-full"
                  variant={plan.featured ? "default" : "outline"}
                  size="lg"
                >
                  <Link href={plan.ctaHref}>
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          All plans include a 14-day free trial of Pro features. No credit card required to start.
        </p>
      </section>

      <Separator />

      {/* Feature comparison table */}
      <section className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-8">
          <h2 className="text-center text-xl font-semibold">Full feature comparison</h2>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Feature</th>
                  <th className="px-4 py-3 text-center font-medium">Free</th>
                  <th className="px-4 py-3 text-center font-medium text-primary">Pro</th>
                  <th className="px-4 py-3 text-center font-medium">Business</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_FEATURES.map((feature, idx) => (
                  <tr
                    key={feature.label}
                    className={`border-b last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                  >
                    <td className="px-4 py-3 font-medium">{feature.label}</td>
                    <td className="px-4 py-3 text-center">
                      <FeatureCell value={feature.free} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FeatureCell value={feature.pro} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FeatureCell value={feature.business} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ / Notes */}
      <section className="border-t border-border/60 bg-muted/20 px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-center text-xl font-semibold">Common questions</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                q: "Can I change plans later?",
                a: "Yes. You can upgrade or downgrade at any time. Changes take effect immediately.",
              },
              {
                q: "What happens when I hit the Free limit?",
                a: "You'll see a prompt to upgrade. Existing data is never deleted — you just can't add more until you upgrade.",
              },
              {
                q: "Is there a minimum contract?",
                a: "No. All paid plans are month-to-month. Cancel any time.",
              },
              {
                q: "Do you offer annual billing?",
                a: "Annual billing with a discount is coming soon. Contact us if this is blocking your decision.",
              },
            ].map((faq) => (
              <div key={faq.q} className="space-y-1">
                <p className="font-medium">{faq.q}</p>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 px-4 py-12 text-center sm:px-6">
        <div className="mx-auto max-w-md space-y-4">
          <h2 className="text-xl font-semibold">Ready to get started?</h2>
          <p className="text-sm text-muted-foreground">
            Create your free account in 60 seconds. No credit card required.
          </p>
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/register">
              Create a free account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
