/**
 * i18n + regional configuration.
 *
 * OneAce ships as an international SaaS. All end-user strings must flow through
 * the dictionary system below — never hardcode copy in a component.
 *
 * Honest-scaffold note (audit v1.1 §5.23):
 * We used to declare 8 "scaffolded" locales here (en/es/de/fr/pt/it/nl/ar) but
 * only `messages/en.ts` actually existed — the other 7 were silently aliased
 * to `en`, which meant `oneace-locale=de` cookies silently served English
 * while the README claimed German support. Rather than fake it, we now only
 * declare the locale we truly ship. The architecture (Record<Locale, Messages>
 * catalog, cookie + Accept-Language detection, RTL switch) stays ready — a
 * future locale is one file + one `SUPPORTED_LOCALES` entry away.
 *
 * To add a locale:
 *   1. Create `src/lib/i18n/messages/<code>.ts` exporting the same shape as `en`.
 *   2. Add the code to `SUPPORTED_LOCALES` below.
 *   3. Register it in the `catalog` map in `src/lib/i18n/index.ts`.
 *   4. If it's an RTL script, add the code to `RTL_LOCALES`.
 *   5. The `locale-parity.test.ts` guard will now pass for the new code.
 *
 * Adding a region:
 *   1. Add an entry to `SUPPORTED_REGIONS` with the correct ISO 3166-1 alpha-2
 *      code, ISO 4217 currency, and preferred BCP-47 number locale. Regions
 *      stay decoupled from message catalogs because currency/timezone do not
 *      imply translated copy (e.g., UAE region + English locale is valid).
 */

export const SUPPORTED_LOCALES = [
  "en", // English (default) — the only locale with a real messages file.
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

// Typed as `readonly string[]` rather than `readonly Locale[]` on purpose —
// we want to keep `"ar"` (and any other RTL code) listed as a known future
// RTL locale even while it is not yet in SUPPORTED_LOCALES. `getDirection`
// narrows by runtime string match, not by the Locale union.
export const RTL_LOCALES: readonly string[] = ["ar", "he", "fa", "ur"];

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
