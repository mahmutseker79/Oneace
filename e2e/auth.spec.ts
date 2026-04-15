import { expect, test } from "@playwright/test";

// ── P10.3 — Authentication E2E tests ────────────────────────────────

test.describe("Login page", () => {
  test("shows login form with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("nonexistent@test.invalid");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should show error alert
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/items");
    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("preserves redirect param after login", async ({ page }) => {
    await page.goto("/items");
    await page.waitForURL("**/login**", { timeout: 10_000 });
    // The login page should contain a ?redirect or ?next param
    const url = new URL(page.url());
    const next = url.searchParams.get("next") ?? url.searchParams.get("redirect");
    expect(next).toBeTruthy();
  });
});

test.describe("Registration page", () => {
  test("shows registration form", async ({ page }) => {
    await page.goto("/register");
    // If registration is enabled, form should be visible.
    // If disabled, we're redirected to /login.
    const isRegisterPage = page.url().includes("/register");
    if (isRegisterPage) {
      await expect(
        page.getByRole("button", { name: /create account|sign up|register/i }),
      ).toBeVisible();
    } else {
      // Registration disabled — redirected to login
      expect(page.url()).toContain("/login");
    }
  });
});
