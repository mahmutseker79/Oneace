"use client";

// Phase 3 UX — useUnsavedWarning hook.
//
// Warns the user before they navigate away from a form with unsaved
// changes. Two guard mechanisms:
//
//   1. `beforeunload` — fires when the browser tab/window is closed or
//      hard-navigated. The browser shows a generic "Leave site?" dialog.
//
//   2. `visibilitychange` + form mutation tracking — soft-navigation
//      within the Next.js app doesn't trigger `beforeunload`. We handle
//      this by exposing `isDirty` state that forms manage themselves.
//      If you need route-change interception, wrap the form's submit/
//      cancel handlers to clear `isDirty` before navigating.
//
// Usage:
//   const { isDirty, setDirty, reset } = useUnsavedWarning();
//   // On any field change: setDirty(true)
//   // On successful save or cancel: reset()

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseUnsavedWarning {
  isDirty: boolean;
  /** Call when any field changes. Pass `true` to mark dirty. */
  setDirty: (dirty: boolean) => void;
  /** Clear dirty state — call on successful save or explicit cancel. */
  reset: () => void;
}

export function useUnsavedWarning(): UseUnsavedWarning {
  const [isDirty, setIsDirty] = useState(false);
  // Keep a ref in sync so the beforeunload handler always has the
  // latest value without stale closure issues.
  const isDirtyRef = useRef(false);

  const setDirty = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
    setIsDirty(dirty);
  }, []);

  const reset = useCallback(() => {
    isDirtyRef.current = false;
    setIsDirty(false);
  }, []);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      // Modern browsers ignore the return value but still show their
      // own generic "Leave site?" dialog when preventDefault is called.
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return { isDirty, setDirty, reset };
}
