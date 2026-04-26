// Sprint 8 PR #1 — EmptyState primitive story.
//
// 4 variant: empty (true first-use), filtered (no results),
// unavailable (feature gated), completed (Sprint 16 — task done success).
// 46+ sayfada kullanılıyor (Sprint 15 closure). Bu story canonical kullanımı pin'ler.

import type { Meta, StoryObj } from "@storybook/react";
import { CheckCircle2, Lock, Package, Search } from "lucide-react";
import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Boş durum kartı. 3 variant: `empty` (henüz hiç veri yok), `filtered` (filtre sonucu boş), `unavailable` (özellik mevcut planda yok).",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["empty", "filtered", "unavailable", "completed"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const TrueEmpty: Story = {
  args: {
    icon: Package,
    title: "No items yet",
    description: "You haven't added any items. Items are the SKUs you buy, stock, and sell.",
    actions: [
      { label: "Create your first item", href: "/items/new", icon: Package },
      { label: "or import a CSV", href: "/items/import", variant: "secondary" },
    ],
  },
};

export const FilteredEmpty: Story = {
  args: {
    icon: Search,
    title: "No items match this filter",
    description: "Try a different status filter or clear the filter to see all items.",
    variant: "filtered",
    actions: [{ label: "Clear filter", href: "/items", variant: "secondary" }],
  },
};

export const FeatureUnavailable: Story = {
  args: {
    icon: Lock,
    title: "ABC analysis is a Pro feature",
    description: "Upgrade to access ABC classification and Pareto analysis.",
    variant: "unavailable",
    actions: [{ label: "Upgrade plan", href: "/settings/billing" }],
  },
};

export const NoActions: Story = {
  args: {
    icon: Package,
    title: "No movements yet",
    description: "Receive your first PO to populate the ledger.",
  },
};

/** Sprint 16 PR #1 — `completed` variant (post-action success state). */
export const Completed: Story = {
  args: {
    icon: CheckCircle2,
    title: "All stock binned",
    description: "Every received unit has been assigned to a bin. Nothing left to put away.",
    variant: "completed",
    actions: [{ label: "View purchase order", href: "/purchase-orders/po-1", variant: "secondary" }],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Task tamamlanma / başarı durumu. `bg-success/10 ring-success/20 + text-success` ile yeşil ton. `empty` (ilk-kullanım boşluğu) varyantından semantik olarak farklı — bu pozitif tamamlanma sinyali.",
      },
    },
  },
};

/** Sprint 12 PR #1 — `bare` mode (panel-içi, outer Card atlanır). */
export const Bare: Story = {
  args: {
    icon: Package,
    title: "No components added yet",
    description: "Add items to this kit using the button above.",
    bare: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Panel-içi (existing CardContent içinde) empty state için. Outer `<Card border-dashed>` atlanır, sadece inner içerik render edilir. `data-bare=\"true\"` attribute emit edilir.",
      },
    },
  },
};
