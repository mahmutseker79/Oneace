// Permanent guard — Sprint 24 (Sprint 22 unused-variant audit follow-up).
//
// Button `success` variant aktivasyonu (0 → 2 kullanım).
//
// Sprint 22 census çıktısı 5 unused variant gösterdi: Button.success,
// Alert.success, Alert.info, Input.size.{sm,lg}, Input.state.success.
// Sprint 24 ilk variant'ı (Button.success) aktif kullanıma alır:
//
//   1) two-factor-card.tsx — "Done — I've saved these codes"
//      (recovery code rotation completion CTA)
//   2) onboarding-form.tsx — "Finish setup"
//      (onboarding final step, emails boşken render edilir)
//
// Pinned guard:
//   - Her surface variant="success" + Button kullanır
//   - Toplam <Button variant="success"> kullanım >= 2 (Sprint 24 baseline)

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

const BUTTON_SUCCESS_REGEX = /<Button\b[^>]*\bvariant=["']success["']/g;

type Surface = {
  name: string;
  path: string;
  // Button block içinde hep birlikte görünmeli (sıraya bakmaz, contains check).
  contains: string[];
};

const SURFACES: Surface[] = [
  {
    name: "two-factor-card recovery code rotation completion",
    path: "src/app/(app)/settings/security/two-factor-card.tsx",
    contains: [
      'variant="success"',
      "Done — I've saved these codes",
    ],
  },
  {
    name: "onboarding-form final step (emails boşken Finish setup)",
    path: "src/app/(app)/onboarding/onboarding-form.tsx",
    contains: [
      'variant="success"',
      "Finish setup",
    ],
  },
];

describe("Sprint 24 — Button `success` variant activation pack 1 (2 surface)", () => {
  for (const surface of SURFACES) {
    it(`${surface.name} uses Button variant="success"`, () => {
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

  it("Cumulative: total `<Button variant=\"success\">` usage >= 2 across src/", () => {
    let total = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      total += (content.match(BUTTON_SUCCESS_REGEX) || []).length;
    }
    // Sprint 22 baseline: 0 kullanım
    // Sprint 24: +2 (two-factor-card recovery completion + onboarding finish)
    // Total beklenen: >= 2. Yeni kullanım eklenirse threshold kendiliğinden geçer.
    expect(total).toBeGreaterThanOrEqual(2);
  });
});
