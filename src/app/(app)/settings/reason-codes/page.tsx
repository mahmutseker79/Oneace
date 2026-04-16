import { PageHeader } from "@/components/ui/page-header";
import type { ReasonCategory, ReasonCode } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import type { Metadata } from "next";
import { ReasonCodeTableClient } from "./reason-code-table-client";

export async function generateMetadata(): Promise<Metadata> {
  const _t = await getMessages();
  return { title: "Reason Codes" };
}

export default async function ReasonCodesPage() {
  const { membership } = await requireActiveMembership();
  const _t = await getMessages();

  // Fetch all reason codes for the organization
  const reasonCodes = await db.reasonCode.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Group by category for display
  const grouped = new Map<ReasonCategory, ReasonCode[]>();
  for (const code of reasonCodes) {
    if (!grouped.has(code.category)) {
      grouped.set(code.category, []);
    }
    grouped.get(code.category)?.push(code);
  }

  const categoryLabels: Record<ReasonCategory, string> = {
    VARIANCE: "Variance",
    ADJUSTMENT: "Adjustment",
    TRANSFER: "Transfer",
    RETURN: "Return",
    DISPOSAL: "Disposal",
    COUNT: "Count",
    OTHER: "Other",
  };

  const categoryColors: Record<ReasonCategory, string> = {
    VARIANCE: "bg-warning-light text-warning",
    ADJUSTMENT: "bg-info-light text-info",
    TRANSFER: "bg-primary/10 text-primary",
    RETURN: "bg-success-light text-success",
    DISPOSAL: "bg-destructive-light text-destructive",
    COUNT: "bg-warning-light text-warning",
    OTHER: "bg-muted text-foreground",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reason Codes"
        description="Manage reason codes for stock adjustments, variances, and movements"
        breadcrumb={[
          { label: "Settings", href: "/settings" },
          { label: "Reason Codes", href: "#" },
        ]}
        backHref="/settings"
      />

      <ReasonCodeTableClient
        reasonCodes={reasonCodes}
        categoryLabels={categoryLabels}
        categoryColors={categoryColors}
      />
    </div>
  );
}
