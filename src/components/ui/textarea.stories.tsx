// Sprint 9 PR #1 — Textarea primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Çok satırlı metin alanı. Default 3 satır + min-h-16, ring tokenize.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: () => <Textarea placeholder="Notunuzu yazın..." className="w-72" />,
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-72 gap-2">
      <Label htmlFor="note">Not</Label>
      <Textarea id="note" placeholder="Müşteri için açıklama..." />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => <Textarea disabled placeholder="Devre dışı" className="w-72" />,
};
