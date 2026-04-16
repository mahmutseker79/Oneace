"use client";

import { useEffect } from "react";
// @ts-expect-error — posthog-js has no bundled types
import posthog from "posthog-js";
// @ts-expect-error — posthog-js has no bundled types
import { PostHogProvider } from "posthog-js/react";
import { env } from "@/lib/env";

/**
 * PostHog Provider Component
 *
 * Initializes PostHog analytics with optional graceful degradation.
 * When NEXT_PUBLIC_POSTHOG_KEY is not set, PostHog remains inert.
 */

function PostHogPageview(): null {
  // PageView tracking is handled separately in posthog-pageview.tsx
  return null;
}

export function PostHogProviderWrapper({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    // Only initialize if key is set
    if (!env.NEXT_PUBLIC_POSTHOG_KEY) {
      return;
    }

    // Initialize PostHog
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false, // We handle pageviews manually in posthog-pageview.tsx
      capture_pageleave: true,
    });
  }, []);

  // If no key is set, skip the provider and return children as-is
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider client={posthog}>
      <PostHogPageview />
      {children}
    </PostHogProvider>
  );
}
