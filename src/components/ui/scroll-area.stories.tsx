// Sprint 9 PR #1 — ScrollArea primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";

const meta: Meta<typeof ScrollArea> = {
  title: "UI/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Radix ScrollArea — özel scrollbar, native scroll davranışı korunur.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScrollArea>;

const TAGS = Array.from({ length: 50 }, (_, i) => `Etiket ${i + 1}`);

export const VerticalList: Story = {
  render: () => (
    <ScrollArea className="h-72 w-56 rounded-md border">
      <div className="p-4">
        <h4 className="mb-2 text-sm font-medium">Etiketler</h4>
        {TAGS.map((tag, i) => (
          <div key={tag}>
            <div className="text-sm">{tag}</div>
            {i < TAGS.length - 1 ? <Separator className="my-2" /> : null}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const Compact: Story = {
  render: () => (
    <ScrollArea className="h-32 w-56 rounded-md border">
      <div className="p-3 text-sm leading-relaxed">
        {TAGS.slice(0, 12).join(" · ")}
      </div>
    </ScrollArea>
  ),
};
