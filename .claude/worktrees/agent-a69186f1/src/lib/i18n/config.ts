/**
 * i18n + regional configuration.
 *
 * OneAce ships as an international SaaS. All end-user strings must flow through
 * the dictionary system below — never hardcode copy in a component.
 *
 * Adding a locale:
 *   1. Add the code to `SUPPORTED_LOCALES`.
 *   2. Create `src/lib/i18n/messages/<code>.ts` exporting the same shape as `en`.
 *   3. Register it in `src/lib/i18n/index.ts`'s `messages` map.
 *
 * Adding a region:
 *   1. Add an entry to `SUPPORTED_REGIONS` with the correct ISO 3166-1 alpha-2
 *      code, ISO 4217 currency, and preferred BCP-47 number locale.
 */

export const SUPPORTED_LOCALES = [
  "en", // English (default)
  "es", // Spanish
  "de", // German
  "fr", // French
  "pt", // Portuguese
  "it", // Italian
  "nl", // Dutch
  "ar", // Arabic (RTL)
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const RTL_LOCALES: readonly Locale[] = ["ar"];

export type RegionConfig = {
  code: string; // ISO 3166-1 alpha-2
  label: string;
  currency: string; // ISO 4217
  numberLocale: string; // BCP-47, used by Intl.NumberFormat
  defaultTimeZone: string;
};

export const SUPPORTED_REGIONS: readonly RegionConfig[] = [
  {
    code: "US",
    label: "United States",
    currency: "USD",
    numberLocale: "en-US",
    defaultTimeZone: "America/New_York",
  },
  {
    code: "GB",
    label: "United Kingdom",
    currency: "GBP",
    numberLocale: "en-GB",
    defaultTimeZone: "Europe/London",
  },
  {
    code: "EU",
    label: "Eurozone",
    currency: "EUR",
    numberLocale: "en-IE",
    defaultTimeZone: "Europe/Brussels",
  },
  {
    code: "CA",
    label: "Canada",
    currency: "CAD",
    numberLocale: "en-CA",
    defaultTimeZone: "America/Toronto",
  },
  {
    code: "AU",
    label: "Australia",
    currency: "AUD",
    numberLocale: "en-AU",
    defaultTimeZone: "Australia/Sydney",
  },
  {
    code: "AE",
    label: "United Arab Emirates",
    currency: "AED",
    numberLocale: "ar-AE",
    defaultTimeZone: "Asia/Dubai",
  },
  {
    code: "SG",
    label: "Singapore",
    currency: "SGD",
    numberLocale: "en-SG",
    defaultTimeZone: "Asia/Singapore",
  },
];

export const DEFAULT_REGION_CODE = "US";

export function getRegionConfig(code: string): RegionConfig {
  const match = SUPPORTED_REGIONS.find((r) => r.code === code);
  if (match) return match;
  const fallback = SUPPORTED_REGIONS.find((r) => r.code === DEFAULT_REGION_CODE);
  if (!fallback) {
    // SUPPORTED_REGIONS must always contain the DEFAULT_REGION_CODE. If this
    // ever throws, the i18n config is misconfigured and we want to crash loud.
    throw new Error(
      `i18n misconfiguration: DEFAULT_REGION_CODE "${DEFAULT_REGION_CODE}" not found in SUPPORTED_REGIONS`,
    );
  }
  return fallback;
}

export const LOCALE_COOKIE = "oneace-locale";
export const REGION_COOKIE = "oneace-region";
