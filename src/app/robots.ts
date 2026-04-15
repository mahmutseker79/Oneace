import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/**
 * Phase 12.5 — robots.txt.
 * Allow crawling of public marketing pages only.
 * Block all authenticated app routes (/dashboard, /items, etc.).
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/docs", "/login", "/register"],
        disallow: [
          "/dashboard",
          "/items",
          "/movements",
          "/stock-counts",
          "/warehouses",
          "/suppliers",
          "/purchase-orders",
          "/reports",
          "/scan",
          "/settings",
          "/users",
          "/audit",
          "/search",
          "/onboarding",
          "/api/",
          "/offline/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
