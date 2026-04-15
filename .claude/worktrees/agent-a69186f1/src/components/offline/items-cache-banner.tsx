"use client";

/*
 * Items cache banner — a quiet status row shown under the items
 * page heading. It tells the user:
 *
 *   - Whether the browser currently thinks it is online or offline.
 *   - When the offline snapshot was last refreshed (if we have one).
 *
 * Copy for both states lives in the i18n messages under
 * `t.offline.cacheStatus.*` so other offline-capable screens can
 * share it later.
 */

import { CloudOff, DatabaseZap } from "lucide-react";
import { useEffect, useState } from "react";

import {
  type ItemSnapshotScope,
  formatSyncedAgo,
  readItemsSnapshot,
} from "@/lib/offline/items-cache";

export interface ItemsCacheBannerProps {
  scope: ItemSnapshotScope;
  locale: string;
  labels: {
    onlineFresh: string;
    onlineStale: string;
    offlineCached: string;
    offlineEmpty: string;
    neverSynced: string;
  };
}

export function ItemsCacheBanner({ scope, locale, labels }: ItemsCacheBannerProps) {
  // `null` here means "we haven't checked yet" — we render an
  // invisible placeholder during that state so the page does not
  // jump once the IndexedDB read resolves.
  const [syncedAt, setSyncedAt] = useState<string | null | undefined>(undefined);
  const [count, setCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snapshot = await readItemsSnapshot(scope);
      if (cancelled) return;
      setSyncedAt(snapshot.syncedAt);
      setCount(snapshot.count);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

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

  // Haven't read the cache yet — reserve vertical space to prevent
  // layout shift on slow devices.
  if (syncedAt === undefined) {
    return <div className="h-6" aria-hidden />;
  }

  if (!isOnline) {
    // Offline. If we have a snapshot, say so; otherwise warn the
    // user the list they're looking at may be incomplete.
    if (syncedAt && count > 0) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
          <span>
            {labels.offlineCached} · {formatSyncedAgo(syncedAt, locale)} · {count}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        <span>{labels.offlineEmpty}</span>
      </div>
    );
  }

  // Online: show "just synced" / "synced X min ago" for context.
  // A missing syncedAt here means this is the first pageview since
  // the cache was installed — we'll know next navigation.
  if (syncedAt) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <DatabaseZap className="h-3.5 w-3.5" aria-hidden />
        <span>
          {labels.onlineFresh} · {formatSyncedAgo(syncedAt, locale)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <DatabaseZap className="h-3.5 w-3.5" aria-hidden />
      <span>{labels.neverSynced}</span>
    </div>
  );
}
