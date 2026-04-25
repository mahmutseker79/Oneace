// Sprint 14 PR #3 — EmptyState bare story + remaining inline-pattern audit
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// Sprint 12 PR #1 EmptyState primitive'e `bare` prop eklemişti ama Storybook
// story'si yoktu. Sprint 14 PR #3 onu ekler + kalan inline empty pattern'leri
// informational olarak audit eder (gelecek pack'ler için backlog).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(REPO_ROOT, "src/app");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

// Yasak/şüpheli pattern (informational): inline "no data" Card+CardContent+p.
// Sprint 11/12/13/14 boyunca ~40+ surface migrate edildi; kalanları flag.
const SUSPICIOUS_INLINE_EMPTY = /<CardContent[^>]*py-(?:6|8|10|12)[^>]*>[\s\S]{0,200}<p[^>]*text-(?:center|sm)[^>]*text-muted-foreground[^>]*>\s*No\s/;

describe("Sprint 14 PR #3 §B-7 — EmptyState bare story + inline audit", () => {
  describe("empty-state.stories.tsx", () => {
    const src = read("src/components/ui/empty-state.stories.tsx");

    it("exports a `Bare` story", () => {
      expect(src).toContain("export const Bare: Story");
    });

    it("Bare story sets `bare: true`", () => {
      expect(src).toMatch(/Bare:\s*Story\s*=\s*\{[\s\S]{0,400}bare:\s*true/);
    });

    it("Bare story has docs.description.story explanation", () => {
      expect(src).toContain('docs:');
      expect(src).toContain('panel-içi');
    });
  });

  describe("informational audit (gelecek pack backlog)", () => {
    it("logs remaining inline empty patterns (soft-fail, threshold not zero)", () => {
      const offenders: string[] = [];
      for (const file of walk(APP_DIR)) {
        const content = readFileSync(file, "utf8");
        if (SUSPICIOUS_INLINE_EMPTY.test(content)) {
          const rel = file.replace(`${REPO_ROOT}/`, "");
          offenders.push(rel);
        }
      }
      if (offenders.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[empty-state-inline-audit] ${offenders.length} files still use inline empty pattern (Sprint 15+ backlog):\n  ` +
            offenders.join("\n  "),
        );
      }
      // Soft-fail: report only. Sprint 14 sonrası 5 ya da daha az kalmış olmalı.
      expect(offenders.length).toBeLessThanOrEqual(10);
    });
  });
});
