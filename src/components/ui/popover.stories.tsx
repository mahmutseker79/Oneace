// Sprint 9 PR #1 — Popover primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta: Meta<typeof Popover> = {
  title: "UI/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Radix Popover. Trigger'a anchored, focus trap içermez (Dialog değil).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Basic: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Popover aç</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-2">
          <h4 className="font-semibold">Hızlı not</h4>
          <p className="text-sm text-muted-foreground">
            Trigger'ın altına yapışan popover.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const Form: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button>Genişliği ayarla</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="grid gap-3">
          <h4 className="font-semibold">Boyutlar</h4>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label htmlFor="width">Genişlik</Label>
            <Input id="width" defaultValue="100px" className="col-span-2 h-8" />
          </div>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label htmlFor="height">Yükseklik</Label>
            <Input id="height" defaultValue="40px" className="col-span-2 h-8" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
