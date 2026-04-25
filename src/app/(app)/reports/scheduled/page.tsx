/**
 * Phase D — Scheduled Reports list page
 *
 * Shows all scheduled report runs for the current organization, with
 * active/inactive toggles and delete actions. Create flow lives at
 * /reports/scheduled/new.
 *
 * Plan-gated: scheduledReports requires the BUSINESS plan. We render a
 * banner for PRO users so they understand the upgrade path without the
 * page 404-ing.
 */

import { CalendarClock, Clock, Mail, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

import { ScheduledReportActions } from "./report-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Scheduled Reports — OneAce" };
}

export default async function ScheduledReportsPage() {
  const { membership } = await requireActiveMembership();
  const messages = await getMessages();
  const labels = messages.reports.scheduledReportActions;
  const plan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  const hasAccess = hasPlanCapability(plan, "scheduledReports");

  // We always fetch the list so existing reports keep showing even when
  // the plan has been downgraded — the server will simply skip firing
  // them until the plan is re-upgraded.
  const reports = await db.scheduledReport.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled Reports"
        description="Automate report delivery by email on a recurring schedule."
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Scheduled" }]}
        actions={
          hasAccess ? (
            <Link href="/reports/scheduled/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New scheduled report
              </Button>
            </Link>
          ) : null
        }
      />

      {!hasAccess && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <Clock className="h-5 w-5 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">Scheduled reports are a Business feature</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upgrade to Business to email reports on a recurring schedule — weekly inventory
                  summaries, monthly variance digests, and more.
                </p>
                <Link href="/billing" className="mt-3 inline-block">
                  <Button size="sm">Upgrade plan</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reports.length === 0 ? (
        // Sprint 15 PR #1 (UX/UI audit Apr-25 §B-7): inline empty pattern → EmptyState.
        <EmptyState
          icon={CalendarClock}
          title="No scheduled reports yet"
          description="When you create a scheduled report it will show up here. Each run emails the rendered report to the recipient list."
          actions={
            hasAccess
              ? [{ label: "New scheduled report", href: "/reports/scheduled/new", icon: Plus }]
              : undefined
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All reports ({reports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Report</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <code className="text-xs">{humanReportType(r.reportType)}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.format}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {humanizeCron(r.cronExpression)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {r.recipientEmails.length}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.nextSendAt ? new Date(r.nextSendAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      {r.isActive ? (
                        <Badge className="bg-success">Active</Badge>
                      ) : (
                        <Badge variant="outline">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ScheduledReportActions id={r.id} isActive={r.isActive} labels={labels} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function humanReportType(type: string): string {
  switch (type) {
    case "STOCK_VALUE":
      return "Stock Value";
    case "LOW_STOCK":
      return "Low Stock";
    case "COUNT_VARIANCE":
      return "Count Variance";
    case "MOVEMENT_HISTORY":
      return "Movement History";
    case "ABC_ANALYSIS":
      return "ABC Analysis";
    case "DEPARTMENT_VARIANCE":
      return "Department Variance";
    case "COUNT_COMPARISON":
      return "Count Comparison";
    case "STOCK_AGING":
      return "Stock Aging";
    case "SUPPLIER_PERFORMANCE":
      return "Supplier Performance";
    case "SCAN_ACTIVITY":
      return "Scan Activity";
    default:
      return type;
  }
}

/**
 * Human-readable rendering of the handful of cron patterns we support
 * in the UI. Unknown patterns fall back to the raw expression.
 */
function humanizeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [m, h, dom, , dow] = parts;
  if (dom === "*" && dow === "*") return `Daily at ${pad(h)}:${pad(m)}`;
  if (dom === "*" && dow !== "*") return `Weekly (${dayName(Number(dow))}) at ${pad(h)}:${pad(m)}`;
  if (dom !== "*" && dow === "*") return `Monthly on day ${dom} at ${pad(h)}:${pad(m)}`;
  return expr;
}

function pad(s: string | undefined): string {
  return String(s ?? "0").padStart(2, "0");
}

function dayName(dow: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow] ?? "?";
}
