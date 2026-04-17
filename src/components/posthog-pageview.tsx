"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * PostHog Pageview Tracker
 *
 * Captures pageview events when routes change.
 * Strips sensitive query parameters before sending.
 */

const SENSITIVE_PARAMS = new Set([
  "token",
  "code",
  "password",
  "secret",
  "key",
  "api_key",
  "auth",
  "session",
  "access_token",
  "refresh_token",
]);

function stripSensitiveParams(url: string): string {
  try {
    const urlObj = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    const params = new URLSearchParams(urlObj.search);

    for (const key of params.keys()) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        params.delete(key);
      }
    }

    urlObj.search = params.toString();
    return urlObj.pathname + (urlObj.search ? `?${urlObj.search}` : "");
  } catch {
    return url;
  }
}

export function PostHogPageview(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined" || !posthog) {
      return;
    }

    const url = `${pathname}${searchParams ? `?${searchParams}` : ""}`;
    const cleanUrl = stripSensitiveParams(url);

    try {
      posthog.capture("$pageview", {
        $current_url: cleanUrl,
      });
    } catch (err) {
      // Silently fail — analytics should never break the app
      console.debug("PostHog pageview capture failed:", err);
    }
  }, [pathname, searchParams]);

  return null;
}
