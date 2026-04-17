/**
 * Phase D — Create scheduled report page
 *
 * Thin server shell that checks plan capability then renders the client
 * form. Plan enforcement also happens in the server action as a
 * belt-and-suspenders guard.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

import { CreateScheduledReportForm } from "./create-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "New Scheduled Report — OneAce" };
}

export default async function NewScheduledReportPage() {
  const { membership } = await requireActiveMembership();
  const plan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";

  if (!hasPlanCapability(plan, "scheduledReports")) {
    // User reached the URL directly despite the paywall on the list page.
    // Bounce them back to the list where the upgrade CTA lives.
    redirect("/reports/scheduled");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New scheduled report"
        description="Choose a report, a schedule, and who receives it."
        breadcrumb={[
          { label: "Reports", href: "/reports" },
          { label: "Scheduled", href: "/reports/scheduled" },
          { label: "New" },
        ]}
      />
      <CreateScheduledReportForm />
    </div>
  );
}
