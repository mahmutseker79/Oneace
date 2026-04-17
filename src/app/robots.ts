import type { MetadataRoute } from "next";

/**
 * Phase 12.5 — robots.txt.
 * Allow crawling of public marketing pages only.
 * Block all authenticated app routes (/dashboard, /items, etc.).
 *
 * NOTE: We intentionally avoid importing `env` here because this
 * metadata route is evaluated at build time during `next build`.
 * The Zod env schema requires DATABASE_URL / BETTER_AUTH_SECRET
 * which are only available at runtime on Vercel, not during the
 * build step. Using process.env directly for the single public
 * var we need avoids a build-time crash on preview / branch deploys.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";

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
