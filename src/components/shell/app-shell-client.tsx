"use client";

import { useState } from "react";

import { Header, type HeaderLabels } from "./header";
import { MobileNav } from "./mobile-nav";
import type { NotificationCenterLabels, NotificationItem } from "./notification-center";
import type { OrgSwitcherOption } from "./org-switcher";
import type { SidebarLabels } from "./sidebar";

type AppShellClientProps = {
  userName?: string | null;
  organizations: OrgSwitcherOption[];
  activeOrganizationId: string;
  headerLabels: HeaderLabels;
  sidebarLabels: SidebarLabels;
  // P10.2 — notification data from server
  notifications?: NotificationItem[];
  unreadCount?: number;
  notificationLabels?: NotificationCenterLabels;
};

export function AppShellClient({
  userName,
  organizations,
  activeOrganizationId,
  headerLabels,
  sidebarLabels,
  notifications,
  unreadCount,
  notificationLabels,
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
        notifications={notifications}
        unreadCount={unreadCount}
        notificationLabels={notificationLabels}
      />
      <MobileNav labels={sidebarLabels} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </>
  );
}
