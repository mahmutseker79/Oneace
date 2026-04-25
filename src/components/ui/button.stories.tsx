// Sprint 5 PR #1 — Button primitive story.
// (UX/UI audit Apr-25 follow-up.)
//
// Button 7 variant × 4 size = 28 kombinasyon. Önceki audit'te
// Sprint 1 PR #2'de `--control-h-md` tokeni 40 → 44px'e çıkarıldı.
// Bu story `default` size'ın 44px touch hedefini görsel olarak
// doğrular ve diğer size'lar için karşılaştırma sağlar.

import type { Meta, StoryObj } from "@storybook/react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Canonical action button. 7 variant × 4 size. `default` size honours the 44px touch-target floor (Sprint 1 PR #2). `icon` size pins `min-h-[44px] min-w-[44px]` regardless of token bumps.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "success", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    isLoading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: {
    children: "Save changes",
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Destructive: Story = { args: { variant: "destructive", children: "Delete" } };

export const Success: Story = { args: { variant: "success", children: "Approve" } };

export const Outline: Story = { args: { variant: "outline" } };

export const Secondary: Story = { args: { variant: "secondary" } };

export const Ghost: Story = { args: { variant: "ghost" } };

export const Link: Story = { args: { variant: "link", children: "Read more" } };

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small (36px)</Button>
      <Button size="default">Default (44px)</Button>
      <Button size="lg">Large (48px)</Button>
      <Button size="icon" aria-label="Add">
        <Plus />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { isLoading: true, children: "Saving" },
};

export const WithLeadingIcon: Story = {
  render: () => (
    <Button>
      <Plus />
      New item
    </Button>
  ),
};

export const WithTrailingIcon: Story = {
  render: () => (
    <Button variant="ghost">
      Continue
      <ChevronRight />
    </Button>
  ),
};

export const DangerWithIcon: Story = {
  render: () => (
    <Button variant="destructive">
      <Trash2 />
      Delete project
    </Button>
  ),
};

/**
 * 44px touch-target compliance check. The default size button must
 * be at least 44px tall and the icon variant must be at least
 * 44×44px regardless of CSS variable changes.
 */
export const TouchTargetAudit: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-4 text-sm">
      <Button>Default — 44px (WCAG AA touch)</Button>
      <Button variant="outline">Outline — 44px</Button>
      <Button size="icon" aria-label="Plus">
        <Plus />
      </Button>
    </div>
  ),
};
