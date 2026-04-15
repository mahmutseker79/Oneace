"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { Bell, Menu, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  NotificationCenter,
  type NotificationCenterLabels,
  type NotificationItem,
} from "@/components/shell/notification-center";
import { OrgSwitcher, type OrgSwitcherOption } from "@/components/shell/org-switcher";

export type HeaderLabels = {
  searchPlaceholder: string;
  searchLabel: string;
  notifications: string;
  openMenu: string;
  organization: string;
  organizationCreate: string;
  signOut: string;
};

type HeaderProps = {
  userName?: string | null;
  organizations: OrgSwitcherOption[];
  activeOrganizationId: string;
  labels: HeaderLabels;
  onMenuClick?: () => void;
  // P10.2 — notification center data
  notifications?: NotificationItem[];
  unreadCount?: number;
  notificationLabels?: NotificationCenterLabels;
};

export function Header({
  userName,
  organizations,
  activeOrganizationId,
  labels,
  onMenuClick,
  notifications,
  unreadCount,
  notificationLabels,
}: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(currentQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep the input in sync when the user navigates directly to /search?q=...
  // or clears the URL. Without this, going back in history would show stale
  // text in the box.
  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  // Phase 13.1 — Cmd+K / Ctrl+K keyboard shortcut to focus the search box.
  // Standard power-user affordance: works like VS Code, Linear, Notion.
  // Skips if the active element is already an input/textarea to avoid
  // clobbering edits in forms elsewhere on the page.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        const active = document.activeElement;
        const isTyping =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable);
        if (isTyping) return;
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (userName ?? "OA")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 px-4 backdrop-blur lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label={labels.openMenu}
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-xl lg:min-w-[280px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search items, locations..."
          className="border-border/50 bg-muted/50 pl-9 pr-16 rounded-lg"
          aria-label={labels.searchLabel}
        />
        {/* Phase 13.1 — keyboard shortcut hint badge */}
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <OrgSwitcher
          options={organizations}
          activeId={activeOrganizationId}
          label={labels.organization}
          createLabel={labels.organizationCreate}
        />

        {notifications && notificationLabels ? (
          <NotificationCenter
            notifications={notifications}
            unreadCount={unreadCount ?? 0}
            labels={notificationLabels}
            bellLabel={labels.notifications}
          />
        ) : (
          <Button variant="ghost" size="icon" aria-label={labels.notifications}>
            <Bell className="h-4 w-4" />
          </Button>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-full p-1 hover:bg-accent"
          title={labels.signOut}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </div>
    </header>
  );
}
