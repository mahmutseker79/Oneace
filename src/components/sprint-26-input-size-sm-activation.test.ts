// Permanent guard — Sprint 26 (Sprint 22 unused-variant audit follow-up).
//
// Input `size="sm"` aktivasyonu (0 → 2 kullanım).
//
// Sprint 22 census 5 unused variant gösterdi. Sprint 24 Button.success (✅),
// Sprint 25 Alert.success + Alert.info (✅). Sprint 26 Input.size.sm —
// 4. unused variant aktivasyonu.
//
//   1) movements/movements-filter-bar.tsx — search Input
//      (filter-bar dense form, tek satır search)
//   2) purchase-orders/purchase-orders-filter-bar.tsx — search Input
//      (filter-bar dense form, tek satır search)
//
// Date Input'lar ve Select'lerle yan yana satırlardaki Input'lar size= override
// EDİLMEDİ — height mismatch riski (Select hardcoded h-[var(--control-h-md)]
// kullanır, Input.sm h-[var(--control-h-sm)] olur, hizalama bozulur). Sprint
// 27+ aday: Select primitive'i de size variant'lı hale getir, sonra date
// Input'lar + Select'leri tek seferde sm'e migrate et.
//
// Pinned guard:
//   - Her surface size="sm" kullanır
//   - Cumulative: <Input size="sm"> >= 2

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC_DIR = resolve(REPO_ROOT, "src");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") && !entry.endsWith(".stories.tsx")) {
      yield full;
    }
  }
}

const INPUT_SIZE_SM_REGEX = /<Input\b[^>]*\bsize=["']sm["']/g;

type Surface = {
  name: string;
  path: string;
  contains: string[];
};

const SURFACES: Surface[] = [
  {
    name: "movements-filter-bar search Input",
    path: "src/app/(app)/movements/movements-filter-bar.tsx",
    contains: [
      'id="movements-filter-q"',
      'size="sm"',
    ],
  },
  {
    name: "purchase-orders-filter-bar search Input",
    path: "src/app/(app)/purchase-orders/purchase-orders-filter-bar.tsx",
    contains: [
      'id="po-filter-q"',
      'size="sm"',
    ],
  },
];

describe("Sprint 26 — Input `size=\"sm\"` activation pack 1 (2 surface)", () => {
  for (const surface of SURFACES) {
    it(`${surface.name} uses size="sm"`, () => {
      const filePath = resolve(REPO_ROOT, surface.path);
      const src = readFileSync(filePath, "utf8");
      for (const fragment of surface.contains) {
        expect(
          src,
          `${surface.path} missing fragment: ${fragment}`,
        ).toContain(fragment);
      }
    });
  }

  it("Cumulative: total `<Input size=\"sm\">` usage >= 2 across src/", () => {
    let total = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      total += (content.match(INPUT_SIZE_SM_REGEX) || []).length;
    }
    expect(total).toBeGreaterThanOrEqual(2);
  });
});
