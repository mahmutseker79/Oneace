import { AlertTriangle, FileBarChart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.reports.metaTitle };
}

export default async function ReportsPage() {
  await requireActiveMembership();
  const t = await getMessages();

  const reports = [
    {
      href: "/reports/low-stock",
      icon: AlertTriangle,
      title: t.reports.lowStock.heading,
      description: t.reports.lowStock.subtitle,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <FileBarChart className="text-muted-foreground mt-1 h-5 w-5" />
        <div>
          <h1 className="text-2xl font-semibold">{t.reports.heading}</h1>
          <p className="text-muted-foreground">{t.reports.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href} className="group block">
              <Card className="h-full transition-colors group-hover:border-foreground/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="text-muted-foreground h-4 w-4" />
                    <CardTitle>{report.title}</CardTitle>
                  </div>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
