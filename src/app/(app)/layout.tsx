import { headers } from "next/headers";

import { OfflineQueueBanner } from "@/components/offline/offline-queue-banner";
import { OfflineQueueRunner } from "@/components/offline/offline-queue-runner";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { InstallBanner } from "@/components/pwa/install-banner";
import { SwRegister } from "@/components/pwa/sw-register";
import { UpdatePrompt } from "@/components/pwa/update-prompt";
import { AppShellClient } from "@/components/shell/app-shell-client";
import { Sidebar } from "@/components/shell/sidebar";
// P1-5 (audit v1.0 §5.10): app shell queries are tag-cached so the
// layout doesn't re-run three DB queries on every server-rendered nav.
import { getLowStockBadge, getNotificationData } from "@/lib/cache/app-shell-cache";
// P1-6 (audit v1.0 §5.12): version label derived from build-time env
// so the sidebar no longer reads a hardcoded "v0.1.0 · Sprint 0 scaffold".
import { getAppVersionLine } from "@/lib/app-version";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership, requireSession } from "@/lib/session";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // P0-3 — onboarding loop guard.
  //
  // `requireActiveMembership` redirects to /onboarding when the user has
  // zero memberships. The onboarding page itself lives at (app)/onboarding,
  // so without this short-circuit a first-run user would hit an infinite
  // redirect: /dashboard → /onboarding → layout → /onboarding → ... .
  //
  // Middleware stamps the request pathname onto `x-pathname` so the layout
  // can identify the onboarding render and skip the app shell. Session
  // validity is still enforced — the onboarding page itself calls
  // `requireSession()`, and middleware already bounced unauthenticated
  // requests to /login before we got here. We call `requireSession()` here
  // too as a defense-in-depth check (middleware only looks at cookie
  // presence, this validates the session against the DB).
  const heads = await headers();
  const pathname = heads.get("x-pathname");
  if (pathname === "/onboarding") {
    await requireSession();
    return <>{children}</>;
  }

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

  // ── P1-5 — App shell queries (tag-cached) ─────────────────────────
  // The layout re-renders for every server navigation in the app, so
  // these three queries used to run dozens of times per session even
  // though the underlying state changes infrequently. Both helpers
  // live in `@/lib/cache/app-shell-cache` and are invalidated by
  // `revalidateLowStock` / `revalidateNotifications` from mutation
  // paths (item edits, reorder config, notification reads, etc.).
  const [lowStockBadge, { items: notificationItems, unreadCount }] = await Promise.all([
    getLowStockBadge(membership.organizationId),
    getNotificationData(membership.organizationId, session.user.id),
  ]);

  // P10.1 — admin section visible only to roles that can manage team,
  // view audit, or edit org settings.
  const showAdmin =
    hasCapability(membership.role, "team.invite") ||
    hasCapability(membership.role, "audit.view") ||
    hasCapability(membership.role, "org.editProfile");

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
          versionLine: getAppVersionLine(t.app.name),
          statusLine: "",
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
            versionLine: getAppVersionLine(t.app.name),
            statusLine: "",
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
        <main id="main-content" className="p-4 sm:p-5 lg:p-6 max-w-[1400px]">
          {children}
        </main>
      </div>
    </div>
  );
}
