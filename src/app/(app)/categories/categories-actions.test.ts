// P1-4 (audit v1.1 §5.19) — behavior pinning for
// `categories/actions.ts`.
//
// Categories has one wrinkle over the generic CRUD shape: a
// per-tenant unique slug, derived from the name. The slug-uniqueness
// walker lives in-file (`uniqueSlug`) so we pin:
//
//   * slug uniqueness is scoped by organizationId (not global),
//   * the walker has a blow-off bound (<= 50 attempts) to avoid an
//     unbounded loop if the tenant's namespace is pathological,
//   * create + update both call the walker so renames don't
//     silently collide,
//   * the cache fan-out includes /items, because categories feed
//     the item list filter sidebar.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(resolve(__dirname, "actions.ts"), "utf8");

function sliceAction(start: string, end: string): string {
  const startIdx = SOURCE.indexOf(start);
  expect(startIdx, `${start} must appear in categories/actions.ts`).toBeGreaterThan(-1);
  const endIdx = SOURCE.indexOf(end, startIdx + start.length);
  expect(endIdx, `${end} must follow ${start}`).toBeGreaterThan(startIdx);
  return SOURCE.slice(startIdx, endIdx);
}

const UNIQUE_SLUG = sliceAction(
  "async function uniqueSlug",
  "export async function createCategoryAction",
);
const CREATE = sliceAction(
  "export async function createCategoryAction",
  "export async function updateCategoryAction",
);
const UPDATE = sliceAction(
  "export async function updateCategoryAction",
  "export async function deleteCategoryAction",
);
const DELETE = sliceAction(
  "export async function deleteCategoryAction",
  "t.categories.errors.deleteFailed",
);

describe("P1-4 categories/actions.ts — module-level invariants", () => {
  it("is a 'use server' module", () => {
    expect(SOURCE.trimStart().startsWith('"use server"')).toBe(true);
  });

  it("declares a rename-only schema (update ignores parentId/description)", () => {
    // Rename is separate from full create — a rename shouldn't
    // accidentally null-out the description or reparent the
    // category. The categoryRenameSchema locks the surface to
    // name-only.
    expect(SOURCE).toMatch(/categoryRenameSchema\s*=\s*z\.object\(\s*\{\s*name:/);
  });
});

describe("P1-4 uniqueSlug walker", () => {
  it("scopes the uniqueness check by organizationId (not global)", () => {
    // Two tenants can legitimately have "electronics" as a
    // category slug — the compound key is organizationId + slug.
    expect(UNIQUE_SLUG).toMatch(/organizationId_slug:\s*\{\s*organizationId,\s*slug\s*\}/);
  });

  it("respects excludeId so a rename to its own current slug is idempotent", () => {
    // If you rename "Foo" to "Foo" (e.g. re-save the form), the
    // walker should return the same slug, not append "-2".
    expect(UNIQUE_SLUG).toMatch(/existing\.id\s*===\s*excludeId/);
  });

  it("has a bounded fallback (>50 tries → suffix with Date.now())", () => {
    // Prevents an infinite loop if a tenant has ridiculous
    // category-name reuse. The Date.now() suffix is effectively
    // unique even if not strictly so.
    expect(UNIQUE_SLUG).toMatch(/n\s*>\s*50[\s\S]*?Date\.now\(\)/);
  });
});

describe("P1-4 createCategoryAction", () => {
  it("requires categories.create capability", () => {
    expect(CREATE).toMatch(/hasCapability\(\s*membership\.role,\s*"categories\.create"\s*\)/);
  });

  it("validates with categoryInputSchema", () => {
    expect(CREATE).toMatch(/categoryInputSchema\.safeParse\(/);
  });

  it("computes slug via uniqueSlug before insert", () => {
    const walkerIdx = CREATE.indexOf("uniqueSlug(membership.organizationId");
    const createIdx = CREATE.indexOf("db.category.create");
    expect(walkerIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(walkerIdx);
  });

  it("scopes the create by organizationId", () => {
    expect(CREATE).toMatch(
      /db\.category\.create\(\s*\{[\s\S]*?organizationId:\s*membership\.organizationId/,
    );
  });

  it("revalidates BOTH /categories and /items (category feeds item sidebar)", () => {
    expect(CREATE).toMatch(/revalidatePath\("\/categories"\)/);
    expect(CREATE).toMatch(/revalidatePath\("\/items"\)/);
  });

  it("records category.created audit with name", () => {
    expect(CREATE).toMatch(
      /recordAudit\([\s\S]*?action:\s*"category\.created"[\s\S]*?metadata:\s*\{\s*name:/,
    );
  });
});

describe("P1-4 updateCategoryAction — rename with guard", () => {
  it("pre-checks tenant ownership via findFirst before mutating", () => {
    // The composite update where clause (`where: { id }`) does
    // not accept organizationId directly, so the findFirst is the
    // tenant guard. Dropping it would let a cross-tenant id slip
    // through to the update.
    expect(UPDATE).toMatch(
      /db\.category\.findFirst\(\s*\{[\s\S]*?id,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("returns notFound if the category does not belong to the tenant", () => {
    expect(UPDATE).toMatch(/if\s*\(\s*!existing\s*\)[\s\S]*?t\.categories\.errors\.notFound/);
  });

  it("re-runs uniqueSlug with excludeId so self-renames don't collide", () => {
    expect(UPDATE).toMatch(/uniqueSlug\(membership\.organizationId,\s*baseSlug,\s*id\)/);
  });

  it("revalidates /categories AND /items after rename", () => {
    expect(UPDATE).toMatch(/revalidatePath\("\/categories"\)/);
    expect(UPDATE).toMatch(/revalidatePath\("\/items"\)/);
  });
});

describe("P1-4 deleteCategoryAction", () => {
  it("requires categories.delete capability", () => {
    expect(DELETE).toMatch(/hasCapability\(\s*membership\.role,\s*"categories\.delete"\s*\)/);
  });

  it("scopes delete by organizationId", () => {
    expect(DELETE).toMatch(
      /db\.category\.delete\(\s*\{[\s\S]*?where:\s*\{\s*id,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("maps P2025 → notFound instead of the generic deleteFailed", () => {
    expect(DELETE).toMatch(/error\.code\s*===\s*"P2025"[\s\S]*?t\.categories\.errors\.notFound/);
  });

  it("revalidates /categories AND /items on delete", () => {
    expect(DELETE).toMatch(/revalidatePath\("\/categories"\)/);
    expect(DELETE).toMatch(/revalidatePath\("\/items"\)/);
  });
});
