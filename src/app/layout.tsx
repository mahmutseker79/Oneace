import { getDirection, getLocale, getMessages } from "@/lib/i18n";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { VercelAnalytics } from "@/components/analytics";
import { PostHogProviderWrapper } from "@/components/posthog-provider";
import { PostHogPageview } from "@/components/posthog-pageview";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: {
      default: t.metadata.title,
      template: `%s · ${t.app.name}`,
    },
    description: t.metadata.description,
    applicationName: t.app.name,
    authors: [{ name: t.app.name }],
    keywords: [...t.metadata.keywords],
    formatDetection: {
      telephone: false,
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: t.app.name,
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    },
    // Phase 12.5 — Open Graph / social card defaults.
    // Individual pages override these via their own generateMetadata().
    openGraph: {
      type: "website",
      siteName: t.app.name,
      title: t.metadata.title,
      description: t.metadata.description,
    },
    twitter: {
      card: "summary",
      title: t.metadata.title,
      description: t.metadata.description,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1e293b" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dir = await getDirection();

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <PostHogProviderWrapper>
          <PostHogPageview />
          {children}
          <VercelAnalytics />
        </PostHogProviderWrapper>
      </body>
    </html>
  );
}
