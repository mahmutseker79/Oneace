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
 * Sprint 31 — the banner no longer polls. A Dexie `liveQuery`
 * subscription watches the same scoped count queries and re-fires
 * whenever the underlying `pendingOps` table changes (writes from
 * the runner, the queue review screen, or another tab). The
 * `pollIntervalMs` prop is retained for back-compat (older callers
 * still compile) but is now a dead knob.
 */

import { CloudOff, CloudUpload, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { type PendingOpScope, countOps } from "@/lib/offline/queue";
import { useLiveQuery } from "@/lib/offline/use-live-query";

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
   * Sprint 25–30: poll interval in milliseconds (defaulted to
   * 3000). Sprint 31 replaced the poll with a Dexie `liveQuery`
   * subscription, so this prop is now a dead knob — retained only
   * so older callers and storybook fixtures keep compiling
   * unchanged. Removing it is a follow-up cleanup.
   */
  pollIntervalMs?: number;
}

interface QueueCounts {
  pending: number;
  failed: number;
}

const EMPTY_COUNTS: QueueCounts = Object.freeze({ pending: 0, failed: 0 }) as QueueCounts;

export function OfflineQueueBanner({ scope, labels }: OfflineQueueBannerProps) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  // Sprint 31 — live Dexie counts. `liveQuery` fires a fresh
  // tick whenever a write lands in `pendingOps`, so the banner
  // picks up the first queued op and the last cleared failure
  // without any 3-second lag.
  const counts =
    useLiveQuery<QueueCounts>(
      async () => {
        const [pending, failed] = await Promise.all([
          countOps(scope, ["pending", "in_flight"]),
          countOps(scope, ["failed"]),
        ]);
        return { pending, failed };
      },
      [scope.orgId, scope.userId],
      EMPTY_COUNTS,
    ) ?? EMPTY_COUNTS;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
