# OneAce — Design Spec

This directory holds the **implementation-ready design specification** for the OneAce
multi-tenant inventory SaaS. It is *not* a Figma file. It is a structured set of
Markdown + JSON documents that developers, PMs, and future designers can use as
the single source of truth for what the product looks like, how it behaves, and
what ships when.

## Provenance

The spec was derived from an ERP-wide master prompt targeting a Flutter Material 3
product. That prompt has been **translated to the OneAce stack** (Next.js 15 on the
web, Expo SDK 52 + NativeWind on mobile, shared `@oneace/core` domain logic) and
**scope-trimmed to the MVP cutline** (target: 2026-07-03). The full ERP parity
surface is captured in `10-mvp-cutline.md` as Post-MVP backlog so nothing is lost,
but MVP is deliberately narrower.

## Stack adaptation

| Prompt assumption     | OneAce reality                                  |
| --------------------- | ----------------------------------------------- |
| Flutter Material 3    | Next.js 15 (web) + Expo / NativeWind (mobile)   |
| Material tokens       | Tailwind v4 `@theme` CSS variables              |
| Dart widget library   | shadcn-flavored primitives + NativeWind         |
| Flutter navigation    | Next App Router + Expo Router                   |
| Shared Dart domain    | `@oneace/core` TypeScript package               |
| Supabase+Drizzle back | Same — already wired in `@oneace/api` (tRPC v11)|

Everywhere the original prompt said "Material 3", read "shadcn/NativeWind tokens
and variants". Typography defaults to **Inter** (same as the prompt). Breakpoints
are Tailwind defaults (`sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`) with an
explicit tablet-portrait snap at `md` and tablet-landscape at `lg`.

## How to navigate

1. Start with [`10-mvp-cutline.md`](./10-mvp-cutline.md) — what ships vs what waits.
2. Read [`01-principles-and-stack.md`](./01-principles-and-stack.md) to align on core UX rules.
3. Use [`02-design-tokens.md`](./02-design-tokens.md) + [`tokens.json`](./tokens.json)
   as the source of truth for color/spacing/type. Both web and mobile consume
   this file.
4. For the **stock counting moat**, go straight to [`06-stock-counting.md`](./06-stock-counting.md).
5. [`03-component-library.md`](./03-component-library.md) maps every component from
   the prompt to a concrete build status: **Built**, **Planned for MVP**, or
   **Post-MVP**.

## File map

| File                                    | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `README.md`                             | This file — navigation + provenance.                   |
| `01-principles-and-stack.md`            | Core UX principles + Flutter→OneAce translation.       |
| `02-design-tokens.md`                   | Semantic tokens + Tailwind v4 mapping.                 |
| `tokens.json`                           | Machine-readable token export, consumed by both apps.  |
| `03-component-library.md`               | Atom/molecule/organism catalog with build status.      |
| `04-information-architecture.md`        | Navigation, IA, global search, role visibility.        |
| `05-onboarding-activation.md`           | Auth, wizards, empty-start, first-run experiences.     |
| `06-stock-counting.md`                  | The moat. Full state machine + screen spec.            |
| `07-scanner-and-offline.md`             | Scanner UX + sync/conflict patterns.                   |
| `08-inventory-and-operations.md`        | Items, categories, PO, receiving, pick lists, adjust.  |
| `09-role-based-access.md`               | Permission matrix aligned to `PERMISSION_KEYS`.        |
| `10-mvp-cutline.md`                     | MVP vs Post-MVP split with rationale.                  |

## Status legend

Every component, screen, and flow in this spec is tagged with one of:

- **BUILT** — already implemented in `apps/web` as of 2026-04-10.
- **MVP** — must exist in `apps/web` or `apps/mobile` by 2026-07-03.
- **POST-MVP** — deferred, tracked in `10-mvp-cutline.md`.
