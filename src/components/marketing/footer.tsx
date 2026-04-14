import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                O
              </div>
              <span className="font-semibold">OneAce</span>
            </div>
            <p className="max-w-xs text-xs text-muted-foreground">
              Inventory management built for growing businesses. Offline-first, barcode-ready,
              multi-warehouse.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12 text-sm">
            <div className="space-y-3">
              <p className="font-medium">Product</p>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/pricing" className="hover:text-foreground">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="hover:text-foreground">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-foreground">
                    Get started
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="font-medium">Account</p>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/login" className="hover:text-foreground">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-foreground">
                    Sign up
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} OneAce. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
