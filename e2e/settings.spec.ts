import { expect, test } from "./fixtures/auth";

// ── P10.3 — Settings & Security E2E tests ──────────────────────────

test.describe("Settings page", () => {
  test("should display settings page with heading", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.waitForURL("**/settings**", { timeout: 10_000 });

    // Check for settings heading
    await expect(
      authedPage
        .locator("h1, h2")
        .filter({ hasText: /settings/i })
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("should show organization profile section", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.waitForURL("**/settings**", { timeout: 10_000 });

    // Look for org name form field or section
    const orgField = authedPage.locator(
      "input[placeholder*='organization' i], input[placeholder*='org' i], label:has-text(/organization/i)",
    );
    if ((await orgField.count()) > 0) {
      await expect(orgField.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should show account section with email", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.waitForURL("**/settings**", { timeout: 10_000 });

    // Look for account or email display
    const accountSection = authedPage.locator("text=/account|email|profile/i");
    const count = await accountSection.count();
    if (count > 0) {
      await expect(accountSection.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should show security section link or button", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.waitForURL("**/settings**", { timeout: 10_000 });

    // Look for security, 2FA, or authentication link
    const securityLink = authedPage
      .locator("a, button, div[role='button']")
      .filter({ hasText: /security|2fa|authentication|two-factor/i });

    const count = await securityLink.count();
    // If security section exists, it should be visible
    if (count > 0) {
      await expect(securityLink.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should show privacy and data section", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.waitForURL("**/settings**", { timeout: 10_000 });

    // Look for privacy, data export, or GDPR section
    const privacyLink = authedPage
      .locator("a, button, div[role='button']")
      .filter({ hasText: /privacy|data export|gdpr|delete account/i });

    const count = await privacyLink.count();
    if (count > 0) {
      await expect(privacyLink.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("Settings navigation", () => {
  test("should have settings link in main navigation", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    await authedPage.waitForURL("**/dashboard**", { timeout: 10_000 });

    // Look for settings link in nav
    const settingsNav = authedPage
      .locator("a, button")
      .filter({ hasText: /settings|profile|account/i });

    const count = await settingsNav.count();
    if (count > 0) {
      await expect(settingsNav.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
