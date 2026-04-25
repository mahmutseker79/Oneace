// Sprint 9 PR #1 — Sonner (toaster) primitive story.

import type { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

const meta: Meta<typeof Toaster> = {
  title: "UI/Toaster (Sonner)",
  component: Toaster,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Sonner toast wrapper. `<Toaster />` root layout'a tek sefer eklenir; `toast()` her yerden çağrılabilir.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const SuccessToast: Story = {
  render: () => (
    <div className="space-y-3">
      <Button onClick={() => toast.success("Kayıt başarıyla güncellendi")}>
        Success toast tetikle
      </Button>
      <Toaster />
    </div>
  ),
};

export const ErrorToast: Story = {
  render: () => (
    <div className="space-y-3">
      <Button variant="destructive" onClick={() => toast.error("Sevkiyat oluşturulamadı")}>
        Error toast tetikle
      </Button>
      <Toaster />
    </div>
  ),
};

export const Promise: Story = {
  render: () => (
    <div className="space-y-3">
      <Button
        onClick={() =>
          toast.promise(new Promise((r) => setTimeout(r, 1500)), {
            loading: "Yükleniyor...",
            success: "Tamamlandı",
            error: "Hata oluştu",
          })
        }
      >
        Promise toast tetikle
      </Button>
      <Toaster />
    </div>
  ),
};
