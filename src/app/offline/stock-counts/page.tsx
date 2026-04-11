import type { Metadata } from "next";

import {
  OfflineStockCountsShell,
  type OfflineStockCountsViewLabels,
} from "@/components/offline/offline-stockcounts-view";
import { getMessages } from "@/lib/i18n";

/*
 * Static offline stock-counts viewer — Sprint 29 (PWA Sprint 6).
 *
 * Mirrors `src/app/offline/items/page.tsx`. The service worker
 * precaches the HTML produced by this route so a cold-start
 * navigation while offline lands on a working page:
 *
 *   - `force-static`: no cookies, no request context, no DB calls.
 *     Prerendered at build time and cacheable indefinitely.
 *   - Auth-free: never calls `requireActiveMembership`.
 *   - Zero server-side data fetching: the labels bundle is assembled
 *     once and handed to a client component that reads from Dexie.
 *
 * Why the ?id= parameter is resolved inside the client component
 * rather than here: `force-static` disables `searchParams` on the
 * page (Next would have to regenerate HTML per query, defeating
 * the precache). The shell reads `window.location.search` on mount
 * and flips between list and detail views client-side.
 */

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: t.offline.stockCounts.metaTitle,
    robots: { index: false, follow: false },
  };
}

export default async function OfflineStockCountsPage() {
  const t = await getMessages();

  // English default — matches `offline/items/page.tsx`. This page
  // ships before the user has a request-scoped locale, so the
  // platform default is the honest answer.
  const labels: OfflineStockCountsViewLabels = {
    title: t.offline.stockCounts.title,
    subtitle: t.offline.stockCounts.subtitle,
    loading: t.offline.stockCounts.loading,
    errorTitle: t.offline.stockCounts.errorTitle,
    errorBody: t.offline.stockCounts.errorBody,
    backHome: t.offline.stockCounts.backHome,
    emptyTitle: t.offline.stockCounts.emptyTitle,
    emptyBody: t.offline.stockCounts.emptyBody,
    syncedLabel: t.offline.stockCounts.syncedLabel,
    cachedCount: t.offline.stockCounts.cachedCount,
    listColumnName: t.offline.stockCounts.listColumnName,
    listColumnState: t.offline.stockCounts.listColumnState,
    listColumnRows: t.offline.stockCounts.listColumnRows,
    listColumnEntries: t.offline.stockCounts.listColumnEntries,
    listColumnSynced: t.offline.stockCounts.listColumnSynced,
    stateOpen: t.offline.stockCounts.stateOpen,
    stateInProgress: t.offline.stockCounts.stateInProgress,
    stateCompleted: t.offline.stockCounts.stateCompleted,
    stateCancelled: t.offline.stockCounts.stateCancelled,
    methodologyCycle: t.offline.stockCounts.methodologyCycle,
    methodologyFull: t.offline.stockCounts.methodologyFull,
    methodologySpot: t.offline.stockCounts.methodologySpot,
    methodologyBlind: t.offline.stockCounts.methodologyBlind,
    methodologyDoubleBlind: t.offline.stockCounts.methodologyDoubleBlind,
    methodologyDirected: t.offline.stockCounts.methodologyDirected,
    detailBackToList: t.offline.stockCounts.detailBackToList,
    detailBlindBanner: t.offline.stockCounts.detailBlindBanner,
    detailEmpty: t.offline.stockCounts.detailEmpty,
    detailNotFound: t.offline.stockCounts.detailNotFound,
    detailProgress: t.offline.stockCounts.detailProgress,
    detailColumnSku: t.offline.stockCounts.detailColumnSku,
    detailColumnItem: t.offline.stockCounts.detailColumnItem,
    detailColumnWarehouse: t.offline.stockCounts.detailColumnWarehouse,
    detailColumnExpected: t.offline.stockCounts.detailColumnExpected,
    detailColumnCounted: t.offline.stockCounts.detailColumnCounted,
    detailColumnVariance: t.offline.stockCounts.detailColumnVariance,
    locale: "en",
  };

  return <OfflineStockCountsShell labels={labels} />;
}
