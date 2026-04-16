import { ArrowRight, Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { hasAnnualBilling } from "@/lib/stripe";
import { PricingPlans } from "./pricing-plans";

export const metadata: Metadata = {
  title: "Pricing — OneAce",
  description:
    "Inventory management at a fraction of Sortly's price. Unlimited items and warehouses from $29/month — no per-SKU limits.",
  openGraph: {
    title: "Pricing — OneAce",
    description:
      "Unlimited items and warehouses from $29/month. Compare: Sortly charges $149/month for only 2,000 items.",
  },
};

// ---------------------------------------------------------------------------
// Plan data — aligned with real Plan enum (FREE | PRO | BUSINESS)
// and enforced server-side in Phase 13.
//
// Competitive context (April 2026):
//   Sortly Ultra  — $149/mo, 2,000 items, 5 users, purchase orders
//   Sortly Premium — $299/mo, 5,000 items, 8 users
//   inFlow — enterprise sales, no public pricing
//   OneAce Pro  — $29/mo, unlimited items/warehouses, 10 users → 5× cheaper than Sortly Ultra
//   OneAce Business — $79/mo, unlimited → 3.75× cheaper than Sortly Premium
// ---------------------------------------------------------------------------

type FeatureValue = string | boolean | null;

type PricingFeature = {
  label: string;
  free: FeatureValue;
  pro: FeatureValue;
  business: FeatureValue;
};

const PRICING_FEATURES: PricingFeature[] = [
  // Limits
  { label: "Items / SKUs", free: "Up to 100", pro: "Unlimited", business: "Unlimited" },
  { label: "Warehouse locations", free: "1", pro: "Unlimited", business: "Unlimited" },
  { label: "Team members", free: "Up to 3", pro: "Up to 10", business: "Unlimited" },
  // Core features — available on all plans
  { label: "Barcode scanning (offline)", free: true, pro: true, business: true },
  { label: "Stock counts", free: true, pro: true, business: true },
  { label: "Stock movements ledger", free: true, pro: true, business: true },
  { label: "Reorder points & alerts config", free: true, pro: true, business: true },
  // PRO+ features
  { label: "Bin-level inventory tracking", free: null, pro: true, business: true },
  { label: "Purchase orders & scan-assisted receiving", free: null, pro: true, business: true },
  { label: "Multi-warehouse transfer wizard", free: null, pro: true, business: true },
  { label: "Putaway-to-bin workflow", free: null, pro: true, business: true },
  { label: "Low-stock alert notifications", free: null, pro: true, business: true },
  { label: "CSV & Excel exports", free: null, pro: true, business: true },
  { label: "Reports (stock value, movements, bins)", free: null, pro: true, business: true },
  // BUSINESS only
  { label: "Audit log", free: null, pro: null, business: true },
  { label: "Priority support", free: null, pro: null, business: true },
];

type Plan = {
  id: "free" | "pro" | "business";
  name: string;
  price: string;
  priceNote: string;
  description: string;
  highlight?: string;
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
    description:
      "Get started with core inventory tracking, barcode scanning, and stock counts. No credit card required.",
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
      "Unlimited items and warehouses, purchase orders, bin tracking, and full exports. Replaces Sortly Ultra at 1/5 the price.",
    highlight: "Sortly Ultra is $149/mo for just 2,000 items.",
    cta: "Start 14-day free trial",
    ctaHref: "/register",
    featured: true,
    badge: "Best value",
  },
  {
    id: "business",
    name: "Business",
    price: "$79",
    priceNote: "per month",
    description:
      "Unlimited team, audit log, and priority support. Replaces Sortly Premium at under 1/4 the price.",
    highlight: "Sortly Premium is $299/mo for 5,000 items.",
    cta: "Start 14-day free trial",
    ctaHref: "/register",
    featured: false,
  },
];

// ---------------------------------------------------------------------------
// Competitor comparison data
// ---------------------------------------------------------------------------

