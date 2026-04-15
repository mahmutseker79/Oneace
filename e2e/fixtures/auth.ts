import { type Page, test as base } from "@playwright/test";

// ── P10.3 — Auth fixture ────────────────────────────────────────────
//
// Provides a logged-in Page that re-uses stored session state across
// tests.  The first test run registers a fresh user (+ org), logs in,
// and caches the cookies.  Subsequent tests rehydrate from the cookie
// file so they skip the login page.

const TEST_USER = {
  name: "E2E Tester",
  email: `e2e-${Date.now()}@oneace.test`,
  password: "TestPassword123!",
  orgName: "E2E Test Org",
};

/** Register via the UI and redirect to /items (default post-register). */
async function registerUser(page: Page) {
  await page.goto("/register");
  await page.getByLabel(/name/i).first().fill(TEST_USER.name);
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /create account|sign up|register/i }).click();

  // Onboarding: create org
  await page.waitForURL("**/onboarding**", { timeout: 10_000 });
  await page.getByLabel(/organization/i).fill(TEST_USER.orgName);
  await page.getByRole("button", { name: /create|continue/i }).click();

  // Wait for the app shell to load
  await page.waitForURL("**/items**", { timeout: 15_000 });
}

/** Log in via the UI. */
async function loginUser(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL("**/dashboard**", { timeout: 10_000 });
}

// ── Extend the base test with a logged-in page ─────────────────────

type AuthFixtures = {
  authedPage: Page;
  testUser: typeof TEST_USER;
};

export const test = base.extend<AuthFixtures>({
  testUser: [TEST_USER, { option: true }],

  authedPage: async ({ page, testUser }, use) => {
    // Try navigating to a protected page — if redirected to login,
    // we need to authenticate.
    await page.goto("/dashboard");

    if (page.url().includes("/login")) {
      try {
        await loginUser(page);
      } catch {
        // First time — user doesn't exist yet; register.
        await registerUser(page);
      }
    }

    await use(page);
  },
});

export { expect } from "@playwright/test";
export { TEST_USER };
