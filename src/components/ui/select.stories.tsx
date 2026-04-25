// Sprint 9 PR #1 — Select primitive story (Storybook coverage 11→25 backlog).
//
// Radix Select wrapper. shadcn defaultları korunmuş, sadece tema
// `--popover` / `--ring` token'ları üzerinden dark mode'da otomatik geçer.

import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Radix-tabanlı select. Dark mode + reduced-motion hazır, semantic token tabanlı.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const FRUITS = ["Elma", "Armut", "Şeftali", "Kiraz", "Üzüm"];

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Bir meyve seçin" />
      </SelectTrigger>
      <SelectContent>
        {FRUITS.map((f) => (
          <SelectItem key={f} value={f.toLowerCase()}>
            {f}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Bir kategori seçin" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Meyve</SelectLabel>
          {FRUITS.map((f) => (
            <SelectItem key={f} value={f.toLowerCase()}>
              {f}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectLabel>Sebze</SelectLabel>
          <SelectItem value="domates">Domates</SelectItem>
          <SelectItem value="biber">Biber</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Devre dışı" />
      </SelectTrigger>
      <SelectContent />
    </Select>
  ),
};
