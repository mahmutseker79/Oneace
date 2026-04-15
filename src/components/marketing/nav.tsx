import Link from "next/link";

import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground shadow-md">
            O
          </div>
          <span className="font-semibold tracking-tight text-foreground">OneAce</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link
            href="/pricing"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/docs"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </Link>
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="font-medium" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" className="font-medium shadow-sm" asChild>
            <Link href="/register">Get started free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
