// Sprint 8 PR #1 — Tooltip primitive story.
//
// Radix Tooltip üzerine kurulu. Audit'te `Tooltip` kullanım
// yaygınlığının düşük olduğu görülmüştü; bu story canonical
// kullanım pattern'ini dokümante eder.

import type { Meta, StoryObj } from "@storybook/react";
import { HelpCircle, Info } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta: Meta = {
  title: "UI/Tooltip",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hover-aktivite kısa bilgi katmanı. `TooltipProvider` ile sarmalanmalı (üst Layout'ta global olabilir). Touch cihazlarda Tooltip görünmez — kritik bilgi olarak kullanma.",
      },
    },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <div className="p-12">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>Tooltip content</TooltipContent>
    </Tooltip>
  ),
};

export const OnIconButton: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Help">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>What does this metric mean?</TooltipContent>
    </Tooltip>
  ),
};

export const FormFieldHelp: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Reorder point</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex" aria-label="Reorder point help">
            <Info className="h-4 w-4 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Get alerted when stock drops to this level. Set 0 to disable alerts.
        </TooltipContent>
      </Tooltip>
    </div>
  ),
};
