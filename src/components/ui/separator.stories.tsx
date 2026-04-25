// Sprint 9 PR #1 — Separator primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "UI/Separator",
  component: Separator,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Yatay/dikey ayırıcı çizgi. `--border` token'a hizalı.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-72">
      <p className="text-sm font-medium">Üstteki içerik</p>
      <Separator className="my-3" />
      <p className="text-sm text-muted-foreground">Alttaki içerik</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 items-center gap-4 text-sm">
      <span>Sol</span>
      <Separator orientation="vertical" />
      <span>Orta</span>
      <Separator orientation="vertical" />
      <span>Sağ</span>
    </div>
  ),
};
