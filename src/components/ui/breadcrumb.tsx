"use client";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // For mobile, show truncated version if more than 3 items
  const shouldTruncate = items.length > 3;
  const displayItems = shouldTruncate ? [items[0], { label: "..." }, ...items.slice(-2)] : items;

  return (
    <nav
      className={cn("flex items-center gap-1 text-sm text-muted-foreground", className)}
      aria-label="Breadcrumb"
    >
      {/* Sprint 1 PR #1 (UX/UI audit Apr-25 §B-2): expose the trailing
          breadcrumb item as `aria-current="page"`, mark the chevron
          separators and "..." truncation as `aria-hidden` so screen
          readers don't read "right pointing chevron" or "three dots". */}
      {displayItems.map((item, index) => {
        if (!item) return null;
        const isLast = index === displayItems.length - 1;
        const isTruncated = item.label === "...";

        return (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && !isTruncated && (
              <ChevronRight
                aria-hidden="true"
                className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
              />
            )}
            {isTruncated ? (
              <span aria-hidden="true" className="px-1 text-muted-foreground">
                {item.label}
              </span>
            ) : isLast ? (
              <span aria-current="page" className="font-medium text-foreground">
                {item.label}
              </span>
            ) : item.href ? (
              <Link href={item.href} className="hover:text-foreground transition-colors truncate">
                {item.label}
              </Link>
            ) : (
              <span className="truncate">{item.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
