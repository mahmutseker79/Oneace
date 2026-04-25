import type * as React from "react";

import { cn } from "@/lib/utils";

// Sprint 10 PR #3 — Card variant normalize 7→3
// (UX/UI audit Apr-25 §C-3 follow-up).
//
// Önceki: ad-hoc className kombinasyonları 7+ farklı stilde:
//   `border-destructive` / `border-destructive/50` / `border-destructive/20 bg-destructive/5`
//   `border-warning bg-warning-light` / `border-warning/50` / `border-warning/20 bg-warning-light`
//   `hover:bg-muted/50 cursor-pointer transition-colors`
// Yeni: 3 named variant + default. ad-hoc'lardan kademeli migration.
//
// Hard-fail guard Sprint 11+ hedefi (`border-destructive` raw className yasak).

const CARD_VARIANTS = {
  default: "",
  interactive: "hover:bg-muted/50 cursor-pointer transition-colors",
  warning: "border-warning/50 bg-warning-light",
  destructive: "border-destructive/50 bg-destructive/5",
} as const;

export type CardVariant = keyof typeof CARD_VARIANTS;

interface CardProps extends React.ComponentProps<"div"> {
  variant?: CardVariant;
}

function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-[var(--shadow-card)]",
        CARD_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-base font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-5 pt-0 sm:p-6 sm:pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
