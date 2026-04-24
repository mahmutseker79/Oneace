import { getActiveOrgPreferences } from "@/lib/session";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  DEFAULT_LOCALE,
  DEFAULT_REGION_CODE,
  LOCALE_COOKIE,
  type Locale,
  REGION_COOKIE,
  RTL_LOCALES,
  type RegionConfig,
  SUPPORTED_LOCALES,
  SUPPORTED_REGIONS,
  getRegionConfig,
} from "./config";
import { type Messages, en } from "./messages/en";
import { tr } from "./messages/tr";

/**
 * Locale → messages map. Add new imports here when you add a new language file.
 *
 * Audit v1.1 §5.23 — the old catalog silently aliased 7 "scaffolded" locales
 * back to `en`, which let the README claim multilingual support while the
 * product shipped English to everyone. The honest scaffold is: one entry, one
 * dictionary. A new locale must land a real messages file *and* a new
 * `SUPPORTED_LOCALES` entry in the same change — the `locale-parity` test
 * will fail loudly otherwise.
 */
// P1-07 — Turkish dictionary. See src/lib/i18n/messages/tr.ts for the
// coverage scope (app + common + permissions + notifications today; other
// surfaces inherit from en). Comment lives OUTSIDE the catalog literal so
// the locale-parity regex scanner doesn't pick up the word "for" as a
// locale key.
const catalog: Record<Locale, Messages> = {
  en,
  tr,
};

function isSupportedLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the active locale for the current request.
 *
 * Priority (Sprint 19: org-defaults layer inserted between user cookie
 * and Accept-Language so a teammate joining an org inherits the org's
 * preferred language without anyone having to touch cookies, while
 * still respecting an explicit personal override):
 *   1. `oneace-locale` cookie (user's explicit choice — always wins)
 *   2. Active organization's `defaultLocale` (set by an OWNER/ADMIN
 *      in Settings → Organization defaults)
 *   3. `Accept-Language` header (browser preference)
 *   4. DEFAULT_LOCALE
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(fromCookie)) return fromCookie;

  // Sprint 19: org-level fallback. `getActiveOrgPreferences` fails
  // silently on unauthenticated routes so this is safe to call from
  // the marketing shell / login pages too.
  const orgPrefs = await getActiveOrgPreferences();
  if (isSupportedLocale(orgPrefs?.defaultLocale)) return orgPrefs.defaultLocale;

  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(",")
      .map((part) => part.split(";")[0]?.trim().toLowerCase().split("-")[0])
      .find((code): code is string => !!code && isSupportedLocale(code));
    if (preferred && isSupportedLocale(preferred)) return preferred;
  }

  return DEFAULT_LOCALE;
});

/**
 * Resolve the active region for the current request.
 *
 * Priority (matches `getLocale` layering):
 *   1. `oneace-region` cookie (user's explicit choice)
 *   2. Active organization's `defaultRegion`
 *   3. DEFAULT_REGION_CODE
 *
 * Note: unlike locale there's no Accept-Region header, so the org
 * default is the only automatic layer beneath the user cookie.
 */
function isSupportedRegion(code: string | null | undefined): code is string {
  return !!code && SUPPORTED_REGIONS.some((r) => r.code === code);
}

export const getRegion = cache(async (): Promise<RegionConfig> => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(REGION_COOKIE)?.value;
  if (isSupportedRegion(fromCookie)) return getRegionConfig(fromCookie);

  const orgPrefs = await getActiveOrgPreferences();
  if (isSupportedRegion(orgPrefs?.defaultRegion)) {
    return getRegionConfig(orgPrefs.defaultRegion);
  }

  return getRegionConfig(DEFAULT_REGION_CODE);
});

export const getMessages = cache(async (): Promise<Messages> => {
  const locale = await getLocale();
  return catalog[locale];
});

export async function getDirection(): Promise<"ltr" | "rtl"> {
  const locale = await getLocale();
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

/**
 * Lightweight placeholder interpolation: replaces `{key}` tokens.
 * Keeps us free of a full ICU runtime for now — swap in FormatJS if plurals/genders appear.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}

export { en } from "./messages/en";
export type { Messages } from "./messages/en";
