"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export type CompactBridgeLabels = {
  label: string;
  dismissLabel: string;
};

type BridgeLink = {
  title: string;
  href: string;
};

type CompactBridgeProps = {
  links: BridgeLink[];
  labels: CompactBridgeLabels;
  dismissAction: () => Promise<void>;
};

/**
 * P7.2 — Compact single-row bridge shown after 3+ visits to the
 * post-setup bridge. Renders as a pill bar with quick-links and a
 * dismiss button. Once dismissed, the parent stops rendering it
 * entirely (server-side gated by `uiState.bridgeDismissed`).
 */
export function CompactBridge({ links, labels, dismissAction }: CompactBridgeProps) {
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    startTransition(async () => {
      await dismissAction();
    });
  }

  if (isPending) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span className="font-medium text-muted-foreground">{labels.label}</span>
      {links.map((link) => (
        <Button key={link.href} variant="outline" size="sm" className="h-7 text-xs" asChild>
          <Link href={link.href}>
            {link.title}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      ))}
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-auto text-muted-foreground hover:text-foreground"
        aria-label={labels.dismissLabel}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
