// Sprint 9 PR #1 — Dialog primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Radix Dialog modal — focus trap, ESC kapatma, scroll lock built-in. Token tabanlı arka plan.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Basic: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Diyaloğu aç</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Onayla</DialogTitle>
          <DialogDescription>Bu işlemi gerçekleştirmek istediğine emin misin?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">İptal</Button>
          <Button>Devam et</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Form: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Profili düzenle</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profili düzenle</DialogTitle>
          <DialogDescription>İsim ve e-posta bilgilerini güncelle.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">İsim</Label>
            <Input id="name" defaultValue="Mahmut Şeker" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email-d">E-posta</Label>
            <Input id="email-d" type="email" defaultValue="mahmut@oneace.app" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">İptal</Button>
          <Button>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Sil</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stok kalemini sil</DialogTitle>
          <DialogDescription>
            Bu işlem geri alınamaz. Kalem ve ilişkili hareketleri silinecek.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">İptal</Button>
          <Button variant="destructive">Kalıcı olarak sil</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
