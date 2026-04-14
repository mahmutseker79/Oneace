"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  /** Fire-and-forget server action called on click. Never blocks navigation. */
  trackAction: () => Promise<void>;
};

/**
 * P8.6 — Thin wrapper around Next.js <Link> that fires a tracking server
 * action on click without blocking or delaying navigation.
 */
export function TrackedLink({ trackAction, onClick, ...props }: TrackedLinkProps) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Fire-and-forget — never awaited, never blocks navigation
    void trackAction();
    onClick?.(e);
  }

  return <Link {...props} onClick={handleClick} />;
}
