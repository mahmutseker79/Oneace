import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  Package,
  ScanLine,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.dashboard.metaTitle };
}

export default async function DashboardPage() {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  // Sprint 0: static placeholders — wired up to real data in Sprint 2.
  const kpis = [
    {
      label: t.dashboard.kpi.totalItems,
      value: "0",
      change: t.dashboard.kpi.totalItemsChange,
      icon: Package,
    },
    {
      label: t.dashboard.kpi.stockValue,
      value: formatCurrency(0, { currency: region.currency, locale: region.numberLocale }),
      change: t.dashboard.kpi.stockValueChange,
      icon: TrendingUp,
    },
    {
      label: t.dashboard.kpi.lowStock,
      value: "0",
      change: t.dashboard.kpi.lowStockChange,
      icon: AlertTriangle,
    },
    {
      label: t.dashboard.kpi.activeCounts,
      value: "0",
      change: t.dashboard.kpi.activeCountsChange,
      icon: ClipboardCheck,
    },
  ];

  const greeting = session.user.name
    ? format(t.dashboard.greeting, { name: session.user.name })
    : t.dashboard.greetingFallback;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{greeting}</h1>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{membership.organization.name}</span>
            {" · "}
            {t.dashboard.orgSubtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ScanLine className="h-4 w-4" />
            {t.dashboard.startScan}
          </Button>
          <Button>
            <Package className="h-4 w-4" />
            {t.dashboard.newItem}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sprint 0 welcome card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t.dashboard.sprintCard.badge}</Badge>
            <CardTitle>{t.dashboard.sprintCard.title}</CardTitle>
          </div>
          <CardDescription>{t.dashboard.sprintCard.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-[var(--count-completed)]" />
                <span className="text-sm font-medium">{t.dashboard.sprintCard.sprint1Title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.dashboard.sprintCard.sprint1Body}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-[var(--count-pending)]" />
                <span className="text-sm font-medium">{t.dashboard.sprintCard.sprint3Title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.dashboard.sprintCard.sprint3Body}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-[var(--count-pending)]" />
                <span className="text-sm font-medium">{t.dashboard.sprintCard.sprint5Title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.dashboard.sprintCard.sprint5Body}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <a href="/OneAce_Roadmap.md" target="_blank" rel="noopener noreferrer">
              {t.dashboard.sprintCard.roadmap}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
