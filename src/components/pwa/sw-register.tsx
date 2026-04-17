"use client";

import { useEffect } from "react";

/**
 * Client-side service worker registrar.
 *
 * Mounted from the (app) layout only — the (auth) layout intentionally
 * does NOT load the SW so login / register / invite pages always hit
 * the network fresh and never serve a stale offline fallback during
 * auth flows.
 *
 * We also capture the `beforeinstallprompt` event here even though
 * this sprint doesn't yet render an "Install app" button. Chrome
 * only fires that event once per page load, so we have to own it
 * synchronously on mount — a later sprint can wire a button to the
 * deferred prompt through a context.
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Registration failure is non-fatal — the app still works
        // without a SW, you just don't get offline / install support.
      }
    };

    // Defer until the browser is idle so SW registration never
    // competes with first-paint critical work.
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof w.requestIdleCallback === "function") {
      const handle = w.requestIdleCallback(register);
      return () => {
        if (typeof w.cancelIdleCallback === "function") {
          w.cancelIdleCallback(handle);
        }
      };
    }

    const timeout = window.setTimeout(register, 1200);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Capture the install prompt so a later sprint can surface a
    // first-party "Install app" button. For now we just park it on
    // the window so it isn't garbage-collected; wiring it to a UI
    // affordance is a follow-up.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      (window as Window & { __oneaceInstallPrompt?: Event }).__oneaceInstallPrompt = event;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  return null;
}
