import { expect, test } from "./fixtures/auth";

// ── P10.3 — Dashboard E2E tests ─────────────────────────────────────

test.describe("Dashboard", () => {
  test("dashboard loads with KPI cards", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    await authedPage.waitForURL("**/dashboard**", { timeout: 10_000 });

    // Dashboard should show KPI cards
    const cards = authedPage.locator("[class*='card']");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar navigation links are visible", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");

    // Core nav links should be in the sidebar (desktop)
    const sidebar = authedPage.locator("nav").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Check for key navigation items
    await expect(authedPage.getByRole("link", { name: /items|inventory/i }).first()).toBeVisible();
  });

  test("search bar is present in header", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");

    await expect(authedPage.locator("input[type='search']")).toBeVisible({ timeout: 10_000 });
  });
});
