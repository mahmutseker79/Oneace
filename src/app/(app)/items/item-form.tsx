"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Item } from "@/generated/prisma";

import { createItemAction, updateItemAction } from "./actions";

export type ItemFormLabels = {
  fields: {
    sku: string;
    skuHelp: string;
    name: string;
    description: string;
    barcode: string;
    category: string;
    preferredSupplier: string;
    preferredSupplierHelp: string;
    unit: string;
    unitPlaceholder: string;
    costPrice: string;
    salePrice: string;
    currency: string;
    reorderPoint: string;
    reorderPointHelp: string;
    reorderQty: string;
    reorderQtyHelp: string;
    status: string;
    imageUrl: string;
  };
  common: {
    save: string;
    saveChanges: string;
    cancel: string;
    optional: string;
    active: string;
    archived: string;
    draft: string;
    none: string;
  };
  errors: {
    createFailed: string;
    updateFailed: string;
  };
  backHref: string;
  backLabel: string;
};

type CategoryOption = { id: string; name: string };
type SupplierOption = { id: string; name: string };

const NO_CATEGORY = "__none__";
const NO_SUPPLIER = "__none__";

type ItemFormProps = {
  labels: ItemFormLabels;
  categories: CategoryOption[];
  suppliers: SupplierOption[];
  mode: "create" | "edit";
  initial?: Pick<
    Item,
    | "id"
    | "sku"
    | "barcode"
    | "name"
    | "description"
    | "categoryId"
    | "preferredSupplierId"
    | "unit"
    | "currency"
    | "reorderPoint"
    | "reorderQty"
    | "status"
    | "imageUrl"
  > & {
    costPrice: string | null;
    salePrice: string | null;
  };
};

export function ItemForm({ labels, categories, suppliers, mode, initial }: ItemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? NO_CATEGORY);
  const [preferredSupplierId, setPreferredSupplierId] = useState<string>(
    initial?.preferredSupplierId ?? NO_SUPPLIER,
  );
  const [status, setStatus] = useState<"ACTIVE" | "ARCHIVED" | "DRAFT">(
    initial?.status ?? "ACTIVE",
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    formData.set("categoryId", categoryId === NO_CATEGORY ? "" : categoryId);
    formData.set(
      "preferredSupplierId",
      preferredSupplierId === NO_SUPPLIER ? "" : preferredSupplierId,
    );
    formData.set("status", status);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createItemAction(formData)
          : await updateItemAction(initial?.id ?? "", formData);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.push("/items");
      router.refresh();
    });
  }

  function fieldError(name: string): string | undefined {
    return fieldErrors[name]?.[0];
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">{labels.fields.sku}</Label>
          <Input
            id="sku"
            name="sku"
            required
            defaultValue={initial?.sku}
            aria-invalid={!!fieldError("sku")}
          />
          <p className="text-xs text-muted-foreground">{labels.fields.skuHelp}</p>
          {fieldError("sku") ? (
            <p className="text-xs text-destructive">{fieldError("sku")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">{labels.fields.name}</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={initial?.name}
            aria-invalid={!!fieldError("name")}
          />
          {fieldError("name") ? (
            <p className="text-xs text-destructive">{fieldError("name")}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          {labels.fields.description}{" "}
          <span className="text-muted-foreground">({labels.common.optional})</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={3}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="barcode">
            {labels.fields.barcode}{" "}
            <span className="text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input
            id="barcode"
            name="barcode"
            defaultValue={initial?.barcode ?? ""}
            aria-invalid={!!fieldError("barcode")}
          />
          {fieldError("barcode") ? (
            <p className="text-xs text-destructive">{fieldError("barcode")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">{labels.fields.category}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="category">
              <SelectValue placeholder={labels.common.none} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>{labels.common.none}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferredSupplier">
          {labels.fields.preferredSupplier}{" "}
          <span className="text-muted-foreground">({labels.common.optional})</span>
        </Label>
        <Select value={preferredSupplierId} onValueChange={setPreferredSupplierId}>
          <SelectTrigger id="preferredSupplier">
            <SelectValue placeholder={labels.common.none} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SUPPLIER}>{labels.common.none}</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{labels.fields.preferredSupplierHelp}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="unit">{labels.fields.unit}</Label>
          <Input
            id="unit"
            name="unit"
            defaultValue={initial?.unit ?? "each"}
            placeholder={labels.fields.unitPlaceholder}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="costPrice">
            {labels.fields.costPrice}{" "}
            <span className="text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input
            id="costPrice"
            name="costPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.costPrice ?? ""}
            aria-invalid={!!fieldError("costPrice")}
          />
          {fieldError("costPrice") ? (
            <p className="text-xs text-destructive">{fieldError("costPrice")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="salePrice">
            {labels.fields.salePrice}{" "}
            <span className="text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input
            id="salePrice"
            name="salePrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.salePrice ?? ""}
            aria-invalid={!!fieldError("salePrice")}
          />
          {fieldError("salePrice") ? (
            <p className="text-xs text-destructive">{fieldError("salePrice")}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="currency">{labels.fields.currency}</Label>
          <Input
            id="currency"
            name="currency"
            maxLength={3}
            defaultValue={initial?.currency ?? "USD"}
            aria-invalid={!!fieldError("currency")}
          />
          {fieldError("currency") ? (
            <p className="text-xs text-destructive">{fieldError("currency")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reorderPoint">{labels.fields.reorderPoint}</Label>
          <Input
            id="reorderPoint"
            name="reorderPoint"
            type="number"
            min="0"
            defaultValue={initial?.reorderPoint ?? 0}
          />
          <p className="text-xs text-muted-foreground">{labels.fields.reorderPointHelp}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reorderQty">{labels.fields.reorderQty}</Label>
          <Input
            id="reorderQty"
            name="reorderQty"
            type="number"
            min="0"
            defaultValue={initial?.reorderQty ?? 0}
          />
          <p className="text-xs text-muted-foreground">{labels.fields.reorderQtyHelp}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">{labels.fields.status}</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as "ACTIVE" | "ARCHIVED" | "DRAFT")}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">{labels.common.active}</SelectItem>
              <SelectItem value="DRAFT">{labels.common.draft}</SelectItem>
              <SelectItem value="ARCHIVED">{labels.common.archived}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl">
            {labels.fields.imageUrl}{" "}
            <span className="text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Input
            id="imageUrl"
            name="imageUrl"
            type="url"
            defaultValue={initial?.imageUrl ?? ""}
            aria-invalid={!!fieldError("imageUrl")}
          />
          {fieldError("imageUrl") ? (
            <p className="text-xs text-destructive">{fieldError("imageUrl")}</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t pt-6">
        <Button variant="ghost" asChild>
          <Link href={labels.backHref}>{labels.common.cancel}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {mode === "create" ? labels.common.save : labels.common.saveChanges}
        </Button>
      </div>
    </form>
  );
}
