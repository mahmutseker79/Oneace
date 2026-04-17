# Hybrid UI/UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework OneAce's shell, dashboard, items, scan, and stock counts experience so the product is easier to learn, more task-driven, and balanced for both operations and management users.

**Architecture:** Keep the existing Next.js App Router structure, but move the experience from feature-first navigation to task-first navigation. Reuse the current server-component data loading model, add a few focused UI primitives, and progressively enhance high-frequency screens instead of rewriting whole domains.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Prisma, Vitest, Playwright.

---

## File Structure Map

### Shell and navigation
- Modify: `src/components/shell/sidebar.tsx`
- Modify: `src/components/shell/mobile-nav.tsx`
- Modify: `src/components/shell/header.tsx`
- Modify: `src/components/shell/app-shell-client.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/components/shell/mobile-tab-bar.tsx`
- Create: `src/components/shell/primary-nav.tsx`

### Dashboard
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/dashboard/loading.tsx`
- Create: `src/components/dashboard/today-hero.tsx`
- Create: `src/components/dashboard/priority-tasks-grid.tsx`
- Create: `src/components/dashboard/quick-actions-strip.tsx`
- Create: `src/components/dashboard/in-progress-panel.tsx`
- Create: `src/components/dashboard/exceptions-panel.tsx`
- Create: `src/components/dashboard/kpi-summary-row.tsx`

### Items
- Modify: `src/app/(app)/items/page.tsx`
- Modify: `src/app/(app)/items/items-table.tsx`
- Create: `src/components/items/saved-view-tabs.tsx`
- Create: `src/components/items/items-toolbar.tsx`
- Create: `src/components/items/item-quick-preview-panel.tsx`

### Scan
- Modify: `src/app/(app)/scan/page.tsx`
- Modify: `src/app/(app)/scan/scanner.tsx`
- Modify: `src/components/scanner/quick-add-sheet.tsx`
- Create: `src/components/scanner/scan-result-card.tsx`
- Create: `src/components/scanner/scan-action-cluster.tsx`
- Create: `src/components/scanner/recent-scans-list.tsx`

### Stock counts
- Modify: `src/app/(app)/stock-counts/page.tsx`
- Modify: `src/app/(app)/stock-counts/[id]/page.tsx`
- Create: `src/components/stock-counts/counts-status-tabs.tsx`
- Create: `src/components/stock-counts/count-lifecycle-stepper.tsx`
- Create: `src/components/stock-counts/count-summary-cards.tsx`
- Create: `src/components/stock-counts/count-action-rail.tsx`

### Shared UI and tests
- Create: `src/components/ui/section-header.tsx`
- Create: `src/components/ui/status-badge.tsx`
- Modify: `src/app/globals.css`
- Modify: `e2e/dashboard.spec.ts`
- Modify: `e2e/items.spec.ts`
- Modify: `e2e/scanner.spec.ts`
- Modify: `e2e/stock-counts.spec.ts`

---

### Task 1: Reframe the shell around task-first navigation

**Files:**
- Create: `src/components/shell/primary-nav.tsx`
- Create: `src/components/shell/mobile-tab-bar.tsx`
- Modify: `src/components/shell/sidebar.tsx`
- Modify: `src/components/shell/mobile-nav.tsx`
- Modify: `src/components/shell/header.tsx`
- Modify: `src/components/shell/app-shell-client.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Test: `e2e/dashboard.spec.ts`

- [ ] **Step 1: Add a small navigation model so desktop and mobile use the same information architecture**

```ts
export type NavGroupKey = "today" | "inventory" | "operations" | "insights" | "management";

export type NavLeaf = {
  label: string;
  href: `/${string}`;
  match: `/${string}`[];
};

export type NavGroup = {
  key: NavGroupKey;
  label: string;
  leaves: NavLeaf[];
};
```

- [ ] **Step 2: Implement `PrimaryNav` with the five top-level groups**

```tsx
const groups: NavGroup[] = [
  { key: "today", label: "Bugun", leaves: [{ label: "Genel Bakis", href: "/dashboard", match: ["/dashboard"] }] },
  { key: "inventory", label: "Stok", leaves: [...] },
  { key: "operations", label: "Operasyon", leaves: [...] },
  { key: "insights", label: "Icgoruler", leaves: [...] },
  { key: "management", label: "Yonetim", leaves: [...] },
];
```

- [ ] **Step 3: Replace the current sidebar's ad-hoc grouping with the shared nav model**

```tsx
<PrimaryNav
  pathname={pathname}
  labels={labels}
  lowStockBadge={labels.badges?.items}
  showAdmin={labels.showAdmin}
/>
```

