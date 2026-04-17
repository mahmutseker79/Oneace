"use client";

// Phase 2 UX — mobile nav mirrors the desktop sidebar restructure:
// Operations group added with PO, Scan, Suppliers, Categories.

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ClipboardList,

  FileDown,
  FileUp,
  FolderOpen,
  History,
  Package,
  ScanLine,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SidebarLabels } from "./sidebar";

type NavItem = {
  label: string;
  href: `/${string}`;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

export function MobileNav({
  labels,
  open,
  onOpenChange,
}: {
  labels: SidebarLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();

  const adminPaths = ["/users", "/audit", "/settings"];
  const isOnAdminPage = adminPaths.some((p) => pathname.startsWith(p));
  const [adminOpen, setAdminOpen] = useState(isOnAdminPage);

  const coreItems: NavItem[] = [
    { label: labels.nav.items, href: "/items", icon: Package, badge: labels.badges?.items },
    { label: labels.nav.warehouses, href: "/warehouses", icon: Warehouse },
    { label: labels.nav.counts, href: "/stock-counts", icon: ClipboardList },
  ];

  const operationsItems: NavItem[] = [
    { label: labels.nav.movements, href: "/movements", icon: ArrowLeftRight },
    { label: labels.nav.purchaseOrders, href: "/purchase-orders", icon: ShoppingCart },
    { label: labels.nav.scan, href: "/scan", icon: ScanLine },
    { label: labels.nav.suppliers, href: "/suppliers", icon: Truck },
    { label: labels.nav.categories, href: "/categories", icon: FolderOpen },
  ];

  const warehouseItems: NavItem[] = [
    { label: labels.nav.transfers ?? "Transfers", href: "/transfers", icon: ArrowLeftRight },
    { label: labels.nav.departments ?? "Departments", href: "/departments", icon: Warehouse },
  ];

  const commerceItems: NavItem[] = [
    { label: labels.nav.salesOrders ?? "Sales Orders", href: "/sales-orders", icon: ShoppingCart },
    { label: labels.nav.kits ?? "Kits", href: "/kits", icon: Package },
    { label: labels.nav.picks ?? "Picks", href: "/picks", icon: ClipboardList },
  ];

  const utilityItems: NavItem[] = [
    { label: labels.nav.import ?? "Import", href: "/import", icon: FileUp },
    { label: labels.nav.export ?? "Export", href: "/export", icon: FileDown },
  ];

  const analyticsItems: NavItem[] = [
    { label: labels.nav.reports, href: "/reports", icon: BarChart3 },
  ];

  const adminItems: NavItem[] = [
    { label: labels.nav.users, href: "/users", icon: Users },
    { label: labels.nav.audit, href: "/audit", icon: History },
    { label: labels.nav.settings, href: "/settings", icon: Settings },
  ];

  function renderItem(item: NavItem) {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => onOpenChange(false)}
        className={cn(
          "flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
          isActive
            ? "border-l-primary bg-accent text-accent-foreground"
            : "border-l-transparent text-foreground hover:bg-accent/60",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        {item.badge ? (
          <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              O
            </div>
            <span className="truncate">{labels.brand}</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto p-4">
          {/* Core */}
          <div className="space-y-1">{coreItems.map(renderItem)}</div>

          {/* Operations */}
          <div className="mt-6 border-t pt-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.nav.operations}
            </p>
            <div className="space-y-1">{operationsItems.map(renderItem)}</div>
          </div>

          {/* Warehouse */}
          <div className="mt-4 border-t pt-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.nav.warehouse ?? "Warehouse"}
            </p>
            <div className="space-y-1">{warehouseItems.map(renderItem)}</div>
          </div>

          {/* Commerce */}
          <div className="mt-4 border-t pt-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.nav.commerce ?? "Commerce"}
            </p>
            <div className="space-y-1">{commerceItems.map(renderItem)}</div>
          </div>

          {/* Utilities */}
          <div className="mt-4 border-t pt-4">
            <div className="space-y-1">{utilityItems.map(renderItem)}</div>
          </div>

          {/* Analytics */}
          <div className="mt-4 border-t pt-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.nav.analytics}
            </p>
            <div className="space-y-1">{analyticsItems.map(renderItem)}</div>
          </div>

          {/* Admin — collapsible (P10.1: hidden for non-admin roles) */}
          {labels.showAdmin !== false ? (
            <div className="mt-4 border-t pt-4">
              <button
                type="button"
                aria-expanded={adminOpen}
                onClick={() => setAdminOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{labels.nav.admin}</span>
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", adminOpen && "rotate-180")}
                />
              </button>
              {adminOpen ? (
                <div className="mt-1 space-y-1">{adminItems.map(renderItem)}</div>
              ) : null}
            </div>
          ) : null}
        </nav>

        <div className="border-t p-4 text-xs text-muted-foreground">
          <p>{labels.versionLine}</p>
          <p>{labels.statusLine}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
