// Sprint 9 PR #1 — Breadcrumb primitive story.
//
// PR #1 (Sprint 1 a11y) bu component'a `aria-current="page"` ekledi.

import type { Meta, StoryObj } from "@storybook/react";
import { Breadcrumb } from "./breadcrumb";

const meta: Meta<typeof Breadcrumb> = {
  title: "UI/Breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Sayfa konumu navigasyonu. Son item `aria-current=\"page\"` taşır (Sprint 1 a11y).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const TwoLevel: Story = {
  render: () => (
    <Breadcrumb
      items={[
        { label: "Stok", href: "/items" },
        { label: "SKU-001" },
      ]}
    />
  ),
};

export const FourLevel: Story = {
  render: () => (
    <Breadcrumb
      items={[
        { label: "Operasyon", href: "/ops" },
        { label: "Sevkiyat", href: "/ops/ship" },
        { label: "SO-2026-0042", href: "/sales-orders/42" },
        { label: "Pakete dönüştür" },
      ]}
    />
  ),
};
