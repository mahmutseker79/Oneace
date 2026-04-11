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

  return (
    <div className="min-h-screen">
      <Sidebar
        labels={{
          brand: t.app.name,
          versionLine: `${t.app.name} · v0.1.0`,
          statusLine: "Sprint 0 scaffold",
          nav: t.nav,
        }}
      />
      <div className="lg:pl-64">
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
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
