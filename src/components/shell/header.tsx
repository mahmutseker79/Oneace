"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { Bell, Menu, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { OrgSwitcher, type OrgSwitcherOption } from "@/components/shell/org-switcher";

export type HeaderLabels = {
  searchPlaceholder: string;
  searchLabel: string;
  notifications: string;
  openMenu: string;
  organization: string;
  signOut: string;
};

type HeaderProps = {
  userName?: string | null;
  organizations: OrgSwitcherOption[];
  activeOrganizationId: string;
  labels: HeaderLabels;
};

export function Header({ userName, organizations, activeOrganizationId, labels }: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(currentQuery);

  // Keep the input in sync when the user navigates directly to /search?q=...
  // or clears the URL. Without this, going back in history would show stale
  // text in the box.
  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

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
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label={labels.openMenu}>
        <Menu className="h-5 w-5" />
      </Button>

      <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.searchPlaceholder}
          className="pl-9"
          aria-label={labels.searchLabel}
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <OrgSwitcher
          options={organizations}
          activeId={activeOrganizationId}
          label={labels.organization}
        />

        <Button variant="ghost" size="icon" aria-label={labels.notifications}>
          <Bell className="h-4 w-4" />
        </Button>

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
