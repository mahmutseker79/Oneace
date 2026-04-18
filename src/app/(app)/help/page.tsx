// v1.5 Navigation IA — Help route stub.
//
// The secondary sidebar section (Team / Integrations / Settings / Help)
// needs a destination for "Help" so the nav entry doesn't 404. We keep
// the page intentionally lightweight: a welcome card pointing at the
// docs site + a short FAQ list. Richer support surfaces (live chat,
// status page embed, etc.) can be added without touching nav wiring.

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/lib/i18n";

export const metadata = {
  title: "Help",
  description: "Find product docs, release notes, and ways to contact support.",
};

export default async function HelpPage() {
  // Fetch messages so future-i18n'd copy can be swapped in without a
  // second pass. Today's strings are English-only per the rest of /help
  // being an external docs destination.
  await getMessages();

  const quickLinks = [
    {
      title: "Product documentation",
      body: "Guides, tutorials, and API references for every OneAce module.",
      href: "https://docs.oneace.app",
      external: true,
      cta: "Open docs",
    },
    {
      title: "Release notes",
      body: "Changelog with the latest features, fixes, and breaking changes.",
      href: "https://docs.oneace.app/changelog",
      external: true,
      cta: "View changelog",
    },
    {
      title: "Contact support",
      body: "Send the OneAce team a message — we reply within one business day.",
      href: "mailto:support@oneace.app",
      external: true,
      cta: "Email support",
    },
    {
      title: "Status page",
      body: "Live uptime for the API, dashboard, and background workers.",
      href: "https://status.oneace.app",
      external: true,
      cta: "View status",
    },
  ];

  const quickStart = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Inventory", href: "/items" },
    { label: "Locations", href: "/warehouses" },
    { label: "Counts", href: "/stock-counts" },
    { label: "Orders", href: "/purchase-orders" },
    { label: "Reports", href: "/reports" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
            <Badge variant="secondary">v1.5</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Documentation, release notes, and support channels — everything you need to get unstuck
            without leaving the dashboard.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Card key={link.title}>
            <CardHeader>
              <CardTitle className="text-base">{link.title}</CardTitle>
              <CardDescription>{link.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <a
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noreferrer" : undefined}
                >
                  {link.cta}
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jump to the core workflow</CardTitle>
          <CardDescription>
            Stuck on something? These six pages cover the day-to-day OneAce flow; open any of them
            to return to the product.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {quickStart.map((q) => (
            <Button key={q.href} asChild variant="ghost" size="sm">
              <Link href={q.href}>{q.label}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
