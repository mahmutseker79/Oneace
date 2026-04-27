import { type Page, test as base } from "@playwright/test";

import { test as authTest } from "./auth";

// ── Sprint 33 — TR coverage segment kickoff ──────────────────────────
//
// `trAuthedPage` extends the shared `authedPage` fixture by setting
// the `oneace-locale=tr` cookie on the browser context BEFORE the
// next navigation, then re-navigating to /dashboard so server-side
// `getLocale()` picks up the cookie on the next render.
//
// Why a separate fixture
// ----------------------
// The default `authedPage` fixture relies on EN copy via
// `getByRole({ name: /sign in|log in/i })`. We don't want to fork
// the auth flow — instead we let the user log in with the default
// (EN) locale, then switch the cookie afterwards. The locale cookie
// is the highest-priority resolver layer in `getLocale()` (cookie >
// org-default > Accept-Language > DEFAULT_LOCALE), so a single cookie
// set is sufficient to flip the entire UI.
//
// Lock-step with `src/lib/i18n/index.ts`
// --------------------------------------
// Cookie name MUST stay in sync with `LOCALE_COOKIE` constant
// (`oneace-locale`). The `tr-smoke-fixture.static.test.ts` pin
// catches drift if either side renames.

const LOCALE_COOKIE = "oneace-locale";

type TrAuthFixtures = {
  trAuthedPage: Page;
};

export const test = authTest.extend<TrAuthFixtures>({
  trAuthedPage: async ({ authedPage, baseURL }, use) => {
    const url = new URL(baseURL ?? "http://localhost:3000");
    await authedPage.context().addCookies([
      {
        name: LOCALE_COOKIE,
        value: "tr",
        domain: url.hostname,
        path: "/",
        httpOnly: false,
        secure: url.protocol === "https:",
        sameSite: "Lax",
      },
    ]);
    // Re-navigate so the new locale takes effect on the next SSR.
    await authedPage.goto("/dashboard");
    await use(authedPage);
  },
});

export { expect } from "@playwright/test";
export { LOCALE_COOKIE };