- [ ] **Step 4: Add a mobile bottom tab bar for high-frequency actions**

```tsx
const tabs = [
  { label: "Bugun", href: "/dashboard", icon: Home },
  { label: "Tara", href: "/scan", icon: ScanLine },
  { label: "Sayim", href: "/stock-counts", icon: ClipboardList },
  { label: "Stok", href: "/items", icon: Package },
  { label: "Menu", action: onMenuClick, icon: Menu },
];
```

- [ ] **Step 5: Update the shell client so the header opens mobile menu and renders the new mobile tab bar**

```tsx
<Header ... onMenuClick={() => setMobileNavOpen(true)} />
<MobileNav ... />
<MobileTabBar onMenuClick={() => setMobileNavOpen(true)} />
```

- [ ] **Step 6: Tighten the header search presentation so it reads like command access, not a passive field**

```tsx
<Input className="border-border/50 bg-muted/50 pl-9 pr-16 rounded-xl" />
<kbd className="...">⌘K</kbd>
```

- [ ] **Step 7: Run the dashboard E2E smoke test to confirm the shell still loads**

Run: `pnpm test:e2e e2e/dashboard.spec.ts`
Expected: Dashboard loads, the sidebar still navigates, and the mobile drawer opens without layout regressions.

- [ ] **Step 8: Commit shell changes**

```bash
git add src/components/shell src/app/'(app)'/layout.tsx e2e/dashboard.spec.ts
git commit -m "feat: simplify app navigation around task-first groups"
```

### Task 2: Convert the dashboard into a Today-first home screen

**Files:**
- Create: `src/components/dashboard/today-hero.tsx`
- Create: `src/components/dashboard/priority-tasks-grid.tsx`
- Create: `src/components/dashboard/quick-actions-strip.tsx`
- Create: `src/components/dashboard/in-progress-panel.tsx`
- Create: `src/components/dashboard/exceptions-panel.tsx`
- Create: `src/components/dashboard/kpi-summary-row.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/dashboard/loading.tsx`
- Test: `e2e/dashboard.spec.ts`

- [ ] **Step 1: Add presentational components for the new dashboard sections**

```tsx
export function TodayHero({ title, description, actions }: Props) {
  return (
    <section className="space-y-3">
      <SectionHeader title={title} description={description} actions={actions} />
    </section>
  );
}
```

- [ ] **Step 2: Compute priority tasks from existing dashboard data instead of adding new schema**

```ts
const priorityTasks = [
  { label: "Kritik stok", value: lowStockItems.length, href: "/reports/low-stock" },
  { label: "Acik sayimlar", value: openCountCount + inProgressCountCount, href: "/stock-counts" },
  { label: "Teslim alinacak satin alma", value: pendingPurchaseOrders, href: "/purchase-orders" },
];
```

- [ ] **Step 3: Reorder the dashboard page so action sections render before KPI and charts**

```tsx
<div className="space-y-6">
  <TodayHero ... />
  <PriorityTasksGrid tasks={priorityTasks} />
  <QuickActionsStrip actions={quickActions} />
  <InProgressPanel items={inProgressWork} />
  <KpiSummaryRow metrics={kpis} />
  <ExceptionsPanel items={exceptions} />
  <div className="grid gap-6 xl:grid-cols-3">...</div>
</div>
```

- [ ] **Step 4: Reduce chart prominence by limiting above-the-fold charts to the most useful three**

```tsx
<LazyLowStockTrendChart data={lowStockTrendData} />
<LazyTrendChart data={trendData} />
<LazyCategoryValueChart data={categoryValueData.slice(0, 6)} />
```

- [ ] **Step 5: Update the dashboard loading skeleton to match the new hierarchy**

```tsx
<div className="space-y-6">
  <Skeleton className="h-24 w-full rounded-2xl" />
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">...</div>
</div>
```

- [ ] **Step 6: Verify dashboard rendering and interaction**

Run: `pnpm test:e2e e2e/dashboard.spec.ts`
Expected: Today block appears first, quick actions are visible, and chart rendering still succeeds.

- [ ] **Step 7: Commit dashboard changes**

```bash
git add src/components/dashboard src/app/'(app)'/dashboard e2e/dashboard.spec.ts
git commit -m "feat: make dashboard today-first"
```

### Task 3: Make the items page easier to scan and act on

**Files:**
- Create: `src/components/items/saved-view-tabs.tsx`
- Create: `src/components/items/items-toolbar.tsx`
- Create: `src/components/items/item-quick-preview-panel.tsx`
- Modify: `src/app/(app)/items/page.tsx`
- Modify: `src/app/(app)/items/items-table.tsx`
- Test: `e2e/items.spec.ts`

