"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Department, Item, Warehouse } from "@/generated/prisma";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";

import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from "./actions";

interface TemplateFormProps {
  template?: {
    id: string;
    name: string;
    description?: string | null;
    methodology: string;
    scope: string;
    departmentId?: string | null;
    warehouseId?: string | null;
    itemIds: string[];
    requiresApproval: boolean;
    cronExpression?: string | null;
  };
  items: Pick<Item, "id" | "sku" | "name">[];
  departments: Pick<Department, "id" | "name">[];
  warehouses: Pick<Warehouse, "id" | "name" | "code">[];
  isNew: boolean;
}

export function TemplateForm({
  template,
  items,
  departments,
  warehouses,
  isNew,
}: TemplateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: template?.name ?? "",
    description: template?.description ?? "",
    methodology: template?.methodology ?? "FULL",
    scope: template?.scope ?? "FULL",
    departmentId: template?.departmentId ?? "",
    warehouseId: template?.warehouseId ?? "",
    itemIds: template?.itemIds ?? [],
    requiresApproval: template?.requiresApproval ?? false,
    cronExpression: template?.cronExpression ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const action = isNew ? createTemplateAction : updateTemplateAction;
      const payload = isNew ? formData : { id: template?.id, ...formData };

      const result = await action(payload);
      if (result.ok) {
        toast.success(isNew ? "Template created" : "Template updated");
        router.push("/stock-counts/templates");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    setIsDeleting(true);
    startTransition(async () => {
      const result = await deleteTemplateAction({ id: template?.id });
      setIsDeleting(false);

      if (result.ok) {
        toast.success("Template deleted");
        router.push("/stock-counts/templates");
      } else {
        toast.error(result.error);
      }
    });
  };

  const toggleItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      itemIds: prev.itemIds.includes(itemId)
        ? prev.itemIds.filter((id) => id !== itemId)
        : [...prev.itemIds, itemId],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          placeholder="e.g., Weekly Full Count"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={isPending}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          placeholder="Notes about this template..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          disabled={isPending}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="methodology">Methodology</Label>
          <Select
            value={formData.methodology}
            onValueChange={(value) => setFormData({ ...formData, methodology: value })}
            disabled={isPending}
          >
            <SelectTrigger id="methodology">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL">Full</SelectItem>
              <SelectItem value="CYCLE">Cycle</SelectItem>
              <SelectItem value="SPOT">Spot</SelectItem>
              <SelectItem value="BLIND">Blind</SelectItem>
              <SelectItem value="DOUBLE_BLIND">Double Blind</SelectItem>
              <SelectItem value="DIRECTED">Directed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="scope">Scope</Label>
          <Select
            value={formData.scope}
            onValueChange={(value) => setFormData({ ...formData, scope: value })}
            disabled={isPending}
          >
            <SelectTrigger id="scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL">Full Inventory</SelectItem>
              <SelectItem value="PARTIAL">Partial (Selected Items)</SelectItem>
              <SelectItem value="DEPARTMENT">Department</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Department (Optional)</Label>
          <Select
            value={formData.departmentId}
            onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
            disabled={isPending}
          >
            <SelectTrigger id="department">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="warehouse">Warehouse (Optional)</Label>
          <Select
            value={formData.warehouseId}
            onValueChange={(value) => setFormData({ ...formData, warehouseId: value })}
            disabled={isPending}
          >
            <SelectTrigger id="warehouse">
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Items ({formData.itemIds.length} selected)</Label>
        <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center space-x-2">
              <Checkbox
                id={item.id}
                checked={formData.itemIds.includes(item.id)}
                onCheckedChange={() => toggleItem(item.id)}
                disabled={isPending}
              />
              <label htmlFor={item.id} className="flex-1 cursor-pointer text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground ml-2">({item.sku})</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cron">Schedule (Cron Expression, Optional)</Label>
        <Input
          id="cron"
          placeholder="e.g., 0 9 * * MON (Every Monday at 9am)"
          value={formData.cronExpression}
          onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="approval"
          checked={formData.requiresApproval}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, requiresApproval: checked as boolean })
          }
          disabled={isPending}
        />
        <label htmlFor="approval" className="text-sm cursor-pointer">
          Requires approval before posting to inventory
        </label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isNew ? "Create Template" : "Save Changes"}
        </Button>

        {!isNew && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
