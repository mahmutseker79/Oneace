import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-md border bg-[var(--input-background)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-[var(--control-h-sm)] px-2.5 py-1.5 text-sm",
        default: "h-[var(--control-h-md)] px-3 py-2 text-sm",
      },
      state: {
        default: "border-input focus-visible:ring-ring",
        error: "border-destructive focus-visible:ring-destructive",
        success: "border-success focus-visible:ring-success",
      },
    },
    defaultVariants: {
      size: "default",
      state: "default",
    },
  },
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {
  /**
   * Convenience alias: when true, sets `state="error"` and `aria-invalid`.
   * Use `state` directly when you need finer control (e.g. `success`).
   */
  invalid?: boolean;
}

function Input({
  className,
  type,
  size,
  state,
  invalid,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const resolvedState = invalid ? "error" : state;
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(inputVariants({ size, state: resolvedState }), className)}
      aria-invalid={ariaInvalid ?? (resolvedState === "error" ? true : undefined)}
      {...props}
    />
  );
}

export { Input, inputVariants };
