// src/lib/idempotency/ui-callers.static.test.ts
//
// Pinned static-analysis test for P0-02 rc3 (GOD MODE roadmap
// 2026-04-23).
//
// Invariant
// ---------
// The three UI surfaces that call the idempotency-wrapped server
// actions MUST mint an idempotency key and pass it to the action.
// Without the UI half, the server wrapper is a no-op (key absent →
// pass-through), and a double-submit produces two ledger mutations
// again.
//
// Covered surfaces:
//   - src/app/(app)/sales-orders/[id]/ship/page.tsx
//       (FormData — idempotencyKey as a named field)
//   - src/app/(app)/transfers/[id]/receive/receive-form.tsx
//       (input object — idempotencyKey property)
//   - src/app/(app)/transfers/[id]/ship-transfer-button.tsx
//       (second-arg options — idempotencyKey property)
//
// If a refactor drops the key minting from any of these, this test
// fails at CI time. The matching required-callsites.static.test.ts
// covers the server side.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found");
}

interface UiSurface {
  file: string;
  label: string;
  // One or more substring markers that must all appear. We keep the
  // check simple (substring match) because the surfaces are small
  // and the markers are chosen to be stable.
  markers: string[];
}

const UI_SURFACES: UiSurface[] = [
  {
    file: "src/app/(app)/sales-orders/[id]/ship/page.tsx",
    label: "SO ship page — must mint + send idempotencyKey via FormData",
    markers: [
      "mintIdempotencyKey",
      "idempotencyKeyRef",
      'formData.append("idempotencyKey"',
    ],
  },
  {
    file: "src/app/(app)/transfers/[id]/receive/receive-form.tsx",
    label: "Transfer receive form — must mint + send idempotencyKey on input object",
    markers: [
      "mintIdempotencyKey",
      "idempotencyKeyRef",
      "idempotencyKey: idempotencyKeyRef.current",
    ],
  },
  {
    file: "src/app/(app)/transfers/[id]/ship-transfer-button.tsx",
    label: "Transfer ship button — must mint + send idempotencyKey as second-arg option",
    markers: [
      "mintIdempotencyKey",
      "idempotencyKeyRef",
      "idempotencyKey: idempotencyKeyRef.current",
    ],
  },
];

describe("withIdempotency — UI callers send a key", () => {
  it("each UI surface mints a stable UUID and passes it to the action", () => {
    const repoRoot = findRepoRoot();
    const violations: string[] = [];

    for (const { file, label, markers } of UI_SURFACES) {
      const abs = path.join(repoRoot, file);
      if (!fs.existsSync(abs)) {
        violations.push(`${file} :: file missing — ${label}`);
        continue;
      }
      const src = fs.readFileSync(abs, "utf8");
      for (const marker of markers) {
        if (!src.includes(marker)) {
          violations.push(`${file} :: marker absent "${marker}" — ${label}`);
        }
      }
    }

    expect(
      violations,
      [
        "",
        "One or more P0-02 rc3 UI surfaces lost their idempotency-key",
        "minting or forwarding. If intentional (e.g. the form was",
        "split), update UI_SURFACES in",
        "src/lib/idempotency/ui-callers.static.test.ts.",
        "",
        "Violations:",
        ...violations.map((v) => `  - ${v}`),
        "",
      ].join("\n"),
    ).toEqual([]);
  });
});
