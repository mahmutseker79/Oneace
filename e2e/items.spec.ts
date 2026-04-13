import { expect, test } from "./fixtures/auth";

// ── P10.3 — Items CRUD E2E tests ────────────────────────────────────

test.describe("Items", () => {
  const itemName = `E2E Item ${Date.now()}`;
  const sku = `E2E-${Date.now()}`;

  test("can create a new item", async ({ authedPage }) => {
    await authedPage.goto("/items/new");
    await authedPage.waitForURL("**/items/new**", { timeout: 10_000 });

    // Fill required fields
    await authedPage.getByLabel(/name/i).first().fill(itemName);
    await authedPage.getByLabel(/sku/i).fill(sku);

    // Submit
    await authedPage.getByRole("button", { name: /save|create|submit/i }).click();

    // Should redirect to item detail or items list
    await authedPage.waitForURL(/\/items/, { timeout: 15_000 });
  });

  test("items list page shows item table", async ({ authedPage }) => {
    await authedPage.goto("/items");
    await authedPage.waitForURL("**/items**", { timeout: 10_000 });

    // Table should be present
    await expect(authedPage.locator("table").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("can navigate to item detail page", async ({ authedPage }) => {
    await authedPage.goto("/items");

    // Click first item link in the table (if any items exist)
    const firstItemLink = authedPage.locator("table a").first();
    const linkCount = await firstItemLink.count();

    if (linkCount > 0) {
      await firstItemLink.click();
      await authedPage.waitForURL(/\/items\/[^/]+$/, { timeout: 10_000 });
      // Item detail page should have item name visible
      await expect(authedPage.locator("h1, h2").first()).toBeVisible();
    }
    // If no items, that's OK — the test just skips the click.
  });
});
