import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { hasAnnualBilling, hasStripe } from "@/lib/stripe";

import { BillingPage } from "./billing-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: `Billing — ${t.settings.metaTitle ?? "Settings"}` };
}

type SearchParams = Promise<{ success?: string; cancelled?: string }>;

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { membership } = await requireActiveMembership();

  // Phase 13.4 — load usage counts for limit indicators in billing UI
  const [org, currentItems, currentWarehouses, currentMembers] = await Promise.all([
    db.organization.findUnique({
      where: { id: membership.organizationId },
      select: { plan: true, stripeCustomerId: true },
    }),
    db.item.count({ where: { organizationId: membership.organizationId } }),
    db.warehouse.count({
      where: { organizationId: membership.organizationId, isArchived: false },
    }),
    db.membership.count({ where: { organizationId: membership.organizationId } }),
  ]);

  const sp = (await searchParams) ?? {};

  return (
    <div className="max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <BillingPage
        plan={(org?.plan ?? "FREE") as "FREE" | "PRO" | "BUSINESS"}
        canManageBilling={hasCapability(membership.role, "org.billing")}
        hasStripe={hasStripe}
        hasAnnualBilling={hasAnnualBilling}
        hasCustomer={Boolean(org?.stripeCustomerId)}
        checkoutSuccess={sp.success === "1"}
        checkoutCancelled={sp.cancelled === "1"}
        currentItems={currentItems}
        currentWarehouses={currentWarehouses}
        currentMembers={currentMembers}
      />
    </div>
  );
}
