import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { ReasonCategory, ReasonCode } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import type { Metadata } from "next";
import { ReasonCodeTableClient } from "./reason-code-table-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: "Reason Codes" };
}

export default async function ReasonCodesPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

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
    VARIANCE: "bg-orange-100 text-orange-900",
    ADJUSTMENT: "bg-blue-100 text-blue-900",
    TRANSFER: "bg-purple-100 text-purple-900",
    RETURN: "bg-green-100 text-green-900",
    DISPOSAL: "bg-red-100 text-red-900",
    COUNT: "bg-yellow-100 text-yellow-900",
    OTHER: "bg-gray-100 text-gray-900",
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
