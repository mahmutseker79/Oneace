// Sprint 9 PR #1 — Checkbox primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta: Meta<typeof Checkbox> = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Radix Checkbox. `--primary` token'a hizalı, ring-3 focus ile a11y uyumlu.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => <Checkbox id="cb1" />,
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">KVKK metnini okudum, kabul ediyorum</Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="cb2" defaultChecked />
      <Label htmlFor="cb2">Varsayılan seçili</Label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="cb3" disabled />
      <Label htmlFor="cb3">Devre dışı</Label>
    </div>
  ),
};
