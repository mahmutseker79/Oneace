# Principles & Stack

## Why these principles matter

OneAce will be used by warehouse operators under time pressure, by inventory
controllers who live in dense tables, and by supervisors who make decisions in
30 seconds. Every design choice should be judged against the principles below.
If a pattern fails the principles, it's wrong — even if it's pretty.

## Core UX principles

1. **Speed over decoration.** Operational tools are used in minutes, not admired
   in hours. Every millisecond of animation, every hover reveal, every extra
   tap is a tax.
2. **Low cognitive load under pressure.** Users will open the app while holding
   a barcode scanner, wearing gloves, in bad light, tired. The UI must be
   legible at arm's length and operable with one thumb.
3. **ERP depth with consumer-grade clarity.** We serve serious workflows but
   refuse to look like Oracle 1998. The look is calm, structured, modern,
   without any of the decorative tricks (glassmorphism, pastel gradients,
   emoji) that make consumer apps feel like toys.
4. **Mobile for action, tablet + desktop for control.** Mobile is the scanner
   extension: count, scan, record. Tablet and desktop are for review, approve,
   configure. A responsive stretch of the mobile app is a failure.
5. **Frequent workflows ≤ 3 taps.** From any entry point, the five most
   frequent actions — "start count", "scan an item", "see low stock", "post
   an adjustment", "see movement history" — must be reachable in at most three
   taps.
6. **Color is never the only signal.** A colorblind counter has to see that a
   row is a variance, not just that it is orange. Always pair color with icon,
   text, or weight.
7. **Offline state is always visible.** The sync indicator is the cheapest
   insurance against "I made 200 edits and they vanished". Show it in every
   shell.
8. **Every important page has loading, empty, error, partial, offline, and
   permission-denied states.** No dead ends. No "white screen" crashes. No
   "stuck loading forever".
9. **Every menu entry opens a real page.** If a nav item can't be built for
   MVP, remove it from the nav for MVP. Don't ship hamburger-menu graveyards.
10. **Every workflow has five states:** entry, active, exception, completion,
    follow-up. If one of the five is missing, the workflow isn't shippable.
11. **Every onboarding step connects to real product usage.** No fake success
    screens, no "setup complete" dead-ends. The last click of any onboarding
    step should drop the user into the place where they actually do work.
12. **Designs must be realistic for shadcn/NativeWind.** We don't invent new
    primitives when shadcn or Tailwind already ship them. Custom components
    are justified by measured need, not by designer taste.

## Stack translation (from the Flutter M3 master prompt)

The original prompt was written for a Flutter Material 3 product. OneAce is
Next.js + Expo. Every Flutter-specific assumption is translated below.

### Platform

| Prompt                          | OneAce                                              |
| ------------------------------- | --------------------------------------------------- |
| Flutter Material 3              | Next.js 15 App Router (web) + Expo SDK 52 (mobile)  |
| Dart + Material widgets         | TypeScript + React 19 + shadcn-flavored primitives  |
| Dart domain in `lib/`           | `@oneace/core` (pure TS, framework-agnostic)        |
| NavigationRail, NavigationDrawer| Sidebar (web) + Drawer / Bottom tab (mobile)        |
| Scaffold + AppBar               | Dashboard layout shell (`apps/web/src/app/(dashboard)`)|
| SafeArea                        | `safe-area-inset-*` env in NativeWind + layout.tsx  |
| GoRouter                        | Next App Router + Expo Router                       |
| Provider / Riverpod             | React Query + tRPC hooks, local `useState`          |

### Styling

| Prompt              | OneAce                                                    |
| ------------------- | --------------------------------------------------------- |
| Material tokens     | Tailwind v4 `@theme` CSS variables                        |
| Material typography | Inter family, Tailwind `text-*` classes                   |
| Material elevation  | Tailwind `shadow-*`, used sparingly (see token list)      |
| Material ripple     | Not adopted — we use subtle hover/focus rings instead     |
| Density (comfortable/compact)| Tailwind class variants — `py-2` standard, `py-1` compact|

### Motion

| Prompt                     | OneAce                                     |
| -------------------------- | ------------------------------------------ |
| Material motion curves     | `tailwindcss-animate` + Radix transitions  |
| Hero transitions           | Not used — they slow perceived responsiveness|
| Implicit animations        | Limited to state feedback (success pulse, error shake)|

### Breakpoints

| Name       | Width       | Context                              |
| ---------- | ----------- | ------------------------------------ |
| mobile     | 0–639       | Single column, bottom nav, full screen sheets |
| tablet-p   | 640–1023    | Two-column where useful, drawer nav  |
| tablet-l   | 1024–1279   | Split master-detail, persistent sidebar |
| desktop    | 1280+       | Full shell, multi-panel              |

These map to Tailwind's default `sm / md / lg / xl` breakpoints with `lg` as
the tablet-landscape snap.

### Density

Two density modes, driven by a single context value:

- **Comfortable** — default. `py-2` on rows, 44px min touch target, comfortable
  text sizing. Used everywhere a finger will touch.
- **Compact** — explicit opt-in for dense tables (reports, admin lists, item
  catalogs). `py-1`, 32px row height, `text-xs`. Never used where the user
  needs to tap.

Density is a component variant, not a theme. The same button can appear at
both densities in different parts of the product.

## Anti-patterns we reject

- **Glassmorphism blur panels.** Hurts contrast, hurts dark mode, adds GPU cost.
- **Pastel gradients on primary surfaces.** Looks like a consumer fintech ad.
- **Emoji in UI.** Pretty, but they break across platforms and read as toy-like.
- **Infinite scroll on lists that matter for audit.** Counts, movements,
  orders — all paginated, all show totals.
- **Hover-only affordances.** Touch has no hover. Affordances must be visible
  at rest.
- **Modals for long forms.** Anything over 3 fields is a page, not a modal.
- **Icon-only buttons without labels.** Only allowed in dense toolbars, and
  only after a usability test.

## Anti-patterns we allow (with caveats)

- **Dense tables with sticky headers/columns.** Ugly on mobile, essential on
  desktop. Use the `compact` density variant.
- **Bottom sheets on mobile.** Good for filters, bad for forms. Keep to a
  single scrollable region.
- **Right-side inspector panels on desktop.** Powerful but eat screen width —
  always collapsible.
