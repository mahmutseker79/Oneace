"use client";

/*
 * OfflineQueueBanner — Sprint 25 (PWA Sprint 4 Part A).
 *
 * A quiet header-adjacent status row that tells the user how many
 * operations are waiting to sync. Sibling to the ItemsCacheBanner
 * that Sprint 23 shipped, but broader: this one reads the pending-
 * ops queue instead of a per-table read cache, and is safe to
 * mount anywhere in the app shell because it doesn't assume a
 * specific domain context.
 *
 * Visibility rules:
 *
 *   - Completely invisible when there is nothing pending, nothing
 *     in flight, and nothing failed. 95% of users 95% of the time
 *     should never see this banner at all.
 *   - Muted-grey "N queued" when there is pending work but the
 *     browser reports online (runner is about to drain it).
 *   - Amber "N queued offline" when the browser reports offline
 *     AND there is pending work — the one genuinely bad state.
 *   - Destructive "N failed to sync" with a small prompt if any
 *     rows are in `failed` status. Sprint 26+ will wire this to a
 *     review UI; for now the count alone communicates enough.
 *
 * The banner refreshes on a short interval (3s) because there's
 * no native event fired when a Dexie row changes status, and the
 * runner would otherwise race with the banner. A Dexie hook-based
 * live-query subscription is on the PWA Sprint 5+ shopping list.
 */

import { CloudOff, CloudUpload, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { type PendingOpScope, countOps } from "@/lib/offline/queue";

export interface OfflineQueueBannerLabels {
  pendingOnline: string; // "{count} waiting to sync"
  pendingOffline: string; // "{count} queued offline"
  failed: string; // "{count} failed to sync"
  /**
   * Sprint 30 — label on the "Review" link rendered next to the
   * failed count. The link routes to `/offline/queue`, the
   * force-static review page for pending / in-flight / failed
   * ops. Optional because the banner ships before the failed
   * review screen existed; a layout mounting an older label set
   * simply won't render the link and the banner still works.
   */
  reviewCta?: string;
}

export interface OfflineQueueBannerProps {
  scope: PendingOpScope;
  labels: OfflineQueueBannerLabels;
  /**
   * Poll interval in milliseconds. Defaults to 3 seconds. Kept as
   * a prop so storybook / tests can set it to a low value.
   */
  pollIntervalMs?: number;
}

interface QueueCounts {
  pending: number;
  failed: number;
}

export function OfflineQueueBanner({
  scope,
  labels,
  pollIntervalMs = 3000,
}: OfflineQueueBannerProps) {
  const [counts, setCounts] = useState<QueueCounts>({ pending: 0, failed: 0 });
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const [pending, failed] = await Promise.all([
        countOps(scope, ["pending", "in_flight"]),
        countOps(scope, ["failed"]),
      ]);
      if (cancelled) return;
      setCounts({ pending, failed });
    };

    // Kick off an immediate read so the banner doesn't show a
    // stale zero during the first poll interval.
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [scope, pollIntervalMs]);

  const hasPending = counts.pending > 0;
  const hasFailed = counts.failed > 0;

  // Nothing to say.
  if (!hasPending && !hasFailed) return null;

  const renderCount = (template: string, count: number) =>
    template.replace("{count}", String(count));

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs">
      {hasPending ? (
        isOnline ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CloudUpload className="h-3.5 w-3.5" aria-hidden />
            {renderCount(labels.pendingOnline, counts.pending)}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <CloudOff className="h-3.5 w-3.5" aria-hidden />
            {renderCount(labels.pendingOffline, counts.pending)}
          </span>
        )
      ) : null}
      {hasFailed ? (
        <span className="flex items-center gap-1.5 text-destructive">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
          {renderCount(labels.failed, counts.failed)}
          {labels.reviewCta ? (
            <a
              href="/offline/queue"
              className="ml-1 underline decoration-destructive/50 underline-offset-2 hover:decoration-destructive"
            >
              {labels.reviewCta}
            </a>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