const COMPETITOR_ROWS = [
  {
    product: "Sortly Advanced",
    price: "$49/mo",
    items: "500 items",
    users: "2 users",
    offline: false,
    bins: false,
    pos: false,
  },
  {
    product: "Sortly Ultra",
    price: "$149/mo",
    items: "2,000 items",
    users: "5 users",
    offline: false,
    bins: false,
    pos: true,
  },
  {
    product: "Sortly Premium",
    price: "$299/mo",
    items: "5,000 items",
    users: "8 users",
    offline: false,
    bins: false,
    pos: true,
  },
  {
    product: "OneAce Pro",
    price: "$29/mo",
    items: "Unlimited",
    users: "10 users",
    offline: true,
    bins: true,
    pos: true,
    highlight: true,
  },
  {
    product: "OneAce Business",
    price: "$79/mo",
    items: "Unlimited",
    users: "Unlimited",
    offline: true,
    bins: true,
    pos: true,
    highlight: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === null) {
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  }
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-primary font-semibold" />;
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>;
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
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Full warehouse ops. Not full Sortly pricing.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            OneAce Pro includes everything Sortly Ultra does — bins, purchase orders, unlimited
            items — for{" "}
            <span className="font-semibold text-foreground">$29/month instead of $149</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Start free · No credit card · 14-day Pro trial included
          </p>
        </div>
      </section>

      {/* Plan cards — Phase 15.1: client component with monthly/annual toggle */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <PricingPlans showAnnual={hasAnnualBilling} />
      </section>

      <Separator />

      {/* Competitor comparison */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">How OneAce compares</h2>
            <p className="text-sm text-muted-foreground">
              Same warehouse operations. Dramatically lower price.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-center font-medium">Price</th>
                  <th className="px-4 py-3 text-center font-medium">Items</th>
                  <th className="px-4 py-3 text-center font-medium">Users</th>
                  <th className="px-4 py-3 text-center font-medium">Offline</th>
                  <th className="px-4 py-3 text-center font-medium">Bins</th>
                  <th className="px-4 py-3 text-center font-medium">PO / Receive</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_ROWS.map((row, idx) => (
                  <tr
                    key={row.product}
                    className={`border-b last:border-0 transition-colors hover:bg-muted/30 ${
                      row.highlight
                        ? "bg-primary/10 font-medium"
                        : idx % 2 === 0
                          ? ""
                          : "bg-muted/20"
                    }`}
                  >
                    <td className="px-4 py-3">
                      {row.product}
                      {row.highlight ? (
                        <Badge className="ml-2 bg-primary text-[10px] text-primary-foreground">
                          OneAce
                        </Badge>
                      ) : (
                        <span className="ml-2 text-xs text-muted-foreground">Sortly</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-mono text-sm ${row.highlight ? "font-bold text-primary" : ""}`}
                    >
                      {row.price}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">{row.items}</td>
                    <td className="px-4 py-3 text-center text-xs">{row.users}</td>
                    <td className="px-4 py-3 text-center">
                      {row.offline ? (
                        <Check className="mx-auto h-4 w-4 text-primary" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.bins ? (
                        <Check className="mx-auto h-4 w-4 text-primary" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.pos ? (
                        <Check className="mx-auto h-4 w-4 text-primary" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Sortly pricing as of April 2026 (monthly billing). inFlow Inventory is enterprise-only
            with no public pricing.
          </p>
        </div>
      </section>

      <Separator />

      {/* Full feature comparison */}
      <section className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Full feature comparison
          </h2>

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
                    className={`border-b last:border-0 transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
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

      {/* FAQ */}
      <section className="border-t border-border/60 bg-muted/20 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Common questions</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                q: "What happens at the Free item limit?",
                a: "You can view and manage your 100 existing items. Creating item 101 requires a Pro upgrade.",
              },
              {
                q: "Can I use multiple warehouses on Free?",
                a: "Free includes 1 warehouse location. Adding a second location requires Pro or Business.",
              },
              {
                q: "Is there a minimum contract?",
                a: hasAnnualBilling
                  ? "No. Monthly plans cancel anytime. Annual plans are billed upfront — unused months are refunded on cancellation."
                  : "No. All paid plans are billed monthly. Cancel anytime, no questions.",
              },
              {
                q: "What if I downgrade and already have more items than the limit?",
                a: "Existing data is never deleted on downgrade. You keep read access — just can't add more until you upgrade.",
              },
              {
                q: "Can I change plans later?",
                a: "Yes. Upgrade or downgrade anytime. Changes take effect immediately.",
              },
              {
                q: "Does Free really include offline stock counts?",
                a: "Yes. Offline-first counting is core to OneAce and available on all plans, including Free.",
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
      <section className="border-t border-border/60 px-4 py-12 text-center sm:px-6 sm:py-16">
        <div className="mx-auto max-w-md space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Ready to get started?</h2>
          <p className="text-sm text-muted-foreground">
            Free account in 60 seconds. 14-day Pro trial included.
          </p>
          <Button size="lg" asChild className="w-full sm:w-auto shadow-sm">
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
