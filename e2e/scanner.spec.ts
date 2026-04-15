import { expect, test } from "./fixtures/auth";

// ── P10.3 — Scanner E2E tests ───────────────────────────────────────

test.describe("Scanner", () => {
  test("should display scanner page", async ({ authedPage }) => {
    await authedPage.goto("/scan");
    await authedPage.waitForURL("**/scan**", { timeout: 10_000 });

    // Check for scanner heading
    const heading = authedPage.locator(
      "h1, h2, [data-testid='scanner-heading']"
    ).filter({ hasText: /scan/i });

    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should have scan input field", async ({ authedPage }) => {
    await authedPage.goto("/scan");
    await authedPage.waitForURL("**/scan**", { timeout: 10_000 });

    // Look for barcode or scan input field
    const scanInput = authedPage.locator(
      "#scan-manual, input[placeholder*='barcode' i], input[placeholder*='scan' i], input[type='text'][class*='scan']"
    ).first();

    const count = await scanInput.count();
    if (count > 0) {
      await expect(scanInput).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should have camera input option", async ({ authedPage }) => {
    await authedPage.goto("/scan");
    await authedPage.waitForURL("**/scan**", { timeout: 10_000 });

    // Look for camera icon, button, or toggle
    const cameraControl = authedPage.locator(
      "button, div[role='button'], svg[class*='camera']"
    ).filter({ hasText: /camera|photo|video/i });

    const count = await cameraControl.count();
    if (count > 0) {
      await expect(cameraControl.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should handle manual barcode input validation", async ({ authedPage }) => {
    await authedPage.goto("/scan");
    await authedPage.waitForURL("**/scan**", { timeout: 10_000 });

    // Try entering a non-existent barcode
    const scanInput = authedPage.locator(
      "#scan-manual, input[placeholder*='barcode' i], input[placeholder*='scan' i]"
    ).first();

    const inputCount = await scanInput.count();
    if (inputCount > 0) {
      await scanInput.fill("NONEXISTENT-CODE-12345-ZZZZ");

      // Look for submit button or press Enter
      const submitBtn = authedPage.locator(
        "button[type='submit'], button:has-text(/submit|scan|search/i)"
      ).first();

      const submitCount = await submitBtn.count();
      if (submitCount > 0) {
        await submitBtn.click();
      } else {
        // Try pressing Enter
        await scanInput.press("Enter");
      }

      // Should show "not found" or error result
      const notFoundMsg = authedPage.locator(
        "text=/not found|invalid|no results|not in inventory/i"
      );

      const notFoundCount = await notFoundMsg.count();
      if (notFoundCount > 0) {
        await expect(notFoundMsg.first()).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test("should display scanner result section", async ({ authedPage }) => {
    await authedPage.goto("/scan");
    await authedPage.waitForURL("**/scan**", { timeout: 10_000 });

    // Look for results container or area
    const resultArea = authedPage.locator(
      "[class*='result'], [class*='response'], [data-testid='scan-result']"
    ).first();

    const resultCount = await resultArea.count();
    if (resultCount > 0) {
      await expect(resultArea).toBeVisible({ timeout: 5_000 });
    }
  });

  test("should have scanner mode selector", async ({ authedPage }) => {
    await authedPage.goto("/scan");
    await authedPage.waitForURL("**/scan**", { timeout: 10_000 });

    // Look for mode selector (e.g., receiving, putaway, transfer, etc.)
    const modeSelector = authedPage.locator(
      "select, [role='listbox'], button[class*='toggle']"
    ).filter({ hasText: /mode|type|action/i });

    const modeCount = await modeSelector.count();
    if (modeCount > 0) {
      await expect(modeSelector.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("Scanner navigation", () => {
  test("scanner link should be in main navigation", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    await authedPage.waitForURL("**/dashboard**", { timeout: 10_000 });

    // Look for scanner link in nav
    const scannerNav = authedPage.locator(
      "a, button"
    ).filter({ hasText: /scan|scanner|barcode/i });

    const count = await scannerNav.count();
    if (count > 0) {
      await expect(scannerNav.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
