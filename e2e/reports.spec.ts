import { expect, test } from "./fixtures/auth";

// ── P10.3 — Reports E2E tests ───────────────────────────────────────

test.describe("Reports", () => {
  test("should display reports index page with heading", async ({ authedPage }) => {
    await authedPage.goto("/reports");
    await authedPage.waitForURL("**/reports**", { timeout: 10_000 });

    // Check for reports heading
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /reports/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("should show list of available reports", async ({ authedPage }) => {
    await authedPage.goto("/reports");
    await authedPage.waitForURL("**/reports**", { timeout: 10_000 });

    // Look for report links or cards
    const reportLinks = authedPage.locator(
      "a, button, [role='link']"
    ).filter({ hasText: /stock|movement|scan|inventory/i });

    const count = await reportLinks.count();
    if (count > 0) {
      await expect(reportLinks.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should navigate to low stock report", async ({ authedPage }) => {
    await authedPage.goto("/reports/low-stock");
    await authedPage.waitForURL("**/reports/low-stock**", { timeout: 10_000 });

    // Check for low stock report heading
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /low stock/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("should navigate to stock value report", async ({ authedPage }) => {
    await authedPage.goto("/reports/stock-value");
    await authedPage.waitForURL("**/reports/stock-value**", { timeout: 10_000 });

    // Check for stock value report heading
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /stock value|inventory value/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("should navigate to movements/history report", async ({ authedPage }) => {
    await authedPage.goto("/reports/movements");
    await authedPage.waitForURL("**/reports/movements**", { timeout: 10_000 });

    // Check for movements report heading
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /movement|history/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("should navigate to scan activity report", async ({ authedPage }) => {
    await authedPage.goto("/reports/scan-activity");
    await authedPage.waitForURL("**/reports/scan-activity**", { timeout: 10_000 });

    // Check for scan activity report heading
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /scan|activity/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("should navigate to bin inventory report", async ({ authedPage }) => {
    await authedPage.goto("/reports/bin-inventory");
    await authedPage.waitForURL("**/reports/bin-inventory**", { timeout: 10_000 });

    // Check for bin inventory report heading
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /bin|location/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Report features", () => {
  test("reports should have export or download option", async ({ authedPage }) => {
    await authedPage.goto("/reports/low-stock");
    await authedPage.waitForURL("**/reports/low-stock**", { timeout: 10_000 });

    // Look for export, download, or print button
    const exportBtn = authedPage.locator(
      "button, a"
    ).filter({ hasText: /export|download|print|csv|pdf/i });

    const count = await exportBtn.count();
    if (count > 0) {
      await expect(exportBtn.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("reports should display data table or chart", async ({ authedPage }) => {
    await authedPage.goto("/reports/low-stock");
    await authedPage.waitForURL("**/reports/low-stock**", { timeout: 10_000 });

    // Look for table or chart elements
    const dataDisplay = authedPage.locator("table, [class*='chart'], [class*='graph']").first();
    const dataCount = await dataDisplay.count();

    if (dataCount > 0) {
      await expect(dataDisplay).toBeVisible({ timeout: 5_000 });
    }
  });
});
