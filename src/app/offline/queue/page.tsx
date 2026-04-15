import type { Metadata } from "next";

import {
  OfflineQueueShell,
  type OfflineQueueViewLabels,
} from "@/components/offline/offline-queue-view";
import { getMessages } from "@/lib/i18n";

/*
 * Static offline queue-review page — Sprint 30 (PWA Sprint 7).
 *
 * Mirrors `src/app/offline/items/page.tsx` and
 * `src/app/offline/stock-counts/page.tsx`. The service worker
 * precaches the HTML produced by this route so a cold-start
 * navigation while offline lands on a working page that can
 * still inspect and manage the write queue.
 *
 *   - `force-static`: no cookies, no request context, no DB calls.
 *     Prerendered at build time, cacheable indefinitely.
 *   - Auth-free: never calls `requireActiveMembership`.
 *   - Zero server-side data fetching: labels are resolved once
 *     and handed to a client component that reads from Dexie.
 *
 * Design note: this route does NOT take a `?scope=` parameter,
 * unlike /offline/stock-counts. The queue is implicitly scoped to
 * the most-recently-synced (orgId, userId) in the `meta` table —
 * the same scope the runner itself uses when it drains on
 * connectivity return. Pinning it server-side would defeat the
 * force-static cache.
 */

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: t.offline.queueReview.metaTitle,
    robots: { index: false, follow: false },
  };
}

export default async function OfflineQueuePage() {
  const t = await getMessages();

  const labels: OfflineQueueViewLabels = {
    title: t.offline.queueReview.title,
    subtitle: t.offline.queueReview.subtitle,
    loading: t.offline.queueReview.loading,
    errorTitle: t.offline.queueReview.errorTitle,
    errorBody: t.offline.queueReview.errorBody,
    backHome: t.offline.queueReview.backHome,
    backOnline: t.offline.queueReview.backOnline,
    emptyTitle: t.offline.queueReview.emptyTitle,
    emptyBody: t.offline.queueReview.emptyBody,
    sectionPendingTitle: t.offline.queueReview.sectionPendingTitle,
    sectionPendingEmpty: t.offline.queueReview.sectionPendingEmpty,
    sectionInFlightTitle: t.offline.queueReview.sectionInFlightTitle,
    sectionInFlightEmpty: t.offline.queueReview.sectionInFlightEmpty,
    sectionFailedTitle: t.offline.queueReview.sectionFailedTitle,
    sectionFailedEmpty: t.offline.queueReview.sectionFailedEmpty,
    columnOp: t.offline.queueReview.columnOp,
    columnCreated: t.offline.queueReview.columnCreated,
    columnAttempts: t.offline.queueReview.columnAttempts,
    columnStatus: t.offline.queueReview.columnStatus,
    columnError: t.offline.queueReview.columnError,
    columnActions: t.offline.queueReview.columnActions,
    opMovementCreate: t.offline.queueReview.opMovementCreate,
    opCountEntryAdd: t.offline.queueReview.opCountEntryAdd,
    opUnknown: t.offline.queueReview.opUnknown,
    statusPending: t.offline.queueReview.statusPending,
    statusInFlight: t.offline.queueReview.statusInFlight,
    statusFailed: t.offline.queueReview.statusFailed,
    statusSucceeded: t.offline.queueReview.statusSucceeded,
    retryCta: t.offline.queueReview.retryCta,
    discardCta: t.offline.queueReview.discardCta,
    clearFailedCta: t.offline.queueReview.clearFailedCta,
    clearFailedConfirm: t.offline.queueReview.clearFailedConfirm,
    discardConfirm: t.offline.queueReview.discardConfirm,
    clearedToast: t.offline.queueReview.clearedToast,
    retriedToast: t.offline.queueReview.retriedToast,
    discardedToast: t.offline.queueReview.discardedToast,
    retryDisabledHint: t.offline.queueReview.retryDisabledHint,
    attemptCountTemplate: t.offline.queueReview.attemptCountTemplate,
    payloadFallback: t.offline.queueReview.payloadFallback,
    locale: "en",
  };

  return <OfflineQueueShell labels={labels} />;
}
