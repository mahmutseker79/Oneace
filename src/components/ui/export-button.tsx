"use client";

// Phase 5.5 — ExportButton: shows a brief loading state when clicked.
//
// Export routes return file responses (Content-Disposition: attachment).
// The browser navigates to the URL and the download starts — there's no
// fetch-based success/failure signal back to JS. We show a "Preparing..."
// state for 3 seconds to give users feedback, then reset automatically.
//
// Usage:
//   <ExportButton href="/reports/low-stock/export">Export CSV</ExportButton>

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

type ExportButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function ExportButton({
  href,
  children,
  variant = "outline",
  size = "default",
  className,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    // Navigate to the export route. The download will start in the browser.
    window.location.href = href;
    // Reset after 3 seconds — enough time for the browser to start the download.
    window.setTimeout(() => setLoading(false), 3000);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {loading ? "Preparing…" : children}
    </Button>
  );
}