- [ ] **Step 1: Add saved-view tabs so the user starts from meaningful presets**

```tsx
const views = [
  { key: "all", label: "Tumu" },
  { key: "critical", label: "Kritik Stok" },
  { key: "reorder", label: "Yeniden Siparis" },
  { key: "recent", label: "Son Guncellenen" },
];
```

- [ ] **Step 2: Introduce a toolbar wrapper so search, filters, and columns read as one unit**

```tsx
<ItemsToolbar>
  <Input name="q" placeholder={t.items.searchPlaceholder} />
  <Button variant="outline">Filtreler</Button>
  <Button variant="outline">Sutunlar</Button>
</ItemsToolbar>
```

- [ ] **Step 3: Extend the server page to derive each saved view from existing item data**

```ts
const criticalItems = displayedItems.filter((item) => item.onHand <= item.reorderPoint);
const activeView = params.view ?? "all";
const rows = selectViewRows(activeView, displayedItems, criticalItems);
```

- [ ] **Step 4: Simplify the default table by keeping only the fields needed for first-pass decisions**

```tsx
<TableHead>Urun</TableHead>
<TableHead>SKU</TableHead>
<TableHead>Depo ozeti</TableHead>
<TableHead className="text-right">Mevcut stok</TableHead>
<TableHead>Durum</TableHead>
<TableHead>Son hareket</TableHead>
```

- [ ] **Step 5: Add a quick preview panel trigger without removing deep-detail pages**

```tsx
<Button variant="ghost" size="sm" onClick={() => setPreviewItem(item)}>
  <Eye className="h-4 w-4" />
  Onizle
</Button>
```

- [ ] **Step 6: Verify the items workflow in Playwright**

Run: `pnpm test:e2e e2e/items.spec.ts`
Expected: Items page loads, preset views are clickable, and the simplified table still exposes row actions.

- [ ] **Step 7: Commit items changes**

```bash
git add src/components/items src/app/'(app)'/items e2e/items.spec.ts
git commit -m "feat: simplify item browsing with saved views"
```

### Task 4: Turn scan into a focused single-task workstation

**Files:**
- Create: `src/components/scanner/scan-result-card.tsx`
- Create: `src/components/scanner/scan-action-cluster.tsx`
- Create: `src/components/scanner/recent-scans-list.tsx`
- Modify: `src/app/(app)/scan/page.tsx`
- Modify: `src/app/(app)/scan/scanner.tsx`
- Modify: `src/components/scanner/quick-add-sheet.tsx`
- Test: `e2e/scanner.spec.ts`

- [ ] **Step 1: Split the scan result area into dedicated components so the page reads top-to-bottom**

```tsx
<ScanResultCard result={result} labels={labels} />
<ScanActionCluster result={result} labels={labels} />
<RecentScansList entries={history} labels={labels} />
```

- [ ] **Step 2: Restructure the scan page so the camera and result take visual priority**

```tsx
<div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
  <ScannerViewport ... />
  <div className="space-y-4">
    <ScanResultCard ... />
    <ScanActionCluster ... />
    <RecentScansList ... />
  </div>
</div>
```

- [ ] **Step 3: Keep unknown-barcode handling prominent and solution-oriented**

```tsx
{!result?.found ? (
  <Alert>
    <AlertTitle>{labels.resultHeadingNotFound}</AlertTitle>
    <AlertDescription>{labels.resultNotFoundBody}</AlertDescription>
    <div className="flex gap-2">
      <Button onClick={() => setQuickAddBarcode(manualValue)}>Yeni urun olustur</Button>
      <Button variant="outline">Manuel ara</Button>
    </div>
  </Alert>
) : null}
```

- [ ] **Step 4: Move recent scans into a persistent side panel so the user can repeat common actions**

```tsx
history.slice(0, 5).map((entry) => (
  <button key={entry.timestamp} onClick={() => handleLookup(entry.barcode)}>{entry.barcode}</button>
))
```

- [ ] **Step 5: Run the scanner test suite**

Run: `pnpm test:e2e e2e/scanner.spec.ts`
Expected: Scan page renders, manual lookup still works, and quick add remains accessible when no match is found.

- [ ] **Step 6: Commit scan changes**

```bash
git add src/components/scanner src/app/'(app)'/scan e2e/scanner.spec.ts
git commit -m "feat: focus scanner experience on primary actions"
```

### Task 5: Make stock counts feel like a guided workflow instead of a raw list

**Files:**
- Create: `src/components/stock-counts/counts-status-tabs.tsx`
- Create: `src/components/stock-counts/count-lifecycle-stepper.tsx`
- Create: `src/components/stock-counts/count-summary-cards.tsx`
- Create: `src/components/stock-counts/count-action-rail.tsx`
- Modify: `src/app/(app)/stock-counts/page.tsx`
- Modify: `src/app/(app)/stock-counts/[id]/page.tsx`
- Test: `e2e/stock-counts.spec.ts`

