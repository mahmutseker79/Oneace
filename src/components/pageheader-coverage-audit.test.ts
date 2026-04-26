// Permanent guard — Sprint 18 PR #1 (UX/UI audit Apr-25 §B-6 closure).
//
// PageHeader migration audit refinement. Sprint 8-14 boyunca pack 1-8 ile
// 107 surface migrate edildi (Sprint 14 PR #2 son). Sprint 18'de keşfedildi
// ki "107/141" sayımı yanıltıcıydı:
//
//   - 141 = TÜM page.tsx (auth + marketing + onboarding + special dahil)
//   - PageHeader sadece (app)/ shell için tasarlandı
//   - 5 reports/* sayfası SERVER SHELL'de PageHeader yok ama CLIENT
//     component'inde var (audit bunu sayamıyordu)
//   - 3 sayfa (zones/new, vehicles/[id], vehicles/new) PARENT DIR
//     component'inde var (vehicle-form, zone-form)
//
// Bu refined audit:
//   1. (app)/ içindeki TÜM page.tsx
//   2. Aynı klasör + parent klasörlerdeki .tsx component'lerde PageHeader ara
//   3. EXEMPT: özel layout sayfaları (onboarding wizard, redirect-only, print)
//   4. (auth)/, (marketing)/, special pages: PageHeader uygun değil — skip
//
// Hard-fail: (app)/ içindeki non-exempt page.tsx %100 PageHeader render
// etmeli (kendisinde, same-dir component'inde veya parent dir vehicle-form/
// zone-form gibi sub-component'inde).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(REPO_ROOT, "src/app");

// Exempt list — bu (app)/ sayfaları PageHeader render etmez (özel layout).
const EXEMPT: ReadonlyArray<string> = [
  // Onboarding wizard — özel welcome heading (text-xl), PageHeader değil.
  "src/app/(app)/onboarding/page.tsx",
  // Legacy redirect — UI render etmez, redirect("/integrations") yapar.
  "src/app/(app)/settings/integrations/page.tsx",
  // Print layout — minimal, PageHeader yok.
  "src/app/(app)/warehouses/[id]/bins/print/page.tsx",
];

function* walkPages(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walkPages(full);
    } else if (entry === "page.tsx") {
      yield full;
    }
  }
}

const PAGE_HEADER_PATTERN = /<PageHeader\b|from\s+["']@\/components\/ui\/page-header["']/;

function fileHasPageHeader(file: string): boolean {
  if (!existsSync(file) || !file.endsWith(".tsx")) return false;
  if (file.endsWith(".test.tsx") || file.endsWith(".test.ts")) return false;
  try {
    return PAGE_HEADER_PATTERN.test(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
}

function dirHasPageHeader(dir: string): boolean {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isFile() && fileHasPageHeader(full)) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/** Same dir + 2 parent dir tarar (zones/new → zones/zone-form, vehicles/[id] → vehicles/vehicle-form). */
function pageEffectivelyHasPageHeader(pageFile: string): { found: boolean; where: string } {
  let dir = dirname(pageFile);
  for (let depth = 0; depth < 3; depth++) {
    if (dirHasPageHeader(dir)) {
      return { found: true, where: dir.replace(`${REPO_ROOT}/`, "") };
    }
    const parent = dirname(dir);
    if (parent === dir || parent.endsWith("/src/app") || parent.endsWith("/src")) break;
    dir = parent;
  }
  return { found: false, where: "" };
}

describe("§B-6 PageHeader coverage audit (Sprint 18 closure)", () => {
  // Categorize pages by route group.
  const pages: { app: string[]; auth: string[]; marketing: string[]; other: string[] } = {
    app: [],
    auth: [],
    marketing: [],
    other: [],
  };
  for (const file of walkPages(APP_DIR)) {
    const rel = file.replace(`${REPO_ROOT}/`, "");
    if (rel.includes("/(app)/")) pages.app.push(rel);
    else if (rel.includes("/(auth)/")) pages.auth.push(rel);
    else if (rel.includes("/(marketing)/")) pages.marketing.push(rel);
    else pages.other.push(rel);
  }

  it("(app)/ shell page.tsx coverage = 100% (excluding exempt)", () => {
    const missing: string[] = [];
    for (const rel of pages.app) {
      if (EXEMPT.includes(rel)) continue;
      const abs = resolve(REPO_ROOT, rel);
      const result = pageEffectivelyHasPageHeader(abs);
      if (!result.found) missing.push(rel);
    }
    expect(
      missing,
      missing.length === 0
        ? ""
        : `(app)/ shell pages WITHOUT PageHeader (server shell, same-dir, or 2-parent-dir scan):\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("EXEMPT list documents intentional exceptions (3 special-layout pages)", () => {
    expect(EXEMPT.length).toBe(3);
    for (const rel of EXEMPT) {
      const abs = resolve(REPO_ROOT, rel);
      expect(existsSync(abs), `EXEMPT page exists: ${rel}`).toBe(true);
    }
  });

  it("snapshot: (app)/ kapsam istatistiği (informational)", () => {
    const total = pages.app.length;
    const exempt = pages.app.filter((p) => EXEMPT.includes(p)).length;
    const expected = total - exempt;
    let covered = 0;
    for (const rel of pages.app) {
      if (EXEMPT.includes(rel)) continue;
      if (pageEffectivelyHasPageHeader(resolve(REPO_ROOT, rel)).found) covered++;
    }
    // eslint-disable-next-line no-console
    console.log(
      `[pageheader-coverage] (app)/: ${covered}/${expected} (toplam ${total}, exempt ${exempt})`,
    );
    expect(covered).toBe(expected);
  });

  it("(auth)/ + (marketing)/ + special: skip (farklı layout)", () => {
    // Bunlar PageHeader uygun değil — minimal/marketing/wizard layout'ları.
    // Audit kapsamı dışında. Sadece bilgi amaçlı.
    expect(pages.auth.length).toBeGreaterThan(0);
    expect(pages.marketing.length).toBeGreaterThan(0);
  });
});
