// Sprint 9 PR #1 — Label primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Radix Label — `htmlFor` ile native form binding. Disabled state otomatik (`peer-disabled:opacity-70`).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  render: () => <Label htmlFor="email">E-posta</Label>,
};

export const WithInput: Story = {
  render: () => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="email-input">E-posta</Label>
      <Input id="email-input" type="email" placeholder="ornek@oneace.app" />
    </div>
  ),
};

export const RequiredMark: Story = {
  render: () => (
    <Label htmlFor="req">
      İsim <span className="text-destructive">*</span>
    </Label>
  ),
};
