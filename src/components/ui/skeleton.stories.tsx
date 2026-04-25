// Sprint 8 PR #1 — Skeleton primitive story.
//
// 115 loading.tsx skeleton dosyasında ve Sprint 1 PR #4'te raw
// `<div>Loading...</div>` yerine kullanıldı. Bu story canonical
// Skeleton kullanımını ve common patterns'i pin'ler.

import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: { className: "h-8 w-48" },
};

export const Circle: Story = {
  args: { className: "h-12 w-12 rounded-full" },
};

/** PageHeader fallback pattern — Sprint 1 PR #4 style. */
export const PageHeaderFallback: Story = {
  render: () => (
    <div className="space-y-3">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-4 w-2xl" />
    </div>
  ),
};

/** Table fallback pattern. */
export const TableFallback: Story = {
  render: () => (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-4 flex-1 max-w-md" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  ),
};

/** Card grid fallback. */
export const CardGridFallback: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  ),
};
