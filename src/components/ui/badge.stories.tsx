// Sprint 8 PR #1 — Badge primitive story (UX/UI audit Apr-25 follow-up).
//
// 8 variant. Sprint 1 PR #6'da hardcoded `bg-green-100` palette'i
// `bg-success-light text-success` semantic token'lara çekilmişti;
// bu story'ler hem tasarım uyumluluğunu pinler, hem de a11y addon
// runtime kontrast denetimi sağlar.

import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Etiket / durum göstergesi. 8 variant — semantic token'lara hizalı (success/warning/info için `--success`/`--warning`/`--info` family).",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "outline",
        "success",
        "warning",
        "info",
        "processing",
      ],
    },
  },
  args: { children: "Badge" },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "Secondary" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Critical" } };
export const Outline: Story = { args: { variant: "outline", children: "Outline" } };
export const Success: Story = { args: { variant: "success", children: "Active" } };
export const Warning: Story = { args: { variant: "warning", children: "Low stock" } };
export const Info: Story = { args: { variant: "info", children: "In transit" } };
export const Processing: Story = { args: { variant: "processing", children: "Syncing…" } };

/** Tüm variant'ları yan yana göster — semantic ailenin görsel kontrolü. */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="processing">Processing</Badge>
    </div>
  ),
};

/** ERP'ye özgü kullanım örnekleri — gerçek sayfa konteksti. */
export const StockStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success">In stock</Badge>
      <Badge variant="warning">Low stock</Badge>
      <Badge variant="destructive">Out of stock</Badge>
      <Badge variant="info">Reorder placed</Badge>
      <Badge variant="processing">Syncing</Badge>
      <Badge variant="secondary">Archived</Badge>
    </div>
  ),
};
