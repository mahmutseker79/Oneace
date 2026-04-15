# Component Library

Every component from the original ERP master prompt mapped to a concrete
shadcn or NativeWind equivalent, tagged **BUILT**, **MVP**, or **POST-MVP**.

If a component is Built, the file path is shown. If Planned, the target
path is shown so whoever picks it up knows exactly where to put it.

## Platform split

- **Web** uses shadcn-style primitives in `apps/web/src/components/ui/`.
  Radix under the hood where a11y matters, Tailwind v4 for styling.
- **Mobile** uses NativeWind + custom wrappers over `react-native` core
  components in `apps/mobile/src/components/ui/` (not yet built).
- **Shared** components live in a future `@oneace/ui` package if cross-platform
  reuse is justified. For MVP, we duplicate small components rather than
  wrestle with cross-platform abstraction.

## Atoms

| Component          | Web status            | Mobile status | Notes                                   |
| ------------------ | --------------------- | ------------- | --------------------------------------- |
| Button             | **BUILT** `ui/button.tsx` | MVP       | `cva` variants: default/destructive/outline/secondary/ghost/link |
| Icon button        | **BUILT** (size=icon) | MVP           | Button size variant                     |
| Text input         | **BUILT** `ui/input.tsx` | MVP        | Standard `<input>` styling              |
| Textarea           | MVP                   | MVP           | Multi-line version of Input             |
| Dropdown (select)  | Native `<select>`     | MVP           | Upgrade to Radix Select post-MVP        |
| Combobox           | POST-MVP              | POST-MVP      | For searchable item/location pickers    |
| Checkbox           | Native `<input>`      | MVP           | Upgrade to Radix post-MVP               |
| Radio group        | POST-MVP              | POST-MVP      | Rare in current flows                   |
| Switch             | POST-MVP              | POST-MVP      | For settings page                       |
| Segmented control  | POST-MVP              | MVP           | Mobile-only: count detail tabs          |
| Tabs               | MVP                   | POST-MVP      | For settings + analytics                |
| Chip               | MVP                   | MVP           | Filter chips, selected tags             |
| Badge (pill)       | **BUILT** `_components/state-badge.tsx` | MVP | StateBadge + VarianceBadge       |
| Avatar             | POST-MVP              | POST-MVP      | Member list, comment threads            |
| Divider            | Implicit via border   | Implicit      | Not a dedicated component               |
| Helper text        | Implicit `<p>`        | Implicit      | Spec says: use `text.muted`, `caption`  |
| Validation text    | Implicit              | Implicit      | Use `text.destructive`, `caption`       |
| Counter            | POST-MVP              | POST-MVP      | For cart-like quantity stepper          |
| Breadcrumb         | POST-MVP              | —             | Web only                                |
| Progress indicator | MVP                   | MVP           | Spinner + linear progress               |

## Molecules

| Component              | Status   | Location                      | Notes                                   |
| ---------------------- | -------- | ----------------------------- | --------------------------------------- |
| StatusBadge            | **BUILT**| `_components/state-badge.tsx` | Count lifecycle                         |
| VarianceBadge          | **BUILT**| `_components/state-badge.tsx` | match / tolerance / over / under        |
| StockLevelBar          | POST-MVP | `ui/stock-level-bar.tsx`      | Horizontal fill based on on-hand vs max |
| StockLevelDot          | POST-MVP | `ui/stock-level-dot.tsx`      | Single dot variant for dense lists      |
| QuantityStepper        | MVP      | `ui/quantity-stepper.tsx`     | Mobile count entry                      |
| SyncStatusWidget       | MVP      | `ui/sync-status.tsx`          | Top-bar indicator for online/offline    |
| EmptyState             | MVP      | `ui/empty-state.tsx`          | Icon + headline + description + CTA     |
| ErrorState             | MVP      | `ui/error-state.tsx`          | Destructive variant                     |
| LoadingState           | MVP      | `ui/loading-state.tsx`        | Spinner + message                       |
| OfflineBanner          | MVP      | `ui/offline-banner.tsx`       | Persistent top-of-viewport bar          |
| FilterChip             | POST-MVP | `ui/filter-chip.tsx`          | Tappable, with clear affordance         |
| FilterChipBar          | POST-MVP | `ui/filter-chip-bar.tsx`      | Horizontal scroll on mobile             |
| SortDropdown           | POST-MVP | `ui/sort-dropdown.tsx`        | For table headers                       |
| TagChip                | POST-MVP | `ui/tag-chip.tsx`             | Item tags                               |
| PhotoThumbnail         | POST-MVP | `ui/photo-thumb.tsx`          | Item photos                             |
| RelativeTimeText       | MVP      | `ui/relative-time.tsx`        | "3 min ago"                             |
| UnitOfMeasureTag       | POST-MVP | `ui/uom-tag.tsx`              | "12 ea", "3.5 kg"                       |
| SearchBar              | MVP      | `ui/search-bar.tsx`           | Input + magnifier icon (exists inline)  |
| SearchSuggestionsList  | POST-MVP | `ui/search-suggestions.tsx`   | Global search flyout                    |
| ActiveFilterBadge      | POST-MVP | `ui/active-filter.tsx`        | Shows applied filter on list            |
| Snackbar               | MVP      | `ui/snackbar.tsx`             | Success / error / info / undo           |
| Confirmation row       | POST-MVP | `ui/confirm-row.tsx`          | For destructive inline actions          |
| Inline note field      | MVP      | Part of Input                 | Count entry note input                  |
| Date range summary     | POST-MVP | `ui/date-range.tsx`           | Reports                                 |
| Bulk selection summary | POST-MVP | `ui/bulk-selection.tsx`       | "3 selected" with action buttons        |

