// Sprint 9 PR #1 — Sheet primitive story (side drawer).

import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta: Meta<typeof Sheet> = {
  title: "UI/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Side drawer (Dialog tabanlı). 4 yön (top/right/bottom/left) — varsayılan: right. Mobile-friendly.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Sağdan aç</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtreler</SheetTitle>
          <SheetDescription>Aramayı daraltmak için filtre seç.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 py-2 text-sm">
          <p>Filtre içeriği burada.</p>
        </div>
        <SheetFooter>
          <Button>Uygula</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Soldan aç</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Menü</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-2 text-sm">Mobil navigasyon içeriği.</div>
      </SheetContent>
    </Sheet>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Alttan aç</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Hızlı eylemler</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-3 text-sm">Aksiyon listesi.</div>
      </SheetContent>
    </Sheet>
  ),
};
