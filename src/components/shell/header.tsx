"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { Bell, Menu, Search } from "lucide-react";
import { useRouter } from "next/navigation";

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
  organizationName?: string;
  labels: HeaderLabels;
};

export function Header({ userName, organizationName, labels }: HeaderProps) {
  const router = useRouter();

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

      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={labels.searchPlaceholder}
          className="pl-9"
          aria-label={labels.searchLabel}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {organizationName ? (
          <div className="hidden md:flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">{labels.organization}:</span>
            <span className="font-medium">{organizationName}</span>
          </div>
        ) : null}

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
