"use client";

/**
 * Phase 16.2 — Small icon button that copies text to the clipboard.
 * Shows a brief "Copied!" checkmark for 2 s after success.
 */

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  text: string;
  /** Accessible label for the button. Defaults to "Copy". */
  label?: string;
};

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
      onClick={handleClick}
      aria-label={copied ? "Copied!" : label}
      title={copied ? "Copied!" : label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
