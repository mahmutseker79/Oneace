import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
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

type SearchParams = Promise<{
  success?: string;
  cancelled?: string;
  // Phase 16.3 — billing intent fallback from register flow
  plan?: string;
  interval?: string;
  // Phase 1 UX — portal return: ?portal=1 triggers a data refresh
  // so the page reflects any changes made in the Stripe billing portal.
  portal?: string;
}>;

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { membership } = await requireActiveMembership();

  // Phase 13.4 — load usage counts for limit indicators in billing UI
  // Phase 16.2 — also load billingInterval, cancelAtPeriodEnd, cancelAt
  const [org, currentItems, currentWarehouses, currentMembers] = await Promise.all([
    db.organization.findUnique({
      where: { id: membership.organizationId },
      select: {
        plan: true,
        stripeCustomerId: true,
        billingInterval: true,
        cancelAtPeriodEnd: true,
        cancelAt: true,
      },
    }),
    db.item.count({ where: { organizationId: membership.organizationId } }),
    db.warehouse.count({
      where: { organizationId: membership.organizationId, isArchived: false },
    }),
    db.membership.count({ where: { organizationId: membership.organizationId } }),
  ]);

  const sp = (await searchParams) ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing information"
        breadcrumb={[
          { label: "Settings", href: "/settings" },
          { label: "Billing", href: "#" },
        ]}
        backHref="/settings"
      />
      <div className="max-w-2xl space-y-6 px-4 py-6 sm:px-6">
        <BillingPage
          plan={(org?.plan ?? "FREE") as "FREE" | "PRO" | "BUSINESS"}
          canManageBilling={hasCapability(membership.role, "org.billing")}
          hasStripe={hasStripe}
          hasAnnualBilling={hasAnnualBilling}
          hasCustomer={Boolean(org?.stripeCustomerId)}
          checkoutSuccess={sp.success === "1"}
          checkoutCancelled={sp.cancelled === "1"}
          portalReturn={sp.portal === "1"}
          // Phase 16.3 — billing intent fallback (from register when Stripe checkout failed)
          intentPlan={sp.plan === "PRO" || sp.plan === "BUSINESS" ? sp.plan : undefined}
          intentInterval={
            sp.interval === "year" ? "year" : sp.interval === "month" ? "month" : undefined
          }
          currentItems={currentItems}
          currentWarehouses={currentWarehouses}
          currentMembers={currentMembers}
          // Phase 16.2 — subscription truth
          billingInterval={(org?.billingInterval ?? "month") as "month" | "year"}
          cancelAtPeriodEnd={org?.cancelAtPeriodEnd ?? false}
          cancelAt={org?.cancelAt?.toISOString() ?? null}
        />
      </div>
    </div>
  );
}
