// Sprint 8 PR #1 — KpiCard primitive story.
//
// Dashboard ve report'larda kullanılıyor. Sprint 5 PR #3 backlog:
// KpiCard / ChartCard / WidgetCard / DataPanel / SectionShell /
// ReportSummaryCard → tek `<Card variant="metric">` API. Bu story
// mevcut KpiCard prop'larını dokümante eder, normalize öncesi
// referans olarak kalır.

import type { Meta, StoryObj } from "@storybook/react";
import { AlertTriangle, ClipboardCheck, Package, TrendingUp } from "lucide-react";
import { KpiCard } from "./kpi-card";

const meta: Meta<typeof KpiCard> = {
  title: "UI/KpiCard",
  component: KpiCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Dashboard KPI kartı. Title + value + opt. description + opt. trend (up/down/none) + opt. href (clickable). Sprint 5 PR #3'te Card variant API'sine taşınacak.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof KpiCard>;

export const Basic: Story = {
  args: {
    title: "Total items",
    value: "487",
    description: "487 active · 12 archived",
  },
};

export const WithIcon: Story = {
  args: {
    title: "Stock value",
    value: "₺245,890",
    description: "across 3 locations",
    icon: <TrendingUp className="h-5 w-5" />,
  },
};

export const TrendUp: Story = {
  args: {
    title: "Active items",
    value: "487",
    icon: <Package className="h-5 w-5" />,
    trend: { value: 12, label: "vs last week" },
  },
};

export const TrendDown: Story = {
  args: {
    title: "Stock value",
    value: "₺245,890",
    icon: <TrendingUp className="h-5 w-5" />,
    trend: { value: -8, label: "vs last week" },
  },
};

export const TrendFlat: Story = {
  args: {
    title: "Active counts",
    value: "2",
    icon: <ClipboardCheck className="h-5 w-5" />,
    trend: { value: 0, label: "no change" },
  },
};

export const Clickable: Story = {
  args: {
    title: "Low stock",
    value: "12",
    description: "Items at or below reorder point",
    icon: <AlertTriangle className="h-5 w-5" />,
    href: "/reports/low-stock",
  },
};

/** Dashboard 4-card grid — gerçek kontekst. */
export const DashboardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl">
      <KpiCard
        title="Total items"
        value="487"
        description="487 active · 12 archived"
        icon={<Package className="h-5 w-5" />}
        href="/items"
      />
      <KpiCard
        title="Stock value"
        value="₺245,890"
        description="across 3 locations"
        icon={<TrendingUp className="h-5 w-5" />}
        trend={{ value: 12, label: "vs last week" }}
        href="/reports/stock-value"
      />
      <KpiCard
        title="Low stock"
        value="12"
        description="Items at or below reorder point"
        icon={<AlertTriangle className="h-5 w-5" />}
        href="/reports/low-stock"
      />
      <KpiCard
        title="Active counts"
        value="2"
        description="1 open · 1 in progress"
        icon={<ClipboardCheck className="h-5 w-5" />}
        href="/stock-counts"
      />
    </div>
  ),
};
