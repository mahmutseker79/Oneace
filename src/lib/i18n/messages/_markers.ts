// Sprint 33 — TR coverage segment kickoff (foundation).
//
// Stub policy primitives for the message catalog.
//
// Background
// ----------
// Sprint 7 closure achieved namespace-level TR parity (48/48). The
// next coverage tier is *per-key* parity — every leaf string in the
// EN dictionary should be either:
//
//   (a) Translated to TR (the goal), OR
//   (b) Deliberately reused from EN (brand names, technical SKU
//       terms, file extensions, etc.), explicitly tagged so a
//       coverage scanner can distinguish "intentional passthrough"
//       from "TODO translation".
//
// Without (b)'s explicit tag, every `...en.X` spread looks identical
// — a TR user sees the EN string and we can't tell from the source
// whether that was a deliberate UX decision or a forgotten leaf.
//
// `INTENTIONAL_EN` is the marker primitive that makes (b) auditable.
//
// Usage
// -----
// ```ts
// import { en } from "./en";
// import { INTENTIONAL_EN } from "./_markers";
//
// export const tr: Messages = {
//   ...en,
//   nav: {
//     ...en.nav,
//     brand:     INTENTIONAL_EN(en.nav.brand),     // "OneAce"  (brand)
//     dashboard: "Pano",                            // translated
//     scan:      INTENTIONAL_EN(en.nav.scan),      // "Scan"    (technical, kept verbatim)
//   },
// };
// ```
//
// At runtime `INTENTIONAL_EN` is an identity function — there's zero
// behavioural impact. At static-analysis time the `tr-key-parity`
// test counts `INTENTIONAL_EN(` occurrences and subtracts them from
// the "TODO translation" total, so coverage math becomes:
//
//   TODO_TR = (EN leaf keys) − (TR translated keys) − (INTENTIONAL_EN markers)
//
// Sprint 33 ships the primitive only; consumer migrations land in
// Sprints 34–37 per the kickoff brief breakdown.

/**
 * Identity wrapper that semantically marks a value as a deliberate
 * EN passthrough in the TR (or any future locale) message catalog.
 *
 * The wrapper is erased at runtime — `INTENTIONAL_EN(x) === x`. Its
 * job is to give the static-analysis scanner a single, unambiguous
 * grep token (`INTENTIONAL_EN(`) so the per-key parity test can
 * separate "intentional brand/technical passthrough" from "missing
 * translation".
 *
 * Generic over `T` so it preserves the leaf type (string, number,
 * function, nested object) without forcing a cast.
 */
export const INTENTIONAL_EN = <T>(value: T): T => value;

/**
 * String form of the marker name. Pinned tests import this so a
 * future rename (e.g. `INTENTIONAL_EN` → `KEEP_EN`) only needs to
 * touch this file plus the consumer migration — the test grep token
 * follows automatically.
 */
export const INTENTIONAL_EN_MARKER = "INTENTIONAL_EN" as const;
