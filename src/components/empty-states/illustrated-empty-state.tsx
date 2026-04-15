/**
 * Illustrated Empty State Component (P9.4d)
 *
 * A reusable, polished empty state component with:
 * - Large lucide-react icon in a muted container
 * - Title and description
 * - Primary and optional secondary CTA buttons
 * - Clean, centered layout with subtle border
 *
 * Use this component for first-time user states, no-search-results, etc.
 */

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type IllustratedEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
};

export function IllustratedEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: IllustratedEmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md border border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          {/* Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild>
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
            {secondaryAction ? (
              <Button variant="outline" asChild>
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
