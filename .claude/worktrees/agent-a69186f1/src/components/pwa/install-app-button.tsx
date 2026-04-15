"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/*
 * InstallAppButton — Sprint 28.
 *
 * First-party "Install app" affordance that consumes the
 * `beforeinstallprompt` event parked by `SwRegister` (Sprint 22)
 * or captured fresh on mount. Clicking calls `prompt()`, awaits
 * `userChoice`, and clears the handle regardless of the user's
 * decision. A second click will silently do nothing until Chrome
 * decides to re-offer the event.
 *
 * Background — the three states:
 *
 *   1. Parked handle on `window.__oneaceInstallPrompt` from
 *      Sprint 22's synchronous `beforeinstallprompt` capture.
 *      This is the primary path: Chrome fires the event once
 *      per page load, very early, before this component mounts.
 *
 *   2. Fresh event: if `SwRegister` didn't capture it (e.g.
 *      race, the (auth) layout didn't mount SwRegister), we
 *      also listen here so a user navigating into the app
 *      shell after a fresh bfcache restore still gets the
 *      button.
 *
 *   3. `appinstalled` fires exactly once after a successful
 *      install. We clear state then so the button disappears
 *      even without a reload.
 *
 * Design decisions:
 *
 *   - The component renders nothing until the prompt is
 *     available. No placeholder, no disabled state — a button
 *     that only works sometimes is worse than no button.
 *
 *   - `BeforeInstallPromptEvent` is not in the TypeScript DOM
 *     lib yet because the spec is still a W3C Editor's Draft.
 *     We use a local interface that describes only the surface
 *     we actually call (`prompt` + `userChoice`).
 *
 *   - The parked-handle reference on `window` stays live
 *     indefinitely by design — Chrome allows multiple prompts
 *     from the same event object, but the user's choice only
 *     counts once. Clearing after `prompt()` matches Chrome's
 *     own UX guidance.
 *
 *   - Intentionally does NOT block on `isSecureContext` /
 *     https checks: if the event fired at all, the origin is
 *     already eligible.
 *
 *   - Feature-detected end-to-end: on browsers that never fire
 *     the event (iOS Safari), the button simply never mounts.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type ParkedPromptWindow = Window & {
  __oneaceInstallPrompt?: Event | null;
};

type InstallAppButtonLabels = {
  install: string;
};

type InstallAppButtonProps = {
  labels: InstallAppButtonLabels;
  /**
   * Optional className so the button can be styled by its host
   * container without the component needing to know where it's
   * rendered. Defaults to an empty string.
   */
  className?: string;
};

export function InstallAppButton({ labels, className = "" }: InstallAppButtonProps) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const parked = (window as ParkedPromptWindow).__oneaceInstallPrompt;
    if (parked) {
      setPrompt(parked as BeforeInstallPromptEvent);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setPrompt(null);
      (window as ParkedPromptWindow).__oneaceInstallPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!prompt) return null;

  const handleClick = async () => {
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // `prompt()` is single-use per event instance. If it
      // throws, the event is already spent — clear it and move
      // on so the UI doesn't leave a dead button on screen.
    } finally {
      setPrompt(null);
      if (typeof window !== "undefined") {
        (window as ParkedPromptWindow).__oneaceInstallPrompt = null;
      }
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" className={className} onClick={handleClick}>
      <Download className="h-4 w-4" aria-hidden />
      <span>{labels.install}</span>
    </Button>
  );
}
