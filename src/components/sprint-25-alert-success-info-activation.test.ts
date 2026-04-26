// Permanent guard — Sprint 25 (Sprint 22 unused-variant audit follow-up).
//
// Alert `success` ve `info` variant aktivasyonu (her biri 0 → N kullanım).
//
// Sprint 22 census 5 unused variant gösterdi. Sprint 24 Button.success'i
// aktif kullanıma aldı (0 → 2). Sprint 25 Alert.success + Alert.info ÇİFT
// aktivasyon — 4 surface, 3 dosya:
//
//   Alert.success:
//     1) two-factor-card.tsx — recovery code rotation success message
//        (önceki <output> bg-success/10 inline)
//     2) two-factor-card.tsx — generic success state banner
//        (önceki <div role="alert"> bg-success/10 inline)
//     3) reconcile-form.tsx — stock count reconciliation success block
//        (önceki <output> bg-success/10 + CheckCircle2 + AlertTitle/Description manual)
//
//   Alert.info:
//     4) reconcile-form.tsx — pre-completion trust messaging
//        (önceki Alert className="border-info/50 bg-info/10" inline override)
//
// Pinned guard:
//   - Her surface variant="success" / variant="info" + Alert kullanır
//   - Cumulative: <Alert variant="success"> >= 3, <Alert variant="info"> >= 1

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

const ALERT_SUCCESS_REGEX = /<Alert\b[^>]*\bvariant=["']success["']/g;
const ALERT_INFO_REGEX = /<Alert\b[^>]*\bvariant=["']info["']/g;

type Surface = {
  name: string;
  path: string;
  contains: string[];
};

const SURFACES: Surface[] = [
  {
    name: "two-factor-card recovery code rotation success (Alert.success)",
    path: "src/app/(app)/settings/security/two-factor-card.tsx",
    contains: [
      'variant="success"',
      "{labels.regenerateSuccess}",
    ],
  },
  {
    name: "two-factor-card generic success banner (Alert.success)",
    path: "src/app/(app)/settings/security/two-factor-card.tsx",
    contains: [
      'variant="success"',
      "<AlertDescription>{success}</AlertDescription>",
    ],
  },
  {
    name: "reconcile-form completion success block (Alert.success)",
    path: "src/app/(app)/stock-counts/[id]/reconcile/reconcile-form.tsx",
    contains: [
      'variant="success"',
      "<AlertTitle>{labels.successTitle}</AlertTitle>",
      "<AlertDescription>{body}</AlertDescription>",
    ],
  },
  {
    name: "reconcile-form pre-completion trust info (Alert.info)",
    path: "src/app/(app)/stock-counts/[id]/reconcile/reconcile-form.tsx",
    contains: [
      'variant="info"',
      "{labels.consequenceTitle}",
    ],
  },
];

describe("Sprint 25 — Alert `success` + `info` variant activation pack 1 (4 surface)", () => {
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

  it("Cumulative: total `<Alert variant=\"success\">` usage >= 3 across src/", () => {
    let total = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      total += (content.match(ALERT_SUCCESS_REGEX) || []).length;
    }
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it("Cumulative: total `<Alert variant=\"info\">` usage >= 1 across src/", () => {
    let total = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      total += (content.match(ALERT_INFO_REGEX) || []).length;
    }
    expect(total).toBeGreaterThanOrEqual(1);
  });
});
