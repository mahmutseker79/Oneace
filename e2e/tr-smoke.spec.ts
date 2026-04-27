// Sprint 33 — TR coverage segment kickoff (foundation).
//
// TR locale smoke spec.
//
// Goal: prove end-to-end that setting `oneace-locale=tr` flips the
// entire UI shell to Turkish copy. Sprint 33 covers two surfaces
// (login + dashboard nav) — Sprint 37 closure expands this to 5
// core flows per the kickoff brief §4.
//
// Surface coverage today:
//   1. Login page — auth.login.email/password/submit (TR labels)
//   2. Dashboard nav — nav.dashboard = "Pano" (Sprint 7 closure)
//
// What this spec does NOT do:
//   - Per-key parity (that's `tr-key-parity.test.ts` in lib/i18n)
//   - Native review of translation quality
//   - Visual regression (Sprint 37 candidate, not foundation work)

import { expect, test } from "./fixtures/tr-auth";

const LOCALE_COOKIE = "oneace-locale";

test.describe("TR locale smoke (Sprint 33 foundation)", () => {
  test("login page renders TR copy when oneace-locale=tr cookie is set", async ({
    page,
    baseURL,
  }) => {
    // Anonymous flow — set the cookie pre-nav so the very first SSR
    // resolves to TR.
    const url = new URL(baseURL ?? "http://localhost:3000");
    await page.context().addCookies([
      {
        name: LOCALE_COOKIE,
        value: "tr",
        domain: url.hostname,
        path: "/",
        sameSite: "Lax",
      },
    ]);
    await page.goto("/login");

    // auth.login.email = "E-posta"
    await expect(page.getByLabel(/e-posta/i).first()).toBeVisible({
      timeout: 10_000,
    });
    // auth.login.password = "Şifre"
    await expect(page.getByLabel(/şifre/i).first()).toBeVisible();
    // auth.login.submit = "Giriş yap"
    await expect(
      page.getByRole("button", { name: /giriş yap/i }),
    ).toBeVisible();
  });

  test("dashboard nav uses 'Pano' label (nav.dashboard) under TR locale", async ({
    trAuthedPage,
  }) => {
    await trAuthedPage.goto("/dashboard");
    // Sprint 7 closure: tr.nav.dashboard = "Pano". The sidebar nav
    // link MUST surface that label, not "Dashboard".
    await expect(
      trAuthedPage.getByRole("link", { name: /^pano$/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Negative guard — no English "Dashboard" link should be visible
    // anywhere in the chrome under TR locale. (If it shows, either
    // the cookie didn't stick or a hardcoded string slipped in.)
    const enDashboardLinks = trAuthedPage.getByRole("link", {
      name: /^dashboard$/i,
    });
    await expect(enDashboardLinks).toHaveCount(0);
  });
});
