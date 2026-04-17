# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: items.spec.ts >> Items >> can create a new item
- Location: e2e/items.spec.ts:9:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/onboarding**" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - link "O OneAce" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]: O
        - generic [ref=e8]: OneAce
      - generic [ref=e9]:
        - heading "Inventory management for warehouse teams." [level=1] [ref=e10]:
          - generic [ref=e11]: Inventory management
          - generic [ref=e12]: for warehouse teams.
        - paragraph [ref=e13]: The simplicity of Sortly with the power of inFlow. Offline stock counts, fast barcode scanning, and multi-warehouse transfers — in one app.
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]: ✓
            - text: Works offline, barcode-first
          - generic [ref=e17]:
            - generic [ref=e18]: ✓
            - text: Multi-warehouse + bin tracking
          - generic [ref=e19]:
            - generic [ref=e20]: ✓
            - text: Free plan, no credit card
      - generic [ref=e21]: © 2026 OneAce. All rights reserved.
    - generic [ref=e24]:
      - generic [ref=e25]:
        - heading "Create your account" [level=1] [ref=e26]
        - paragraph [ref=e27]: Start managing your inventory in 5 minutes.
      - generic [ref=e28]:
        - generic [ref=e29]:
          - text: Your name
          - textbox "Your name" [ref=e30]:
            - /placeholder: Jane Doe
            - text: E2E Tester
        - generic [ref=e31]:
          - text: Company / organization name
          - textbox "Company / organization name" [active] [ref=e32]:
            - /placeholder: Acme Ltd.
        - generic [ref=e33]:
          - text: Email
          - textbox "Email" [ref=e34]:
            - /placeholder: you@company.com
            - text: e2e-1776352872120@oneace.test
        - generic [ref=e35]:
          - text: Password
          - textbox "Password" [ref=e36]:
            - /placeholder: At least 8 characters
            - text: TestPassword123!
          - paragraph [ref=e37]: At least 8 characters
        - button "Create account" [ref=e38]
        - paragraph [ref=e39]:
          - text: By continuing, you agree to our
          - link "Terms of Service" [ref=e40] [cursor=pointer]:
            - /url: /legal/terms
          - text: and
          - link "Privacy Policy" [ref=e41] [cursor=pointer]:
            - /url: /legal/privacy
          - text: .
      - generic [ref=e42]:
        - text: Already have an account?
        - link "Sign in" [ref=e43] [cursor=pointer]:
          - /url: /login
  - alert [ref=e44]
```

# Test source

```ts
  1  | import { type Page, test as base } from "@playwright/test";
  2  | 
  3  | // ── P10.3 — Auth fixture ────────────────────────────────────────────
  4  | //
  5  | // Provides a logged-in Page that re-uses stored session state across
  6  | // tests.  The first test run registers a fresh user (+ org), logs in,
  7  | // and caches the cookies.  Subsequent tests rehydrate from the cookie
  8  | // file so they skip the login page.
  9  | 
  10 | const TEST_USER = {
  11 |   name: "E2E Tester",
  12 |   email: `e2e-${Date.now()}@oneace.test`,
  13 |   password: "TestPassword123!",
  14 |   orgName: "E2E Test Org",
  15 | };
  16 | 
  17 | /** Register via the UI and redirect to /items (default post-register). */
  18 | async function registerUser(page: Page) {
  19 |   await page.goto("/register");
  20 |   await page.getByLabel(/name/i).first().fill(TEST_USER.name);
  21 |   await page.getByLabel(/email/i).fill(TEST_USER.email);
  22 |   await page.getByLabel(/password/i).fill(TEST_USER.password);
  23 |   await page.getByRole("button", { name: /create account|sign up|register/i }).click();
  24 | 
  25 |   // Onboarding: create org
> 26 |   await page.waitForURL("**/onboarding**", { timeout: 10_000 });
     |              ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  27 |   await page.getByLabel(/organization/i).fill(TEST_USER.orgName);
  28 |   await page.getByRole("button", { name: /create|continue/i }).click();
  29 | 
  30 |   // Wait for the app shell to load
  31 |   await page.waitForURL("**/items**", { timeout: 15_000 });
  32 | }
  33 | 
  34 | /** Log in via the UI. */
  35 | async function loginUser(page: Page) {
  36 |   await page.goto("/login");
  37 |   await page.getByLabel(/email/i).fill(TEST_USER.email);
  38 |   await page.getByLabel(/password/i).fill(TEST_USER.password);
  39 |   await page.getByRole("button", { name: /sign in|log in/i }).click();
  40 |   await page.waitForURL("**/dashboard**", { timeout: 10_000 });
  41 | }
  42 | 
  43 | // ── Extend the base test with a logged-in page ─────────────────────
  44 | 
  45 | type AuthFixtures = {
  46 |   authedPage: Page;
  47 |   testUser: typeof TEST_USER;
  48 | };
  49 | 
  50 | export const test = base.extend<AuthFixtures>({
  51 |   testUser: [TEST_USER, { option: true }],
  52 | 
  53 |   authedPage: async ({ page, testUser }, use) => {
  54 |     // Try navigating to a protected page — if redirected to login,
  55 |     // we need to authenticate.
  56 |     await page.goto("/dashboard");
  57 | 
  58 |     if (page.url().includes("/login")) {
  59 |       try {
  60 |         await loginUser(page);
  61 |       } catch {
  62 |         // First time — user doesn't exist yet; register.
  63 |         await registerUser(page);
  64 |       }
  65 |     }
  66 | 
  67 |     await use(page);
  68 |   },
  69 | });
  70 | 
  71 | export { expect } from "@playwright/test";
  72 | export { TEST_USER };
  73 | 
```