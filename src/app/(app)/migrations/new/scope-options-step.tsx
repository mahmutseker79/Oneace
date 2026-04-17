"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MigrationScopeOptions } from "@/lib/migrations/core/scope-options";
import { PO_HISTORY_SCOPES } from "@/lib/migrations/core/scope-options";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScopeOptionsStepProps {
  value: MigrationScopeOptions;
  onChange: (v: MigrationScopeOptions) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

const PO_HISTORY_LABELS: Record<string, { title: string; description: string }> = {
  ALL: {
    title: "Tüm geçmiş (büyük datasette dakikalar sürebilir)",
    description: "Kaynak sistemindeki tüm satınalma siparişlerini getir",
  },
  LAST_12_MONTHS: {
    title: "Son 12 ay + açık PO'lar (önerilen)",
    description: "Son 12 ayda oluşturulan veya hala açık olan siparişleri getir",
  },
  OPEN_ONLY: {
    title: "Sadece açık/teslim alınmamış PO'lar",
    description: "Henüz alınmamış veya kapatılmamış siparişleri getir",
  },
  SKIP: {
    title: "PO'ları hiç getirme",
    description: "Satınalma siparişlerini atla",
  },
};

export function ScopeOptionsStep({
  value,
  onChange,
  onBack,
  onNext,
  isLoading = false,
}: ScopeOptionsStepProps) {
  const handlePoHistoryChange = (scope: string) => {
    onChange({
      ...value,
      poHistory: scope as typeof value.poHistory,
    });
  };

  const handleCheckboxChange = (field: "includeCustomFields" | "includeAttachments" | "includeArchivedItems") => {
    onChange({
      ...value,
      [field]: !value[field],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Göç Kapsamı</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hangi verileri ne kadar geriye kadar getireceğimizi seç.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Satınalma Siparişleri (PO) Geçmişi</CardTitle>
          <CardDescription>
            Kaynaktan ne kadar eski PO'lar getireceğini seç
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="po-scope" className="font-medium mb-2 block">
              PO Kapsamı
            </Label>
            <Select value={value.poHistory} onValueChange={handlePoHistoryChange}>
              <SelectTrigger id="po-scope">
                <SelectValue placeholder="Seç..." />
              </SelectTrigger>
              <SelectContent>
                {PO_HISTORY_SCOPES.map((scope) => (
                  <SelectItem key={scope} value={scope}>
                    {PO_HISTORY_LABELS[scope].title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            {PO_HISTORY_LABELS[value.poHistory]?.description}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ek Seçenekler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="custom-fields"
              checked={value.includeCustomFields}
              onCheckedChange={() => handleCheckboxChange("includeCustomFields")}
              className="mt-1"
            />
            <Label
              htmlFor="custom-fields"
              className="flex-1 cursor-pointer"
            >
              <div className="font-medium">Özel alanları (custom fields) içe al</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Kaynakta tanımlanmış özel alanları OneAce&apos;e aktarır
              </div>
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="attachments"
              checked={value.includeAttachments}
              onCheckedChange={() => handleCheckboxChange("includeAttachments")}
              className="mt-1"
            />
            <Label
              htmlFor="attachments"
              className="flex-1 cursor-pointer"
            >
              <div className="font-medium">Ürün fotoğraflarını içe al</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Ürünlerle ilişkili görselleri ve belgeler indir
              </div>
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="archived"
              checked={value.includeArchivedItems}
              onCheckedChange={() => handleCheckboxChange("includeArchivedItems")}
              className="mt-1"
            />
            <Label
              htmlFor="archived"
              className="flex-1 cursor-pointer"
            >
              <div className="font-medium">Arşivlenmiş ürünleri de getir</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Kaynakta arşivlenmiş veya pasif olarak işaretlenmiş ürünleri dahil et
              </div>
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Geri
        </Button>
        <Button
          onClick={onNext}
          disabled={isLoading}
          className="gap-2"
        >
          İleri
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
