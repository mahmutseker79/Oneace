// Sprint 11 PR #1 — Card variant raw-className guard (hard fail)
// (UX/UI audit Apr-25 §C-3 follow-up).
//
// Sprint 10 PR #3 ile Card primitive'ine `variant` prop eklendi
// (default | interactive | warning | destructive). 6 ad-hoc kullanım
// migrate edildi. Sprint 11 PR #1 ile kalan 7 ad-hoc kullanım da
// variant'a çekildi:
//   - settings/general/settings-form.tsx (border-destructive/20 bg-destructive/5)
//   - settings/danger-zone-card.tsx (border-destructive/50 lg:col-span-2)
//   - settings/transfer-ownership-card.tsx (border-warning/50 lg:col-span-2)
//   - migrations/new/page.tsx (border-destructive/50 bg-destructive/5)
//   - migrations/[id]/page.tsx (border-destructive/50)
//   - transfers/[id]/add-line/page.tsx (border-warning/20 bg-warning-light)
//   - upgrade-prompt.tsx (border-warning/60 bg-warning-light)
//
// Bu test artık HARD FAIL: <Card className="..."> içinde
// border-destructive*/border-warning*/bg-destructive/5 raw className'i
// yasak. Yeni eklenen Card severity styling'i `variant` prop kullanmalı.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC = resolve(REPO_ROOT, "src");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

// Yasak pattern: <Card className="..."> içinde:
//   - border-destructive*  (border-destructive, /20, /50, vs.)
//   - border-warning*
//   - bg-destructive/N
//   - bg-warning-light  (Card root'ta)
const FORBIDDEN_CARD_CLASSNAME = /<Card[^>]*className="[^"]*\b(?:border-destructive|border-warning|bg-destructive\/\d+|bg-warning-light)\b[^"]*"/;

// Allow-list: Card primitive'in kendisi (CARD_VARIANTS map'i bu class'ları kullanıyor)
const ALLOWED_FILES: ReadonlySet<string> = new Set<string>([
  "src/components/ui/card.tsx",
  "src/components/ui/card.stories.tsx",
  // bu test dosyasının kendisi (yasak pattern'i comment olarak içeriyor)
  "src/components/sprint-11-card-variant-guard.test.ts",
  "src/components/sprint-10-card-variants.test.ts",
]);

describe("Sprint 11 PR #1 §C-3 — Card variant raw-className guard (hard fail)", () => {
  it("no <Card> uses raw severity className — must use `variant` prop", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = file.replace(`${REPO_ROOT}/`, "");
      if (ALLOWED_FILES.has(rel)) continue;
      const content = readFileSync(file, "utf8");
      if (FORBIDDEN_CARD_CLASSNAME.test(content)) {
        offenders.push(rel);
      }
    }

    expect(
      offenders,
      `Raw Card severity className tespit edildi. ` +
        `Sprint 10/11'den sonra Card severity \`variant="warning"\` veya \`variant="destructive"\` ile yapılmalı.\n\n` +
        `Offenders:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
