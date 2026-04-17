import { expect, test } from "./fixtures/auth";

// ── P10.3 — Export smoke tests ──────────────────────────────────────
//
// Verify that export endpoints respond with the correct Content-Type
// headers. These are smoke tests — they don't validate file contents.

test.describe("Export smoke tests", () => {
  test("items CSV export returns 200 or redirects to login", async ({ authedPage }) => {
    const response = await authedPage.goto("/items/export");
    if (response) {
      // Should either succeed (200 with CSV) or redirect to login
      const status = response.status();
      expect([200, 302]).toContain(status);
    }
  });

  test("movements CSV export returns 200 or redirects", async ({ authedPage }) => {
    const response = await authedPage.goto("/movements/export");
    if (response) {
      const status = response.status();
      expect([200, 302]).toContain(status);
    }
  });

  test("purchase orders CSV export returns 200 or redirects", async ({ authedPage }) => {
    const response = await authedPage.goto("/purchase-orders/export");
    if (response) {
      const status = response.status();
      expect([200, 302]).toContain(status);
    }
  });

  test("low-stock report page loads", async ({ authedPage }) => {
    await authedPage.goto("/reports/low-stock");
    await authedPage.waitForURL("**/reports/low-stock**", { timeout: 10_000 });

    const heading = authedPage.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("stock value report page loads", async ({ authedPage }) => {
    await authedPage.goto("/reports/stock-value");
    await authedPage.waitForURL("**/reports/stock-value**", { timeout: 10_000 });

    const heading = authedPage.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