- [ ] **Step 1: Add shared stock count UI primitives for status tabs and lifecycle steps**

```tsx
const steps = ["Planla", "Ata", "Say", "Incele", "Onayla"];
<CountLifecycleStepper currentStep={currentStep} steps={steps} />
```

- [ ] **Step 2: Replace the two-card list layout on `/stock-counts` with status tabs and summary counts**

```tsx
<CountsStatusTabs
  tabs={[
    { key: "active", label: "Devam Eden", count: inProgress.length },
    { key: "review", label: "Onay Bekleyen", count: reviewCount },
    { key: "closed", label: "Tamamlanan", count: closed.length },
  ]}
  activeTab={activeTab}
/>
```

- [ ] **Step 3: Add summary cards on the detail page so progress and variance are readable before the tables**

```tsx
<CountSummaryCards
  items={[
    { label: "Kapsam", value: String(scopeRows.length) },
    { label: "Giris", value: String(fullEntries.length) },
    { label: "Fark", value: String(varianceRows.filter((row) => row.status !== "MATCH").length) },
  ]}
/>
```

- [ ] **Step 4: Add an action rail that always tells the user what to do next**

```tsx
<CountActionRail
  canAddEntry={canAddEntry(state)}
  canReconcile={canReconcile(state, varianceRows.length)}
  canCancel={canCancel(state)}
  links={{ addEntry: "#entry-form", approval: `/stock-counts/${count.id}/approval` }}
/>
```

- [ ] **Step 5: Keep the existing tables, but move them below the workflow context so detail pages stop feeling like log dumps**

```tsx
<PageHeader ... />
<CountLifecycleStepper ... />
<CountSummaryCards ... />
<div className="grid gap-6 xl:grid-cols-[1fr_320px]">...</div>
```

- [ ] **Step 6: Run stock count regression tests**

Run: `pnpm test:e2e e2e/stock-counts.spec.ts`
Expected: List page still loads, detail pages still support entry and approval flows, and the new workflow framing does not break navigation.

- [ ] **Step 7: Commit stock count changes**

```bash
git add src/components/stock-counts src/app/'(app)'/stock-counts e2e/stock-counts.spec.ts
git commit -m "feat: guide stock counts with workflow-first UI"
```

### Task 6: Add shared UI primitives and finish with regression coverage

**Files:**
- Create: `src/components/ui/section-header.tsx`
- Create: `src/components/ui/status-badge.tsx`
- Modify: `src/app/globals.css`
- Modify: `e2e/dashboard.spec.ts`
- Modify: `e2e/items.spec.ts`
- Modify: `e2e/scanner.spec.ts`
- Modify: `e2e/stock-counts.spec.ts`

- [ ] **Step 1: Add a reusable section header so the new screens share the same rhythm**

```tsx
export function SectionHeader({ title, description, actions }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
```

- [ ] **Step 2: Add a shared status badge wrapper for consistent tone across task-first screens**

```tsx
const statusVariants = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
};
```

- [ ] **Step 3: Tweak global spacing and surface tokens only where needed for the new hierarchy**

```css
:root {
  --radius: 0.875rem;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(15 23 42 / 0.04);
}
```

- [ ] **Step 4: Run lint, typecheck, unit tests, and targeted E2E as the final gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e e2e/dashboard.spec.ts e2e/items.spec.ts e2e/scanner.spec.ts e2e/stock-counts.spec.ts`
Expected: All commands pass. If a pre-existing unrelated failure appears, document it in the PR or handoff note before merging.

- [ ] **Step 5: Commit shared UI and verification updates**

```bash
git add src/components/ui src/app/globals.css e2e
git commit -m "chore: add shared primitives for hybrid ui refresh"
```

## Self-Review

### Spec coverage
- Shell simplification is covered by Task 1.
- Today-first dashboard is covered by Task 2.
- Items simplification is covered by Task 3.
- Scan focus mode is covered by Task 4.
- Stock count workflow framing is covered by Task 5.
- Shared visual consistency and regression gates are covered by Task 6.

### Placeholder scan
- No `TODO`, `TBD`, or "similar to task N" references remain.
- Each task names concrete files, UI boundaries, and validation commands.

### Type consistency
- The new navigation model uses `NavGroup`, `NavLeaf`, and `NavGroupKey` consistently in Task 1.
- Dashboard components are all introduced before use in Task 2.
- Items, scanner, and stock count components are named consistently between the file map and the task steps.
