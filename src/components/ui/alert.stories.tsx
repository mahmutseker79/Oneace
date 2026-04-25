// Sprint 8 PR #1 — Alert primitive story.
//
// 5 variant + AlertTitle + AlertDescription kombinasyonu.
// Sprint 1 PR #6'da KVKK sayfasındaki raw `bg-yellow-50` patterni
// `<Alert variant="warning">` primitive'ine taşınmıştı; bu story
// canonical kullanımı dokümante eder.

import type { Meta, StoryObj } from "@storybook/react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Alert / banner. 5 variant — default, destructive, success, warning, info. `role=\"alert\"` semantic koruyor; ekran okuyucu otomatik duyurur.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "success", "warning", "info"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: () => (
    <Alert>
      <Info aria-hidden="true" />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>
        This is the default alert variant — neutral background, no semantic intent.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <XCircle aria-hidden="true" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        Could not save the purchase order. Check your network and retry.
      </AlertDescription>
    </Alert>
  ),
};

export const Success: Story = {
  render: () => (
    <Alert variant="success">
      <CheckCircle2 aria-hidden="true" />
      <AlertTitle>Count completed</AlertTitle>
      <AlertDescription>
        12 stock adjustments applied — your on-hand quantities now match what was counted.
      </AlertDescription>
    </Alert>
  ),
};

export const Warning: Story = {
  render: () => (
    <Alert variant="warning">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Low stock detected</AlertTitle>
      <AlertDescription>
        12 items are at or below their reorder point. Review the low-stock report.
      </AlertDescription>
    </Alert>
  ),
};

export const Info: Story = {
  render: () => (
    <Alert variant="info">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Setup tip</AlertTitle>
      <AlertDescription>
        Add a supplier first, then come back to raise a purchase order.
      </AlertDescription>
    </Alert>
  ),
};

/** KVKK pattern — Sprint 1 PR #6'nın canonical kullanımı. */
export const KvkkDraftBanner: Story = {
  render: () => (
    <Alert variant="warning">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Taslak.</AlertTitle>
      <AlertDescription>
        Bu metin canlı bir hukuki belge değildir. Avukat incelemesi ve şirket tüzel kişilik
        bilgileri eklenmeden paid launch yapılmayacaktır.
      </AlertDescription>
    </Alert>
  ),
};
