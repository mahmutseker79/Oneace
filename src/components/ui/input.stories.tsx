// Sprint 8 PR #1 — Input primitive story.
//
// `--control-h-md` token (Sprint 1 PR #2'de 40 → 44px) Input'a da
// uygulanır (lock-step). Bu story 44px touch hedefini görsel
// doğrular.

import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Form input. Sprint 1 PR #2 ile `--control-h-md` 40 → 44px (WCAG 2.5.5 AAA touch). Button + Select + Textarea ile lock-step yükseklik.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: "you@company.com" },
};

export const WithValue: Story = {
  args: { defaultValue: "mahmutseker@gmail.com" },
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: "Disabled" },
};

export const TypeSearch: Story = {
  args: { type: "search", placeholder: "Search items, SKUs, suppliers…" },
};

export const TypeNumber: Story = {
  args: { type: "number", placeholder: "0", min: 0, max: 9999 },
};

export const TypePassword: Story = {
  args: { type: "password", placeholder: "••••••••" },
};

/** Form context — Label + Input pair (a11y htmlFor binding). */
export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2 max-w-sm">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@company.com" />
    </div>
  ),
};

/** Lock-step görsel doğrulama — 44px floor. */
export const TouchTargetAudit: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-sm rounded-md border border-dashed p-4">
      <div className="space-y-1">
        <Label htmlFor="audit-email">Email — 44px (default)</Label>
        <Input id="audit-email" placeholder="WCAG 2.5.5 AAA touch target" />
      </div>
      <p className="text-xs text-muted-foreground">
        Lock-step token: --control-h-md = 2.75rem = 44px
      </p>
    </div>
  ),
};
