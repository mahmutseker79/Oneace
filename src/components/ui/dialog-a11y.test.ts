/**
 * P3-3 (audit v1.0 §9.4) — pin a11y hygiene on every Dialog /
 * AlertDialog render across the app.
 *
 * Radix warns at runtime if a DialogContent / AlertDialogContent
 * is mounted without an accompanying DialogDescription /
 * AlertDialogDescription (or an `aria-describedby`). Those
 * warnings only show up in dev, so it's easy for a new dialog to
 * land in main with no SR summary — the audit caught two of
 * them in the bin-management area.
 *
 * Rather than pin which dialogs exist (that list changes), we
 * scan every *.tsx file under `src` that imports DialogContent
 * or AlertDialogContent and assert that the same file ALSO
 * imports (and references in JSX) the matching *Description
 * primitive. If a new dialog is added without an SR description,
 * this test fails and the PR author has to make an explicit
 * decision — either add the description, or suppress with an
 * `aria-describedby` pattern we'd add to this allow-list.
 *
 * Intentionally static-analysis only — instantiating every
 * dialog in a JSDOM test would be expensive and fragile (each
 * has its own server-action / Prisma / i18n dependency graph).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC_ROOT = join(process.cwd(), "src");

/** Walk `src` collecting every `.tsx` file. */
function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip node_modules just in case something odd got symlinked;
      // .next is outside src so it's already excluded.
      if (entry === "node_modules") continue;
      collectTsxFiles(full, acc);
    } else if (entry.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_TSX = collectTsxFiles(SRC_ROOT);

// Files that are the dialog primitive *definitions* themselves
// (they export the parts but are not consumers).
const PRIMITIVE_DEFS = new Set([
  join(SRC_ROOT, "components/ui/dialog.tsx"),
  join(SRC_ROOT, "components/ui/alert-dialog.tsx"),
]);

type DialogConsumer = {
  path: string;
  relative: string;
  kind: "Dialog" | "AlertDialog";
};

const consumers: DialogConsumer[] = [];

for (const path of ALL_TSX) {
  if (PRIMITIVE_DEFS.has(path)) continue;
  const src = readFileSync(path, "utf8");
  // A consumer imports DialogContent or AlertDialogContent from
  // our local primitive. We use the literal token (not a regex
  // with word boundaries) so `AlertDialogContent` doesn't match
  // the plain-Dialog rule.
  const importsDialog = /\bDialogContent\b/.test(src) && !/\bAlertDialogContent\b/.test(src);
  const importsAlertDialog = /\bAlertDialogContent\b/.test(src);

  if (importsDialog) {
    consumers.push({ path, relative: relative(SRC_ROOT, path), kind: "Dialog" });
  }
  if (importsAlertDialog) {
    consumers.push({ path, relative: relative(SRC_ROOT, path), kind: "AlertDialog" });
  }
}

describe("Dialog / AlertDialog a11y description coverage (§9.4)", () => {
  it("finds at least one Dialog or AlertDialog consumer", () => {
    // Guardrail: if the collector regressed to an empty list,
    // the per-file assertions below would trivially pass.
    expect(consumers.length).toBeGreaterThan(0);
  });

  it.each(consumers)(
    "$relative ($kind) renders a $kind\Description so Radix doesn't warn",
    ({ path, kind }) => {
      const src = readFileSync(path, "utf8");
      const descriptionToken = kind === "Dialog" ? "DialogDescription" : "AlertDialogDescription";

      // 1. The description primitive is imported.
      //    Match with word-boundaries so `AlertDialogDescription`
      //    doesn't satisfy the plain-Dialog rule (and vice versa).
      const importRegex = new RegExp(`\\b${descriptionToken}\\b`);
      expect(src, `${descriptionToken} token missing from ${path}`).toMatch(importRegex);

      // 2. The primitive is actually rendered (catches the
      //    "imported but not used" lint-bypass case).
      const renderRegex = new RegExp(`<${descriptionToken}[\\s\\n>]`);
      expect(src, `<${descriptionToken}> not rendered in ${path}`).toMatch(renderRegex);
    },
  );
});

describe("Bin management dialogs — pinned fixtures (§9.4)", () => {
  // These two were the audit's named offenders. Keep the
  // targeted assertions even after the sweeping rule above so
  // the failure message is unambiguous for the specific files.
  const FIXTURES = [
    "app/(app)/warehouses/[id]/bins/bin-form-dialog.tsx",
    "app/(app)/warehouses/[id]/bins/bin-transfer-dialog.tsx",
  ];

  it.each(FIXTURES)("%s imports DialogDescription from the canonical primitive", (rel) => {
    const src = readFileSync(join(SRC_ROOT, rel), "utf8");
    expect(src).toMatch(/from\s+"@\/components\/ui\/dialog"/);
    expect(src).toMatch(/\bDialogDescription\b/);
  });

  it("bin-form-dialog's icon-only edit trigger exposes an accessible name", () => {
    // The edit-mode trigger renders just a Pencil icon. Without
    // an explicit aria-label it's announced as an unlabeled
    // button; the fix adds aria-label={labels.label}.
    const src = readFileSync(
      join(SRC_ROOT, "app/(app)/warehouses/[id]/bins/bin-form-dialog.tsx"),
      "utf8",
    );
    expect(src).toMatch(/aria-label=\{labels\.label\}/);
  });
});
