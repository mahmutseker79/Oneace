import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui standard class merger.
 * Combines Tailwind + conditional classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * URL-safe slug generator with extended Latin / diacritic folding.
 * Uses Unicode normalization so locales like German, French, Spanish, Turkish,
 * Vietnamese, etc. all collapse to ASCII without per-language regex blocks.
 */
export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      // Strip Unicode combining marks (diacritics). \p{Mn} is the canonical way
      // and avoids biome's noMisleadingCharacterClass warning for raw ranges.
      .replace(/\p{Mn}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export type FormatCurrencyOptions = {
  currency?: string;
  locale?: string;
};

export function formatCurrency(
  value: number,
  { currency = "USD", locale = "en-US" }: FormatCurrencyOptions = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(value);
}

export function formatNumber(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale).format(value);
}
