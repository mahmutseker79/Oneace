// Sprint 8 PR #1 — Card primitive story.
//
// Card + CardHeader + CardTitle + CardDescription + CardContent +
// CardFooter composition. Audit'te tespit edilmişti: 7 farklı kart
// pattern'i var (Card, KpiCard, ChartCard, WidgetCard, DataPanel,
// SectionShell, ReportSummaryCard). Sprint 5 PR #3 backlog: 7→3
// normalize. Bu story canonical Card composition'ı dokümante eder.

import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Canonical kart container'ı. 7 farklı kart pattern'inden biri (KpiCard / ChartCard / WidgetCard / DataPanel / SectionShell / ReportSummaryCard) Sprint 5+ döneminde tek `<Card variant=\"...\">` API'sine normalize edilecek.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Card title</CardTitle>
        <CardDescription>Card description giving context.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Body content lives here. Tailwind prose-friendly.</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Confirm cancellation</CardTitle>
        <CardDescription>
          This moves the PO to CANCELLED. Already-received stock stays in the ledger.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">PO-000123 (Acme Suppliers) · 12 lines · ₺295.00 total</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="ghost">Keep PO</Button>
        <Button variant="destructive">Cancel PO</Button>
      </CardFooter>
    </Card>
  ),
};

export const HeaderOnly: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>No body needed</CardTitle>
        <CardDescription>Sometimes a header is the whole card.</CardDescription>
      </CardHeader>
    </Card>
  ),
};

/** Sprint 10 PR #3 — variant="interactive" (hover + cursor pointer). */
export const Interactive: Story = {
  render: () => (
    <Card variant="interactive" className="max-w-md">
      <CardHeader>
        <CardTitle>Tıklanabilir kart</CardTitle>
        <CardDescription>
          Hover'da arka plan değişir, cursor pointer'a döner. Genelde Link wrap içinde.
        </CardDescription>
      </CardHeader>
    </Card>
  ),
};

/** Sprint 10 PR #3 — variant="warning" (uyarı/dikkat states). */
export const Warning: Story = {
  render: () => (
    <Card variant="warning" className="max-w-md">
      <CardHeader>
        <CardTitle>Uyarı kartı</CardTitle>
        <CardDescription>
          Stok aktarımı veya transfer onayı bekleyen durumlar için.
        </CardDescription>
      </CardHeader>
    </Card>
  ),
};

/** Sprint 10 PR #3 — variant="destructive" (yıkıcı / silme states). */
export const Destructive: Story = {
  render: () => (
    <Card variant="destructive" className="max-w-md">
      <CardHeader>
        <CardTitle>Tehlikeli alan</CardTitle>
        <CardDescription>
          Hesap silme, organizasyon transfer gibi geri alınamaz işlemler için.
        </CardDescription>
      </CardHeader>
    </Card>
  ),
};

/** Liste içinde Card kullanımı. */
export const Stacked: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-md">
      {[
        { title: "Receipt #1", desc: "PO-000123 · 12 items received" },
        { title: "Receipt #2", desc: "PO-000124 · 8 items received" },
        { title: "Receipt #3", desc: "PO-000125 · 24 items received" },
      ].map((it) => (
        <Card key={it.title}>
          <CardHeader>
            <CardTitle>{it.title}</CardTitle>
            <CardDescription>{it.desc}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  ),
};
