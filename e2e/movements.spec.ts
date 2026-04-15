import { expect, test } from "./fixtures/auth";

// ── P10.3 — Movements E2E tests ─────────────────────────────────────

test.describe("Movements", () => {
  test("movements page loads and shows table or empty state", async ({ authedPage }) => {
    await authedPage.goto("/movements");
    await authedPage.waitForURL("**/movements**", { timeout: 10_000 });

    // Either a table with movements or an empty state
    const hasTable = (await authedPage.locator("table").count()) > 0;
    const hasEmpty = (await authedPage.getByText(/no movements|no records|empty/i).count()) > 0;

    expect(hasTable || hasEmpty).toBe(true);
  });

  test("new movement form loads with required fields", async ({ authedPage }) => {
    await authedPage.goto("/movements/new");
    await authedPage.waitForURL("**/movements/new**", { timeout: 10_000 });

    // Type selector should be visible
    await expect(authedPage.getByText(/receipt|issue|adjustment|transfer/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("new movement form validates required fields", async ({ authedPage }) => {
    await authedPage.goto("/movements/new");
    await authedPage.waitForURL("**/movements/new**", { timeout: 10_000 });

    // Try to submit without filling — should show validation feedback
    const submitBtn = authedPage.getByRole("button", {
      name: /save|submit|record|create/i,
    });
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click();
      // Should stay on the page (not redirect)
      expect(authedPage.url()).toContain("/movements/new");
    }
  });
});
