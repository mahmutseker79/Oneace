/**
 * Phase 12.1 — Landing page at /.
 *
 * Logged-in users are redirected to /dashboard (preserving existing behavior).
 * Logged-out visitors see the public landing page.
 *
 * This file lives at src/app/page.tsx (root) and uses the root layout
 * (src/app/layout.tsx). Marketing nav + footer are imported directly from
 * shared components so the (marketing) route group layout can reuse them too.
 */

import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Package,
  ScanLine,
  Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "OneAce — Inventory Management for Growing Businesses",
  description:
    "Offline-first inventory management with barcode scanning, multi-warehouse support, stock counts, and purchase order receiving. Simpler than inFlow, more powerful than Sortly.",
  openGraph: {
    title: "OneAce — Inventory Management for Growing Businesses",
    description:
      "Offline-first inventory management with barcode scanning, multi-warehouse support, and real-time stock counts.",
    type: "website",
  },
};

// ---------------------------------------------------------------------------
// Feature data (grounded in real implemented features)
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: ScanLine,
    title: "Barcode scanning that actually works",
    description:
      "Continuous scan mode, audio feedback, and unknown-item quick-add. Scan 30 items in 90 seconds — without internet.",
  },
  {
    icon: ClipboardList,
    title: "Offline stock counts",
    description:
      "Multiple operators can count the same warehouse simultaneously. Conflicts are detected and surfaced for manual resolution. Results sync when reconnected.",
  },
  {
    icon: Warehouse,
    title: "Multi-warehouse and bin-level tracking",
    description:
      "Manage stock across multiple locations. Assign stock to specific bins, shelves, or zones. Transfer items between locations with a guided wizard.",
  },
  {
    icon: Package,
    title: "Purchase orders and receiving",
    description:
      "Create POs, send to suppliers, and receive stock with barcode-assisted receiving. Auto-increment quantities as you scan arriving goods.",
  },
  {
    icon: BarChart3,
    title: "Reports and exports",
    description:
      "Low-stock alerts, stock-value by location, bin inventory, and movement history. Export to CSV or Excel for finance and operations.",
  },
  {
    icon: CheckCircle2,
    title: "Role-based permissions",
    description:
      "OWNER, ADMIN, MANAGER, MEMBER, and VIEWER roles with granular capability control. Invite teammates by email.",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Receive stock",
    body: "Scan incoming goods against a purchase order. Quantities auto-populate as you scan. Post the receipt in one click.",
  },
  {
    step: "02",
    title: "Assign to bins",
    body: "After receiving, guided putaway assigns stock to specific bins or shelves. Know exactly where every unit lives.",
  },
  {
    step: "03",
    title: "Count and adjust",
    body: "Run offline stock counts with multiple operators in parallel. Resolve discrepancies before posting adjustments.",
  },
  {
    step: "04",
    title: "Transfer and fulfil",
    body: "Move items between warehouses with the transfer wizard. Scan items in the transfer step to add lines instantly.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LandingPage() {
  // Logged-in users go directly to the app.
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-accent/40 to-background px-4 py-20 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-4xl space-y-8 text-center">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
              Inventory management for SMBs
            </Badge>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Your inventory, <span className="text-primary">always in sync</span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Offline-first stock management with barcode scanning, multi-warehouse tracking, and
              real-time stock counts. Built for warehouse operators, not spreadsheet enthusiasts.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/register">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/login">Sign in to your account</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              No credit card required · Free plan available · Setup in 5 minutes
            </p>
          </div>
        </section>

        {/* ── Positioning ────────────────────────────────────────────── */}
        <section className="border-b border-border/60 px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Designed for operations, not accounting
            </h2>
            <p className="text-muted-foreground">
              Most inventory software is built for finance teams. OneAce is built for the people who
              actually move stock — warehouse operators, receiving staff, and store managers who
              need speed, accuracy, and offline reliability.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium">
              {[
                "Works offline",
                "Barcode-first UX",
                "Multi-operator stock counts",
                "Bin-level tracking",
                "Role-based access",
                "CSV & Excel exports",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────── */}
        <section className="border-b border-border/60 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold sm:text-3xl">
                Everything you need. Nothing you don&apos;t.
              </h2>
              <p className="text-muted-foreground">
                Core warehouse operations, covered end to end.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.title}
                    className="border-border/60 transition-shadow hover:shadow-sm"
                  >
                    <CardHeader className="pb-2">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base font-semibold">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Workflow ────────────────────────────────────────────────── */}
        <section className="border-b border-border/60 bg-muted/20 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-semibold sm:text-3xl">One complete workflow</h2>
              <p className="text-muted-foreground">
                From receiving goods to shipping them — every step is guided and audited.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((step) => (
                <div key={step.step} className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary">
                    {step.step}
                  </div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing teaser ──────────────────────────────────────────── */}
        <section className="border-b border-border/60 px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">Simple pricing. Start free.</h2>
            <p className="text-muted-foreground">
              OneAce starts free with no credit card required. Scale to PRO or BUSINESS as your team
              grows.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────── */}
        <section className="bg-primary px-4 py-16 text-primary-foreground sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Ready to take control of your inventory?
            </h2>
            <p className="text-primary-foreground/80">
              Set up your first location and item in under 5 minutes. No training required.
            </p>
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="bg-background text-foreground hover:bg-background/90"
            >
              <Link href="/register">
                Create a free account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