## Organisms

| Component                 | Status    | Location                             | Notes                                   |
| ------------------------- | --------- | ------------------------------------ | --------------------------------------- |
| App bar (top bar)         | **BUILT** | `components/top-bar.tsx`             | Org switcher + sign out                 |
| Bottom nav                | MVP       | Mobile only                          | Items / Workflows / Scan / Reports / Menu|
| Navigation rail           | POST-MVP  | Tablet landscape only                | Collapsible                             |
| Navigation drawer         | MVP       | Mobile                               | Pushed from hamburger                   |
| Sidebar                   | **BUILT** | `components/sidebar.tsx`             | Web desktop primary nav                 |
| Card                      | **BUILT** | `ui/card.tsx`                        | Shadcn card with Header/Content/Footer  |
| Table                     | **BUILT** | `ui/table.tsx`                       | Shadcn table primitives                 |
| Dialog                    | **BUILT** | `ui/dialog.tsx`                      | Radix dialog                            |
| Workflow grid             | POST-MVP  | —                                    | Mobile home: tiles of count/scan/etc    |
| Filter bottom sheet       | POST-MVP  | Mobile-only                          | Swipe up on list                        |
| Filter side panel         | POST-MVP  | Tablet/desktop                       | Persistent right-side                   |
| Dense data table          | POST-MVP  | `ui/dense-table.tsx`                 | Compact-density variant                 |
| Selection app bar         | POST-MVP  | Part of top-bar                      | When rows selected                      |
| Count entry module        | MVP       | Inlined in `[id]/page.tsx`           | Will extract if reused on mobile        |
| Scanner bottom panel      | MVP       | Mobile only                          | Result feedback + quick actions         |
| Variance action bar       | MVP       | Inlined in reconcile page            | Summary tiles + post-CTA                |
| Dashboard widget wrapper  | POST-MVP  | `ui/dashboard-widget.tsx`            | KPI tile with title + value             |
| Report filter panel       | POST-MVP  | —                                    | Post-MVP with reports v2                |
| Permission matrix         | POST-MVP  | —                                    | Admin → roles screen                    |
| Rule builder block        | POST-MVP  | —                                    | Automation                              |
| Label designer layout     | POST-MVP  | —                                    | Label printing                          |
| Conflict resolution panel | POST-MVP  | —                                    | Offline sync center                     |
| Export dialog             | MVP       | `ui/export-dialog.tsx`               | CSV export from reports                 |
| Split-view shell          | POST-MVP  | Tablet landscape                     | Master-detail                           |

## Component states checklist

Every Built or MVP component must define these states. Missing states = not
shippable. Use this as the PR review checklist.

- Default
- Hover (web only)
- Focus (visible ring)
- Pressed / Active
- Disabled
- Selected (where applicable)
- Loading (where async)
- Success (where stateful)
- Error (where fallible)
- Empty (where list-like)

## Variant matrix example — Button

For reference. Any new atom follows the same shape.

| Variant / Size | sm | md | lg | icon |
| -------------- | -- | -- | -- | ---- |
| default        | ✓  | ✓  | ✓  | ✓    |
| destructive    | ✓  | ✓  | ✓  | ✓    |
| outline        | ✓  | ✓  | ✓  | ✓    |
| secondary      | ✓  | ✓  | ✓  | ✓    |
| ghost          | ✓  | ✓  | ✓  | ✓    |
| link           | ✓  | ✓  | ✓  | —    |

All variants implement the state checklist above. Focus ring is
`border-2 border-ring.focus` regardless of variant.

## Density variants

Tables and list rows support `density="comfortable" | "compact"`. Compact is
only used on reports, admin lists, and dense item catalogs. Mobile is always
comfortable.

| Prop value      | Row py | Row min-h | Text              |
| --------------- | ------ | --------- | ----------------- |
| `comfortable`   | 12px   | 48px      | `body`            |
| `compact`       | 4px    | 32px      | `label`           |

## Naming convention

- Atoms: `Button`, `Input`, `Badge`.
- Molecules: `StateBadge`, `SyncStatusWidget`.
- Organisms: `TopBar`, `Sidebar`, `CountEntryForm`.
- Kebab-case file names: `state-badge.tsx`, not `StateBadge.tsx`.
- Every exported component has an `interface ComponentNameProps`.

## Accessibility rules

- All interactive components announce state via `aria-*` attributes.
- Focus ring is never suppressed via `outline: none` without replacement.
- Labels use `htmlFor`/`id` pairs (`<Label htmlFor="x"><Input id="x"/>`).
- Icon-only buttons carry `aria-label`.
- Dialogs trap focus (Radix handles this).
