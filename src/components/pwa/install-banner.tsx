"use client";

/**
 * PWA Install Banner (P9.4a)
 *
 * Shows a dismissible banner suggesting PWA installation, visible only
 * on the first 3 visits. Uses beforeinstallprompt event and localStorage
 * tracking (oneace-visit-count, oneace-install-banner-dismissed).
 *
 * On iOS: displays manual instructions (Share → Add to Home Screen).
 */

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function InstallBanner() {
  const [shown, setShown] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem("oneace-install-banner-dismissed");
    if (dismissed === "true") return;

    // Increment visit count
    const visitCountStr = localStorage.getItem("oneace-visit-count") || "0";
    const visitCount = Math.min(Number.parseInt(visitCountStr, 10) + 1, 3);
    localStorage.setItem("oneace-visit-count", visitCount.toString());

    // Show banner only on first 3 visits
    if (visitCount <= 3) {
      // Detect iOS
      const ua = navigator.userAgent.toLowerCase();
      const iosMatch = /iphone|ipad|ipod/.test(ua);
      setIsIos(iosMatch);
      setShown(true);
    }

    // Capture beforeinstallprompt event (Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    const prompt = deferredPrompt as any;
    prompt.prompt?.();
    const choice = await prompt.userChoice;

    if (choice.outcome === "accepted") {
      localStorage.setItem("oneace-install-banner-dismissed", "true");
      setShown(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("oneace-install-banner-dismissed", "true");
    setShown(false);
  };

  if (!shown) return null;

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Download className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm">
            {isIos ? (
              <>
                <p className="font-medium">Install OneAce on your iPhone</p>
                <p className="text-xs text-muted-foreground">
                  Tap Share and select "Add to Home Screen"
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Install OneAce as an app</p>
                <p className="text-xs text-muted-foreground">
                  Fast offline access to your inventory
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isIos && deferredPrompt ? (
            <Button size="sm" variant="default" onClick={handleInstall}>
              Install
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
