"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

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

import { createCategoryAction } from "./actions";

const NO_PARENT = "__none__";

export type CategoryCreateFormLabels = {
  fields: {
    name: string;
    description: string;
    parent: string;
    parentPlaceholder: string;
  };
  common: {
    save: string;
    optional: string;
    none: string;
  };
  newCategory: string;
  error: string;
};

type ParentOption = { id: string; name: string };

type CategoryCreateFormProps = {
  labels: CategoryCreateFormLabels;
  parents: ParentOption[];
};

export function CategoryCreateForm({ labels, parents }: CategoryCreateFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [parentId, setParentId] = useState<string>(NO_PARENT);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    formData.set("parentId", parentId === NO_PARENT ? "" : parentId);

    startTransition(async () => {
      const result = await createCategoryAction(formData);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      formRef.current?.reset();
      setParentId(NO_PARENT);
      router.refresh();
    });
  }

  function fieldError(name: string): string | undefined {
    return fieldErrors[name]?.[0];
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{labels.fields.name}</Label>
          <Input id="name" name="name" required aria-invalid={!!fieldError("name")} />
          {fieldError("name") ? (
            <p className="text-xs text-destructive">{fieldError("name")}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parent">
            {labels.fields.parent}{" "}
            <span className="text-muted-foreground">({labels.common.optional})</span>
          </Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger id="parent">
              <SelectValue placeholder={labels.fields.parentPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>{labels.common.none}</SelectItem>
              {parents.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          {labels.fields.description}{" "}
          <span className="text-muted-foreground">({labels.common.optional})</span>
        </Label>
        <Textarea id="description" name="description" rows={2} />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          <Plus className="h-4 w-4" />
          {labels.newCategory}
        </Button>
      </div>
    </form>
  );
}
