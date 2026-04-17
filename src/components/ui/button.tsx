import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-card",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-card",
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-card",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Heights bound to --control-h-* tokens so Button / Input / SelectTrigger stay in lock-step.
        default: "h-[var(--control-h-md)] px-4 py-2",
        sm: "h-[var(--control-h-sm)] rounded-md px-3",
        lg: "h-[var(--control-h-lg)] rounded-md px-8",
        icon: "h-[var(--control-h-md)] w-[var(--control-h-md)] min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * When true, replaces any leading icon with a spinner and disables pointer
   * events. The original children render as the label so layout stays stable.
   */
  isLoading?: boolean;
  /**
   * Accessible label announced to screen readers while `isLoading` is true.
   * Defaults to "Loading" — override for localized text.
   */
  loadingLabel?: string;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  loadingLabel = "Loading",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const effectiveDisabled = disabled || isLoading;

  // When asChild is true the caller provides their own element and we must
  // return a single child — emulating the loading state is the caller's job.
  if (asChild) {
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        aria-busy={isLoading || undefined}
        aria-disabled={effectiveDisabled || undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={effectiveDisabled}
      aria-busy={isLoading || undefined}
      data-loading={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : null}
      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
