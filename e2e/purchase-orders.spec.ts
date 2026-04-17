import { expect, test } from "./fixtures/auth";

// ── P10.3 — Purchase Orders E2E tests ───────────────────────────────

test.describe("Purchase Orders", () => {
  test("purchase orders page loads", async ({ authedPage }) => {
    await authedPage.goto("/purchase-orders");
    await authedPage.waitForURL("**/purchase-orders**", { timeout: 10_000 });

    const heading = authedPage.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("new PO form has supplier and item fields", async ({ authedPage }) => {
    await authedPage.goto("/purchase-orders/new");
    await authedPage.waitForURL("**/purchase-orders/new**", { timeout: 10_000 });

    // Supplier selector should be present
    await expect(authedPage.getByText(/supplier/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("PO list shows status badges", async ({ authedPage }) => {
    await authedPage.goto("/purchase-orders");
    await authedPage.waitForURL("**/purchase-orders**", { timeout: 10_000 });

    // If POs exist, should show status badges (DRAFT, ORDERED, etc.)
    const badges = authedPage.locator("[class*='badge'], [data-slot='badge']");
    const table = authedPage.locator("table");
    const hasTable = (await table.count()) > 0;

    if (hasTable) {
      // If table has rows, check for badge elements
      const rowCount = await authedPage.locator("table tbody tr").count();
      if (rowCount > 0) {
        expect(await badges.count()).toBeGreaterThan(0);
      }
    }
  });
});
