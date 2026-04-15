import { expect, test } from "./fixtures/auth";

// ── P10.3 — Role-based permissions E2E tests ────────────────────────
//
// These tests verify that the logged-in OWNER can see all action
// buttons. Viewer-role tests would require a second user with
// VIEWER membership, which is beyond the scope of this initial suite
// (would require invite flow or direct DB seeding).

test.describe("Permissions — OWNER sees all actions", () => {
  test("items page shows Create Item button for OWNER", async ({ authedPage }) => {
    await authedPage.goto("/items");
    await expect(
      authedPage.getByRole("link", { name: /new item|create item|add item/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("movements page shows New Movement link for OWNER", async ({ authedPage }) => {
    await authedPage.goto("/movements");
    await expect(
      authedPage.getByRole("link", { name: /new movement|record movement|create/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("stock counts page shows New Count link for OWNER", async ({ authedPage }) => {
    await authedPage.goto("/stock-counts");
    await expect(
      authedPage.getByRole("link", { name: /new count|start count|create/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("purchase orders page shows Create PO link for OWNER", async ({ authedPage }) => {
    await authedPage.goto("/purchase-orders");
    await expect(
      authedPage.getByRole("link", { name: /new order|create.*order|new po/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("admin section is visible in sidebar for OWNER", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");
    // The sidebar should contain an admin/settings section visible to OWNER
    await expect(
      authedPage.getByRole("link", { name: /users|team|settings/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
