// Sprint 9 PR #1 — Switch primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Label } from "./label";
import { Switch } from "./switch";

const meta: Meta<typeof Switch> = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Toggle switch. Native checkbox semantik (a11y), Tailwind transition.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: () => <Switch />,
};

export const Controlled: Story = {
  render: () => {
    const Comp = () => {
      const [v, setV] = useState(true);
      return (
        <div className="flex items-center gap-3">
          <Switch checked={v} onCheckedChange={setV} id="ctrl" />
          <Label htmlFor="ctrl">Bildirimler {v ? "açık" : "kapalı"}</Label>
        </div>
      );
    };
    return <Comp />;
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Switch disabled id="dis" />
      <Label htmlFor="dis">Devre dışı</Label>
    </div>
  ),
};
