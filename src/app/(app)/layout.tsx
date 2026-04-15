import { OfflineQueueBanner } from "@/components/offline/offline-queue-banner";
import { OfflineQueueRunner } from "@/components/offline/offline-queue-runner";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { InstallBanner } from "@/components/pwa/install-banner";
import { SwRegister } from "@/components/pwa/sw-register";
import { UpdatePrompt } from "@/components/pwa/update-prompt";
import { AppShellClient } from "@/components/shell/app-shell-client";
import { Sidebar } from "@/components/shell/sidebar";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { session, membership, memberships } = await requireActiveMembership();
  const t = await getMessages();

  const orgOptions = memberships.map((m) => ({
    id: m.organizationId,
    name: m.organization.name,
  }));

  const queueScope = {
    orgId: membership.organizationId,
    userId: session.user.id,
  };

  // ── P8.2 — Low-stock badge for sidebar ────────────────────────────
  // Lean query: only items with reorderPoint configured (typically small
  // subset). Indexed by organizationId. Cost: ~1-3ms on warm DB.
  const lowStockBadge = await (async () => {
    const itemsWithReorder = await db.item.findMany({
      where: {
        organizationId: membership.organizationId,
        status: "ACTIVE",
        reorderPoint: { gt: 0 },
      },
      select: {
        reorderPoint: true,
        stockLevels: { select: { quantity: true } },
      },
    });
    const count = itemsWithReorder.filter((item) => {
      const onHand = item.stockLevels.reduce((sum, l) => sum + l.quantity, 0);
      return onHand <= item.reorderPoint;
    }).length;
    return count > 0 ? String(count) : undefined;
  })();

  // P10.1 — admin section visible only to roles that can manage team,
  // view audit, or edit org settings.
  const showAdmin =
    hasCapability(membership.role, "team.invite") ||
    hasCapability(membership.role, "audit.view") ||
    hasCapability(membership.role, "org.editProfile");

  // ── P10.2 — Notification center data ──────────────────────────────
  // Query recent notifications for the current user. Lean: 20 most
  // recent, only the fields the UI needs. Separate count query for
  // the unread badge to avoid over-fetching.
  const [recentNotifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: {
        userId: session.user.id,
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
        title: true,
        message: true,
        href: true,
        alertId: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.notification.count({
      where: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        readAt: null,
      },
    }),
  ]);

  // Serialize dates for the client component
  const notificationItems = recentNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    href: n.href,
    alertId: n.alertId,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>
      <SwRegister />
      <OfflineQueueRunner orgId={queueScope.orgId} userId={queueScope.userId} />
      <Sidebar
        labels={{
          brand: t.app.name,
          versionLine: `${t.app.name} · v0.1.0`,
          statusLine: "Sprint 0 scaffold",
          nav: t.nav,
          badges: { items: lowStockBadge },
          showAdmin,
        }}
      />
      <div className="lg:pl-64">
        <InstallBanner />
        <UpdatePrompt
          labels={{
            message: t.pwa.update.message,
            reloadCta: t.pwa.update.reloadCta,
            dismissCta: t.pwa.update.dismissCta,
          }}
        />
        <AppShellClient
          userName={session.user.name}
          organizations={orgOptions}
          activeOrganizationId={membership.organizationId}
          headerLabels={{
            searchPlaceholder: t.header.searchPlaceholder,
            searchLabel: t.header.searchLabel,
            notifications: t.header.notifications,
            openMenu: t.header.openMenu,
            organization: t.common.organization,
            organizationCreate: t.organizations.switcherCreateLabel,
            signOut: t.header.signOut,
          }}
          sidebarLabels={{
            brand: t.app.name,
            versionLine: `${t.app.name} · v0.1.0`,
            statusLine: "Sprint 0 scaffold",
            nav: t.nav,
            badges: { items: lowStockBadge },
            showAdmin,
          }}
          notifications={notificationItems}
          unreadCount={unreadCount}
          notificationLabels={{
            heading: t.notifications.heading,
            empty: t.notifications.empty,
            markAllRead: t.notifications.markAllRead,
            dismiss: t.notifications.dismiss,
          }}
        />
        <OfflineQueueBanner
          scope={queueScope}
          labels={{
            pendingOnline: t.offline.queue.pendingOnline,
            pendingOffline: t.offline.queue.pendingOffline,
            failed: t.offline.queue.failed,
            reviewCta: t.offline.queue.reviewCta,
          }}
        />
        <div className="flex justify-end px-4 pt-2 lg:px-6">
          <InstallAppButton labels={{ install: t.pwa.install.cta }} />
        </div>
        <main id="main-content" className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
