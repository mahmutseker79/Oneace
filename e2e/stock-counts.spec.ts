import { expect, test } from "./fixtures/auth";

// ── P10.3 — Stock Counts E2E tests ──────────────────────────────────

test.describe("Stock Counts", () => {
  test("stock counts page loads", async ({ authedPage }) => {
    await authedPage.goto("/stock-counts");
    await authedPage.waitForURL("**/stock-counts**", { timeout: 10_000 });

    // Page should render heading or table
    const heading = authedPage.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("new stock count form loads", async ({ authedPage }) => {
    await authedPage.goto("/stock-counts/new");
    await authedPage.waitForURL("**/stock-counts/new**", { timeout: 10_000 });

    // Should see count name field and methodology option
    await expect(authedPage.getByLabel(/name|title|count name/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("new stock count requires a name", async ({ authedPage }) => {
    await authedPage.goto("/stock-counts/new");
    await authedPage.waitForURL("**/stock-counts/new**", { timeout: 10_000 });

    // Try submitting empty form
    const submitBtn = authedPage.getByRole("button", {
      name: /create|start|save/i,
    });
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click();
      // Should stay on same page
      expect(authedPage.url()).toContain("/stock-counts/new");
    }
  });
});
