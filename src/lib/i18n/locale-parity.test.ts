// P2-1 (audit v1.1 §5.23) — locale parity guard.
//
// Pre-remediation state: `SUPPORTED_LOCALES` declared 8 codes
// (en/es/de/fr/pt/it/nl/ar) but only `messages/en.ts` existed; the
// other 7 were silently aliased to `en` in the catalog. That let
// the README claim multilingual support while the product served
// English to everyone.
//
// Honest-scaffold fix: `SUPPORTED_LOCALES` contains only the codes
// whose messages file actually exists. This test pins that invariant
// so the next person adding a locale can't half-ship it — adding an
// entry to `SUPPORTED_LOCALES` without landing the matching
// `messages/<code>.ts` file will fail CI here, and vice versa.
//
// Intentionally a static-analysis test (readFileSync + fs checks) to
// avoid booting the app runtime for a config invariant.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CONFIG_SRC = readFileSync(
  resolve(__dirname, "config.ts"),
  "utf8",
);
const INDEX_SRC = readFileSync(
  resolve(__dirname, "index.ts"),
  "utf8",
);
const MESSAGES_DIR = resolve(__dirname, "messages");

function extractSupportedLocales(): string[] {
  // Grab the `SUPPORTED_LOCALES = [ ... ] as const;` block.
  const match = CONFIG_SRC.match(
    /SUPPORTED_LOCALES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/,
  );
  expect(match, "SUPPORTED_LOCALES must be a `[...] as const` literal").not.toBeNull();
  const body = match?.[1] ?? "";
  // Accept both single and double quotes; strip trailing commas and inline comments.
  return Array.from(body.matchAll(/["']([a-z]{2,3}(?:-[A-Za-z0-9]+)?)["']/g)).map(
    (m) => m[1] as string,
  );
}

describe("P2-1 §5.23 — i18n locale parity (honest scaffold)", () => {
  it("SUPPORTED_LOCALES parses to a non-empty, en-leading list", () => {
    const locales = extractSupportedLocales();
    expect(locales.length).toBeGreaterThan(0);
    expect(locales[0]).toBe("en");
  });

  it("every declared locale has a matching messages/<code>.ts file", () => {
    // The load-bearing assertion. A future PR that adds "de" to
    // SUPPORTED_LOCALES without dropping `messages/de.ts` into place
    // fails here — no more silent `de → en` aliases in the catalog.
    const locales = extractSupportedLocales();
    const missing = locales.filter(
      (code) => !existsSync(resolve(MESSAGES_DIR, `${code}.ts`)),
    );
    expect(missing, `missing messages files for: ${missing.join(", ")}`).toEqual([]);
  });

  it("every messages/<code>.ts is declared in SUPPORTED_LOCALES", () => {
    // Symmetric guard: a stray `messages/fr.ts` that nobody wired up
    // is also drift. Either declare it in SUPPORTED_LOCALES + the
    // catalog, or delete the file.
    const locales = new Set(extractSupportedLocales());
    const orphanFiles = readdirSync(MESSAGES_DIR)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => f.replace(/\.ts$/, ""))
      .filter((code) => !locales.has(code));
    expect(
      orphanFiles,
      `messages files without a SUPPORTED_LOCALES entry: ${orphanFiles.join(", ")}`,
    ).toEqual([]);
  });

  it("catalog in index.ts registers exactly the declared locales", () => {
    // Prior to the honest-scaffold fix, the catalog listed `es: en,
    // de: en, fr: en, ...` as placeholder aliases. That pattern is
    // exactly what produced the silent fallback drift; if it ever
    // comes back, this test fires. We look for any `<code>: en,`
    // pair inside the catalog object where <code> is NOT in
    // SUPPORTED_LOCALES.
    const locales = new Set(extractSupportedLocales());
    const catalogMatch = INDEX_SRC.match(
      /const\s+catalog\s*:\s*Record<Locale,\s*Messages>\s*=\s*\{([\s\S]*?)\};/,
    );
    expect(catalogMatch, "catalog literal must exist in index.ts").not.toBeNull();
    const body = catalogMatch?.[1] ?? "";
    // Matches both shorthand (`en,` / `en\n}`) and explicit
    // (`en: foo,`) property syntax.
    const keys = Array.from(
      body.matchAll(/(?:^|[\s,{])([a-z]{2,3})\s*(?::|[,}\n])/g),
    ).map((m) => m[1] as string);
    // Every key in the catalog must be a declared locale.
    const unexpected = keys.filter((k) => !locales.has(k));
    expect(
      unexpected,
      `catalog has unexpected keys: ${unexpected.join(", ")}`,
    ).toEqual([]);
    // And every declared locale must be present as a catalog key.
    const missing = [...locales].filter((k) => !keys.includes(k));
    expect(
      missing,
      `catalog is missing keys for: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("RTL_LOCALES is typed as string[] so future RTL codes can sit outside Locale", () => {
    // We widen RTL_LOCALES to `readonly string[]` on purpose — it
    // lets us keep `ar`/`he`/`fa`/`ur` listed as known RTL codes
    // even before their messages file lands. If someone re-narrows
    // the type to `readonly Locale[]`, the honest-scaffold gets
    // awkward again (every RTL code would have to be a shipped
    // locale), so pin the declared type.
    expect(CONFIG_SRC).toMatch(
      /RTL_LOCALES\s*:\s*readonly\s+string\[\]\s*=/,
    );
  });

  it("README does not claim '8 locales scaffolded' anymore", () => {
    // Product-claim vs reality guard. The drift that motivated this
    // remediation was a README line that promised 8 languages. If
    // that phrase creeps back in without 8 real messages files, we
    // want CI to fire before marketing sees it.
    const readme = readFileSync(
      resolve(__dirname, "..", "..", "..", "README.md"),
      "utf8",
    );
    expect(readme).not.toMatch(/8 locales scaffolded/i);
    expect(readme).not.toMatch(/8 languages scaffolded/i);
  });
});
