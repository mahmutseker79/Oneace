import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Package,
  ScanLine,
  Settings,
  Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buildMarketingMetadata } from "@/lib/seo/marketing-metadata";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Documentation",
  description:
    "Learn how to set up and use OneAce for inventory management, stock counts, barcode scanning, and warehouse operations.",
  path: "/docs",
});

// ---------------------------------------------------------------------------
// Doc section data
// ---------------------------------------------------------------------------

const DOC_SECTIONS = [
  {
    icon: Package,
    title: "Getting started",
    description: "Create your organization, add items, and set up your first location.",
    href: "/docs/getting-started",
    topics: [
      "Create your account",
      "Add your first item",
      "Set up a warehouse location",
      "Record your first stock movement",
    ],
  },
  {
    icon: ScanLine,
    title: "Barcode scanning",
    description: "Use continuous scan mode to process items faster with audio feedback.",
    href: "/docs/scanning",
    topics: [
      "Scan from the /scan page",
      "Continuous scan mode",
      "Unknown barcode quick-add",
      "Scan history",
    ],
  },
  {
    icon: ClipboardList,
    title: "Stock counts",
    description: "Run accurate physical stock counts — offline, with multiple operators.",
    href: "/docs/stock-counts",
    topics: [
      "Create a stock count",
      "Count in offline mode",
      "Multi-operator counting",
      "Reconcile and post",
    ],
  },
  {
    icon: Warehouse,
    title: "Warehouses, bins & transfers",
    description: "Manage multiple locations and move stock between them.",
    href: "/docs/warehouses",
    topics: [
      "Add locations",
      "Set up bins (sub-locations)",
      "Transfer stock between locations",
      "Putaway after receiving",
    ],
  },
  {
    icon: Package,
    title: "Purchase orders & receiving",
    description: "Create POs, receive goods, and auto-update stock levels.",
    href: "/docs/purchase-orders",
    topics: [
      "Create a purchase order",
      "Scan-assisted receiving",
      "Partial receiving",
      "Putaway received stock to bins",
    ],
  },
  {
    icon: BarChart3,
    title: "Reports & exports",
    description: "Monitor stock levels, movements, and export data for finance.",
    href: "/docs/reports",
    topics: [
      "Low stock report",
      "Stock value report",
      "Bin inventory report",
      "Movement history",
      "Export to CSV or Excel",
    ],
  },
  {
    icon: Settings,
    title: "Team & permissions",
    description: "Invite teammates and control what each role can access.",
    href: "/docs/permissions",
    topics: [
      "Invite team members",
      "Role overview (OWNER, ADMIN, MANAGER, MEMBER, VIEWER)",
      "What each role can do",
      "Transfer ownership",
    ],
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocsIndexPage() {
  return (
    <div className="space-y-0">
      {/* Header */}
      <section className="border-b border-border/60 bg-gradient-to-b from-accent/30 to-background px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Documentation</h1>
          <p className="text-lg text-muted-foreground">
            Everything you need to set up OneAce and run your warehouse operations.
          </p>
        </div>
      </section>

      {/* Quick start */}
      <section className="border-b border-border/60 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <h2 className="text-xl font-semibold">Quick start</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            {[
              { step: "1", text: "Create a free account at /register" },
              { step: "2", text: "Add your first item (Items → New item)" },
              { step: "3", text: "Create a warehouse location (Warehouses → New location)" },
              {
                step: "4",
                text: "Receive your first stock (Purchase orders → Receive, or Movements → Receipt)",
              },
              {
                step: "5",
                text: "Run a stock count to verify accuracy (Stock counts → New count)",
              },
            ].map((item) => (
              <li key={item.step} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {item.step}
                </span>
                <span className="pt-0.5">{item.text}</span>
              </li>
            ))}
          </ol>
          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Create your free account
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <Separator />

      {/* Section cards */}
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <h2 className="text-xl font-semibold">All topics</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DOC_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.title}
                  className="flex flex-col border-border/60 transition-shadow hover:shadow-sm"
                >
                  <CardHeader className="pb-2">
                    <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription className="text-xs">{section.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-1">
                      {section.topics.map((topic) => (
                        <li
                          key={topic}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Help CTA */}
      <section className="border-t border-border/60 bg-muted/20 px-4 py-10 text-center sm:px-6">
        <div className="mx-auto max-w-md space-y-3">
          <p className="font-medium">Can&apos;t find what you need?</p>
          <p className="text-sm text-muted-foreground">
            The app is the best guide — every action has inline help text. If you&apos;re stuck,
            reach out to support.
          </p>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Open the app →
          </Link>
        </div>
      </section>
    </div>
  );
}
