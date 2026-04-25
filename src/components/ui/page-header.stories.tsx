// Sprint 8 PR #1 — PageHeader primitive story.
//
// 86/141 sayfada kullanılıyor (Sprint 4 PR #1 ile artmış). Sprint 1
// PR #7'de `titleClassName` prop'u eklendi (dashboard gradient için).
// Bu story tüm prop kombinasyonlarını dokümante eder.

import type { Meta, StoryObj } from "@storybook/react";
import { Download, Plus } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { PageHeader } from "./page-header";

const meta: Meta<typeof PageHeader> = {
  title: "UI/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Sayfa başlığı bileşeni. title + opt. description + opt. breadcrumb + opt. actions + opt. backHref + opt. badge + opt. titleClassName.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Basic: Story = {
  args: {
    title: "Items",
    description: "Every SKU you stock, in one searchable place.",
  },
};

export const WithActions: Story = {
  render: () => (
    <PageHeader
      title="Items"
      description="Every SKU you stock, in one searchable place."
      actions={
        <>
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button>
            <Plus className="h-4 w-4" />
            New item
          </Button>
        </>
      }
    />
  ),
};

export const WithBreadcrumb: Story = {
  render: () => (
    <PageHeader
      title="Low Stock"
      description="Items below their reorder point."
      breadcrumb={[
        { label: "Reports", href: "/reports" },
        { label: "Low Stock" },
      ]}
    />
  ),
};

export const WithBackButton: Story = {
  render: () => (
    <PageHeader
      title="PO-000123"
      description="Acme Suppliers · 12 lines · ₺295.00 total"
      backHref="/purchase-orders"
      badge={<Badge variant="info">Sent</Badge>}
    />
  ),
};

/** Sprint 1 PR #7 — gradient title varyasyonu (dashboard'da kullanıldı). */
export const GradientTitle: Story = {
  args: {
    title: "Welcome back, Mahmut",
    titleClassName: "text-gradient-primary",
    description: "Acme Tic. Ltd. Şti. · OneAce control center.",
  },
};

export const FullCombo: Story = {
  render: () => (
    <PageHeader
      title="Q2 Cycle Count"
      description="In progress — 320/487 items counted (65% coverage)."
      backHref="/stock-counts"
      badge={<Badge variant="processing">In progress</Badge>}
      breadcrumb={[
        { label: "Stock Counts", href: "/stock-counts" },
        { label: "Q2 Cycle Count" },
      ]}
      actions={
        <>
          <Button variant="outline">Pause</Button>
          <Button variant="destructive">Cancel count</Button>
          <Button>Reconcile</Button>
        </>
      }
    />
  ),
};
