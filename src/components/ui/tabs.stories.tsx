// Sprint 8 PR #1 — Tabs primitive story.
//
// Items page detail view, supplier detail view, settings vb.'de
// kullanılır. Radix Tabs üzerine kurulu — `aria-current` zaten
// canonical (Sprint 1 PR #1 wrapper-tabs.tsx ayrı bir varyant).

import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Radix Tabs üzerine kurulu kontrollü/kontrolsüz sekme primitive'i. Wrapper-tabs ile karıştırma — bu daha basit, sayfa-içi sekme. wrapper-tabs sayfalar arası nav (saved-views vb.).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="max-w-2xl">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="levels">Stock Levels</TabsTrigger>
        <TabsTrigger value="movements">Movements</TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="rounded-md border p-4">
        Item overview content. SKU, barcode, category, supplier.
      </TabsContent>
      <TabsContent value="levels" className="rounded-md border p-4">
        Per-warehouse stock-level table.
      </TabsContent>
      <TabsContent value="movements" className="rounded-md border p-4">
        Recent stock-movements ledger.
      </TabsContent>
      <TabsContent value="audit" className="rounded-md border p-4">
        Per-item audit log entries.
      </TabsContent>
    </Tabs>
  ),
};

export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultValue="lines" className="max-w-2xl">
      <TabsList>
        <TabsTrigger value="lines">Lines</TabsTrigger>
        <TabsTrigger value="receipts">Receipts</TabsTrigger>
      </TabsList>
      <TabsContent value="lines" className="rounded-md border p-4">
        12 lines · ₺295.00 total
      </TabsContent>
      <TabsContent value="receipts" className="rounded-md border p-4">
        2 receipts posted · 8 items received
      </TabsContent>
    </Tabs>
  ),
};
