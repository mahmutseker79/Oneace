import { OfflineQueueBanner } from "@/components/offline/offline-queue-banner";
import { OfflineQueueRunner } from "@/components/offline/offline-queue-runner";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { SwRegister } from "@/components/pwa/sw-register";
import { UpdatePrompt } from "@/components/pwa/update-prompt";
import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";
import { getMessages } from "@/lib/i18n";
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

  return (
    <div className="min-h-screen">
      <SwRegister />
      <OfflineQueueRunner orgId={queueScope.orgId} userId={queueScope.userId} />
      <Sidebar
        labels={{
          brand: t.app.name,
          versionLine: `${t.app.name} · v0.1.0`,
          statusLine: "Sprint 0 scaffold",
          nav: t.nav,
        }}
      />
      <div className="lg:pl-64">
        <UpdatePrompt
          labels={{
            message: t.pwa.update.message,
            reloadCta: t.pwa.update.reloadCta,
            dismissCta: t.pwa.update.dismissCta,
          }}
        />
        <Header
          userName={session.user.name}
          organizations={orgOptions}
          activeOrganizationId={membership.organizationId}
          labels={{
            searchPlaceholder: t.header.searchPlaceholder,
            searchLabel: t.header.searchLabel,
            notifications: t.header.notifications,
            openMenu: t.header.openMenu,
            organization: t.common.organization,
            organizationCreate: t.organizations.switcherCreateLabel,
            signOut: t.header.signOut,
          }}
        />
        <OfflineQueueBanner
          scope={queueScope}
          labels={{
            pendingOnline: t.offline.queue.pendingOnline,
            pendingOffline: t.offline.queue.pendingOffline,
            failed: t.offline.queue.failed,
          }}
        />
        <div className="flex justify-end px-4 pt-2 lg:px-6">
          <InstallAppButton labels={{ install: t.pwa.install.cta }} />
        </div>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
