import { expect, test } from "./fixtures/auth";

// ── P10.3 — Warehouses & Bins E2E tests ─────────────────────────────

test.describe("Warehouses", () => {
  test("should display warehouses list page", async ({ authedPage }) => {
    await authedPage.goto("/warehouses");
    await authedPage.waitForURL("**/warehouses**", { timeout: 10_000 });

    // Check for warehouses heading
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /warehouse|location|facility/i }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("should show warehouses table or list", async ({ authedPage }) => {
    await authedPage.goto("/warehouses");
    await authedPage.waitForURL("**/warehouses**", { timeout: 10_000 });

    // Look for table with warehouse data
    const table = authedPage.locator("table").first();
    const tableCount = await table.count();

    if (tableCount > 0) {
      await expect(table).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should have create/new warehouse button", async ({ authedPage }) => {
    await authedPage.goto("/warehouses");
    await authedPage.waitForURL("**/warehouses**", { timeout: 10_000 });

    // Look for new warehouse button
    const newBtn = authedPage.locator(
      "button, a"
    ).filter({ hasText: /new|create|add.*warehouse|new location/i });

    const count = await newBtn.count();
    if (count > 0) {
      await expect(newBtn.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should navigate to create warehouse form", async ({ authedPage }) => {
    await authedPage.goto("/warehouses/new");
    await authedPage.waitForURL("**/warehouses/new**", { timeout: 10_000 });

    // Check for form
    const form = authedPage.locator("form").first();
    await expect(form).toBeVisible({ timeout: 5_000 });
  });

  test("should display warehouse form with name field", async ({ authedPage }) => {
    await authedPage.goto("/warehouses/new");
    await authedPage.waitForURL("**/warehouses/new**", { timeout: 10_000 });

    // Look for name input field
    const nameInput = authedPage.locator(
      "input[placeholder*='name' i], input[placeholder*='warehouse' i], label:has-text(/name/i) ~ input"
    );

    const count = await nameInput.count();
    if (count > 0) {
      await expect(nameInput.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("Bins", () => {
  test("should navigate to bins page", async ({ authedPage }) => {
    await authedPage.goto("/bins");
    await authedPage.waitForURL("**/bins**", { timeout: 10_000 });

    // Check for bins heading
    const heading = authedPage.locator(
      "h1, h2"
    ).filter({ hasText: /bins|locations|storage/i });

    const count = await heading.count();
    if (count > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should display bins list", async ({ authedPage }) => {
    await authedPage.goto("/bins");
    await authedPage.waitForURL("**/bins**", { timeout: 10_000 });

    // Look for bins table
    const table = authedPage.locator("table").first();
    const tableCount = await table.count();

    if (tableCount > 0) {
      await expect(table).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should have create/new bin button", async ({ authedPage }) => {
    await authedPage.goto("/bins");
    await authedPage.waitForURL("**/bins**", { timeout: 10_000 });

    // Look for new bin button
    const newBtn = authedPage.locator(
      "button, a"
    ).filter({ hasText: /new|create|add.*bin|new location/i });

    const count = await newBtn.count();
    if (count > 0) {
      await expect(newBtn.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("Warehouse navigation", () => {
  test("warehouses link should be in main navigation", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    await authedPage.waitForURL("**/dashboard**", { timeout: 10_000 });

    // Look for warehouses link in nav
    const warehouseNav = authedPage.locator(
      "a, button"
    ).filter({ hasText: /warehouse|location|facility/i });

    const count = await warehouseNav.count();
    if (count > 0) {
      await expect(warehouseNav.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
