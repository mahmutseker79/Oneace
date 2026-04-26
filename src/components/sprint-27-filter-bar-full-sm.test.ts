// Permanent guard — Sprint 27 (Sprint 26 follow-up).
//
// Filter-bar full sm migration + Select primitive size variant.
//
// Sprint 26'da scope dışı bırakılan iki engel:
//   1) movements + purchase-orders filter-bar'larda date Input + Select satırları
//      sm'e migrate edilemiyordu çünkü Select primitive hardcoded h-md kullanıyordu
//      → Sprint 27 PR #1: Select primitive cva refactor (size: sm/default/lg)
//        (Sprint 28: `lg` retired — 0 kullanım, primitive cva temizliği. Union: sm/default.)
//
//   2) Migration yapılınca Select.sm + Input.sm + Button.sm aynı row'da yan yana
//      hizalı olur (--control-h-sm token lock-step).
//
// Surface'ler:
//   movements-filter-bar:
//     - movements-filter-from date Input → size="sm"
//     - movements-filter-to date Input → size="sm"
//     - movements-filter-type SelectTrigger → size="sm"
//     - movements-filter-warehouse SelectTrigger → size="sm"
//   purchase-orders-filter-bar:
//     - po-filter-status SelectTrigger → size="sm"
//     - po-filter-supplier SelectTrigger → size="sm"
//
// Pinned guard:
//   - Select primitive cva size variant union (Sprint 28 sonrası 2 size: sm + default)
//   - 6 surface'in her biri için id + size="sm" kombinasyonu
//   - Cumulative: <SelectTrigger size="sm"> >= 4, <Input size="sm"> >= 4
//     (Sprint 26: Input.sm 2 search + Sprint 27: 2 date = 4)

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

const SELECT_TRIGGER_SM_REGEX = /<SelectTrigger\b[^>]*\bsize=["']sm["']/g;
const INPUT_SM_REGEX = /<Input\b[^>]*\bsize=["']sm["']/g;

type Surface = {
  name: string;
  path: string;
  contains: string[];
};

const SURFACES: Surface[] = [
  {
    name: "movements-filter-bar from date Input sm",
    path: "src/app/(app)/movements/movements-filter-bar.tsx",
    contains: ['id="movements-filter-from"', 'type="date"', 'size="sm"'],
  },
  {
    name: "movements-filter-bar to date Input sm",
    path: "src/app/(app)/movements/movements-filter-bar.tsx",
    contains: ['id="movements-filter-to"', 'type="date"', 'size="sm"'],
  },
  {
    name: "movements-filter-bar type SelectTrigger sm",
    path: "src/app/(app)/movements/movements-filter-bar.tsx",
    contains: ['id="movements-filter-type"', 'size="sm"'],
  },
  {
    name: "movements-filter-bar warehouse SelectTrigger sm",
    path: "src/app/(app)/movements/movements-filter-bar.tsx",
    contains: ['id="movements-filter-warehouse"', 'size="sm"'],
  },
  {
    name: "purchase-orders-filter-bar status SelectTrigger sm",
    path: "src/app/(app)/purchase-orders/purchase-orders-filter-bar.tsx",
    contains: ['id="po-filter-status"', 'size="sm"'],
  },
  {
    name: "purchase-orders-filter-bar supplier SelectTrigger sm",
    path: "src/app/(app)/purchase-orders/purchase-orders-filter-bar.tsx",
    contains: ['id="po-filter-supplier"', 'size="sm"'],
  },
];

describe("Sprint 27 — Filter-bar full sm migration + Select primitive size variant", () => {
  it("Select primitive cva has size variant union (sm + default; Sprint 28: lg retired)", () => {
    const selectSrc = readFileSync(resolve(REPO_ROOT, "src/components/ui/select.tsx"), "utf8");
    expect(selectSrc).toMatch(/cva\(/);
    expect(selectSrc).toMatch(/selectTriggerVariants/);
    expect(selectSrc).toMatch(/sm:\s*"/);
    expect(selectSrc).toMatch(/default:\s*"/);
    expect(selectSrc).toMatch(/--control-h-sm/);
    expect(selectSrc).toMatch(/--control-h-md/);
    // Sprint 28: lg retired → cva'da artık --control-h-lg yok (CSS token Button.lg için kalır)
    expect(selectSrc).not.toMatch(/lg:\s*"h-\[var\(--control-h-lg\)\]/);
  });

  for (const surface of SURFACES) {
    it(`${surface.name}`, () => {
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

  it("Cumulative: total `<SelectTrigger size=\"sm\">` usage >= 4 across src/", () => {
    let total = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      total += (content.match(SELECT_TRIGGER_SM_REGEX) || []).length;
    }
    expect(total).toBeGreaterThanOrEqual(4);
  });

  it("Cumulative: total `<Input size=\"sm\">` usage >= 4 across src/", () => {
    let total = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      total += (content.match(INPUT_SM_REGEX) || []).length;
    }
    // Sprint 26: 2 search + Sprint 27: 2 date = 4
    expect(total).toBeGreaterThanOrEqual(4);
  });
});
