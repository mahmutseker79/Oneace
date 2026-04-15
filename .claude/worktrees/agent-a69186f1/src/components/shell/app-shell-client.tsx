"use client";

import { useState } from "react";

import { Header, type HeaderLabels } from "./header";
import { MobileNav } from "./mobile-nav";
import type { SidebarLabels } from "./sidebar";
import type { OrgSwitcherOption } from "./org-switcher";

type AppShellClientProps = {
  userName?: string | null;
  organizations: OrgSwitcherOption[];
  activeOrganizationId: string;
  headerLabels: HeaderLabels;
  sidebarLabels: SidebarLabels;
};

export function AppShellClient({
  userName,
  organizations,
  activeOrganizationId,
  headerLabels,
  sidebarLabels,
}: AppShellClientProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <Header
        userName={userName}
        organizations={organizations}
        activeOrganizationId={activeOrganizationId}
        labels={headerLabels}
        onMenuClick={() => setMobileNavOpen(true)}
      />
      <MobileNav
        labels={sidebarLabels}
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
      />
    </>
  );
}
