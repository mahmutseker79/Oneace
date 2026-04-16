import type { MetadataRoute } from "next";

/**
 * Phase 12.5 — Dynamic sitemap covering all public pages.
 * Authenticated app routes are excluded — they require login and
 * are not crawlable by search engines.
 *
 * NOTE: Uses process.env directly instead of the validated `env`
 * module because this metadata route is collected at build time
 * when runtime-only secrets (DATABASE_URL, etc.) are unavailable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oneace.app";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Phase 14.3 — docs sub-pages
    ...(
      [
        "getting-started",
        "scanning",
        "stock-counts",
        "warehouses",
        "purchase-orders",
        "reports",
        "permissions",
      ] as const
    ).map((slug) => ({
      url: `${baseUrl}/docs/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.7,
    },
  ];
}
