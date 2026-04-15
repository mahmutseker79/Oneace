"use client";

/*
 * useLiveQuery — Sprint 31 (PWA Sprint 8).
 *
 * A tiny React hook wrapping `Dexie.liveQuery()` so components can
 * subscribe to an Observable-like stream of query results and
 * re-render automatically whenever the underlying Dexie tables
 * change. Until this sprint the offline queue view and banner polled
 * Dexie on a 3-second timer — cheap, but laggy, and the action
 * handlers had to force `refresh()` calls in their `finally` blocks
 * to give the UI instant feedback. With live-query that whole dance
 * goes away: a write lands, Dexie's observable fires, every
 * subscribed component re-queries and re-renders in the same tick.
 *
 * Why a custom hook and not `dexie-react-hooks`:
 *
 *   `dexie-react-hooks` ships an exact clone of this hook plus an
 *   `useObservable` helper. We don't need the second helper and
 *   shipping the whole package adds ~4 KB plus a new version to
 *   track. The useful bit is ~20 lines — keeping it inlined means
 *   one fewer runtime dep and a single place to audit subscribe /
 *   unsubscribe behavior.
 *
 * Why `deps` is required (not inferred from querier closure):
 *
 *   A querier captured once at mount would see stale scope / filter
 *   state forever. Callers pass the dep array so the hook can tear
 *   down the old subscription and open a new one on each relevant
 *   prop change. This mirrors the `useEffect` shape every React
 *   developer already understands.
 *
 * Observer error handling:
 *
 *   Dexie's Observable can fire `error` if a schema transaction is
 *   aborted mid-subscription or if the browser blocks IndexedDB.
 *   The hook catches those so a single transient failure doesn't
 *   unmount the whole tree; callers can surface a "live updates
 *   unavailable" message by checking whether `result` is still
 *   `initialValue` after N seconds if they need to.
 *
 * SSR:
 *
 *   `"use client"` at the top of this file is enough — React only
 *   runs effects on the client, so the subscription never attempts
 *   to open on a server render. The initial render returns whatever
 *   `initialValue` the caller passed (typically `undefined` or an
 *   empty array), matching the React 19 "non-blocking initial
 *   render" contract.
 */

import { liveQuery } from "dexie";
import { type DependencyList, useEffect, useState } from "react";

/**
 * Subscribe a component to a Dexie live query.
 *
 * @param querier    Function producing the query result. May
 *                   return a Promise or a plain value. Called once
 *                   per Dexie change notification.
 * @param deps       Standard React dependency array. The live
 *                   subscription is torn down and re-opened on
 *                   every dep change — pass the same values you'd
 *                   pass to a `useEffect` that re-runs the query.
 * @param initialValue Value returned during the first paint, before
 *                     Dexie delivers the first result. Defaults to
 *                     `undefined`.
 *
 * @returns the latest query result, or `initialValue` while the
 *          first tick is in flight.
 */
export function useLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: DependencyList,
  initialValue?: T,
): T | undefined {
  const [result, setResult] = useState<T | undefined>(initialValue);

  // The dep array is the caller's contract; we intentionally do
  // NOT add `querier` here because that would make every render
  // (with a fresh closure) re-subscribe.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are caller-provided
  useEffect(() => {
    // Dexie's `liveQuery` returns a zen-observable-compatible
    // Observable. We subscribe, receive results on `next`, and
    // swallow `error` to keep one bad tick from unmounting the
    // tree. The explicit unsubscribe in the cleanup prevents a
    // memory leak when the caller re-runs with new deps.
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (value) => {
        setResult(value);
      },
      error: (err) => {
        console.error("[useLiveQuery] subscription error:", err);
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  }, deps);

  return result;
}
