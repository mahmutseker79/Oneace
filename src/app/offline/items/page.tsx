import type { Metadata } from "next";

import {
  OfflineItemsView,
  type OfflineItemsViewLabels,
} from "@/components/offline/offline-items-view";
import { getMessages } from "@/lib/i18n";

/*
 * Static offline catalog viewer — PWA Sprint 3.
 *
 * The service worker precaches the HTML produced by this route at
 * install time so that a cold-start navigation while offline can
 * land somewhere useful. The route is intentionally:
 *
 *   - `force-static`: no request context, no cookies, no DB calls.
 *     Prerendered at build time and cacheable indefinitely by the
 *     SW precache.
 *   - Auth-free: never calls `requireActiveMembership` or any helper
 *     that would explode without a live session.
 *   - Zero data-fetching on the server: the only thing this file
 *     does is assemble a localized labels bundle and hand it to a
 *     client component that reads from Dexie.
 *
 * Why the labels are assembled here rather than inside the client
 * component: `getMessages` is an async server helper that pulls the
 * platform default locale. Resolving it once on the server and
 * passing a plain object across the boundary keeps the client
 * bundle tiny and avoids shipping any i18n machinery to IndexedDB
 * consumers.
 */

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: t.offline.items.metaTitle,
    robots: { index: false, follow: false },
  };
}

export default async function OfflineItemsPage() {
  const t = await getMessages();

  // The locale used by `formatSyncedAgo` and `localeCompare` inside
  // the client component. This page is part of the precachable
  // shell so we don't have access to a request-scoped locale — fall
  // back to the English default that matches `getMessages()`.
  const labels: OfflineItemsViewLabels = {
    title: t.offline.items.title,
    subtitle: t.offline.items.subtitle,
    loading: t.offline.items.loading,
    emptyTitle: t.offline.items.emptyTitle,
    emptyBody: t.offline.items.emptyBody,
    errorTitle: t.offline.items.errorTitle,
    errorBody: t.offline.items.errorBody,
    syncedLabel: t.offline.items.syncedLabel,
    columnSku: t.offline.items.columnSku,
    columnName: t.offline.items.columnName,
    columnCategory: t.offline.items.columnCategory,
    columnStock: t.offline.items.columnStock,
    columnStatus: t.offline.items.columnStatus,
    statusActive: t.offline.items.statusActive,
    statusArchived: t.offline.items.statusArchived,
    statusDraft: t.offline.items.statusDraft,
    noneCategory: t.offline.items.noneCategory,
    cachedCount: t.offline.items.cachedCount,
    backHome: t.offline.items.backHome,
    locale: "en",
  };

  return <OfflineItemsView labels={labels} />;
}
