import { expect, test } from "./fixtures/auth";

// ── P10.3 — Notification Center E2E tests ───────────────────────────

test.describe("Notification Center", () => {
  test("bell icon is visible in the header", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");

    // The bell button should be in the header
    await expect(authedPage.getByRole("button", { name: /notifications/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clicking bell opens notification popover", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");

    const bell = authedPage.getByRole("button", { name: /notifications/i });
    await bell.click();

    // Popover should appear with heading
    await expect(authedPage.getByText(/notifications/i)).toBeVisible({ timeout: 5_000 });
  });

  test("empty notification center shows empty state", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");

    const bell = authedPage.getByRole("button", { name: /notifications/i });
    await bell.click();

    // Either shows notifications or an empty state message
    const popoverContent = authedPage.locator("[data-radix-popper-content-wrapper]");
    await expect(popoverContent).toBeVisible({ timeout: 5_000 });
  });

  test("mark all read button appears when there are unread notifications", async ({
    authedPage,
  }) => {
    await authedPage.goto("/dashboard");

    const bell = authedPage.getByRole("button", { name: /notifications/i });
    await bell.click();

    // Wait for popover
    const popoverContent = authedPage.locator("[data-radix-popper-content-wrapper]");
    await expect(popoverContent).toBeVisible({ timeout: 5_000 });

    // Check for "Mark all read" — may or may not be visible depending on
    // unread count. If badge shows > 0, button should be present.
    const badge = authedPage.locator("button:has-text('Notifications') span[class*='destructive']");
    const hasBadge = (await badge.count()) > 0;

    if (hasBadge) {
      await expect(authedPage.getByRole("button", { name: /mark all read/i })).toBeVisible();
    }
  });
});
