"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/*
 * UpdatePrompt — Sprint 28.
 *
 * Surfaces a small "new version available" banner when a new
 * service worker has finished installing and is waiting to take
 * control. Clicking the Reload button posts
 * `{ type: "SKIP_WAITING" }` to the waiting worker (the handler
 * was added in Sprint 22 but nothing was wired to it until now),
 * then the component listens for `controllerchange` and does a
 * hard reload once the new worker has claimed the page.
 *
 * Why a banner and not a toast:
 *   - Toasts auto-dismiss. Missing this one means the user stays
 *     stuck on an old shell until they manually reload, which
 *     defeats the point of having an update prompt at all.
 *   - A banner sits above the content, can't be missed, and the
 *     user still chooses when to reload — we never force it.
 *
 * Design notes:
 *   - Only mounted from the `(app)` layout, alongside
 *     `SwRegister`. The `(auth)` layout deliberately has no SW
 *     and therefore no update story.
 *   - Feature-detects `navigator.serviceWorker`; SSR and
 *     browsers without SW support render nothing.
 *   - On mount, inspects the current registration for an
 *     already-waiting worker (the user may have reopened a tab
 *     where a new SW has been waiting since the last visit) and
 *     also subscribes to `updatefound` for workers that install
 *     while this tab is open.
 *   - Guards against firing the first-install case: if there is
 *     no `controller` at the moment the new worker becomes
 *     `installed`, the user doesn't have a running SW yet — this
 *     is the initial SW install, not an update, and we silently
 *     skip the banner.
 *   - `controllerchange` is fired once the waiting worker takes
 *     control. We then do `window.location.reload()` to ensure
 *     the page is served by the new SW; skipping the reload
 *     would leave RSC payloads and cached assets inconsistent.
 *
 * The banner itself is a controlled component — `useState` owns
 * the "show me" flag. The `SwRegister` useEffect over in the
 * same folder already handles registration; this component only
 * watches the registration that's already live.
 */

type UpdatePromptLabels = {
  message: string;
  reloadCta: string;
  dismissCta: string;
};

type UpdatePromptProps = {
  labels: UpdatePromptLabels;
};

export function UpdatePrompt({ labels }: UpdatePromptProps) {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const sw = navigator.serviceWorker;
    if (!sw) return;

    let cancelled = false;

    /**
     * If a registration's installing worker transitions to
     * `installed` **and** a controller is already live, that
     * means a new version is ready and waiting — show the
     * prompt. Without the controller check we'd show the banner
     * on the very first SW install, which is not an update.
     */
    function trackInstalling(registration: ServiceWorkerRegistration) {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (cancelled) return;
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setWaiting(installing);
        }
      });
    }

    (async () => {
      try {
        const registration = await sw.getRegistration();
        if (!registration || cancelled) return;

        // Already-waiting case: the new worker finished
        // installing before this component mounted.
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaiting(registration.waiting);
        }

        // `updatefound` fires when a new worker starts
        // installing. We latch on to that worker so we can see
        // when it becomes `installed` (= ready for activation).
        registration.addEventListener("updatefound", () => {
          if (cancelled) return;
          trackInstalling(registration);
        });

        // If an install is already in progress at mount, start
        // tracking it right away.
        if (registration.installing) {
          trackInstalling(registration);
        }
      } catch {
        // getRegistration() failing is never fatal — just means
        // no update UX for this session.
      }
    })();

    /**
     * Once the new worker has taken control, we hard-reload so
     * the page is served by it instead of the outgoing one. The
     * listener is one-shot — repeated firings would cause a
     * reload loop on browsers that re-emit on back/forward.
     */
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      sw.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting || dismissed) return null;

  const handleReload = () => {
    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // Posting to a dead worker is recoverable — the user can
      // reload the tab manually. Nothing to surface.
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <output
      aria-live="polite"
      className="flex flex-wrap items-center gap-3 border-b bg-primary/5 px-4 py-2 text-sm text-primary lg:px-6"
    >
      <RefreshCw className="h-4 w-4" aria-hidden />
      <span className="flex-1">{labels.message}</span>
      <Button type="button" size="sm" onClick={handleReload}>
        {labels.reloadCta}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={handleDismiss}>
        {labels.dismissCta}
      </Button>
    </output>
  );
}
