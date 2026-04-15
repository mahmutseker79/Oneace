"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Department, User, Warehouse } from "@/generated/prisma";

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
import { toast } from "sonner";
import { useState } from "react";

import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from "./actions";

interface DepartmentFormProps {
  department?: Partial<Department> & {
    manager?: (Pick<User, "id" | "email" | "name">) | null;
    warehouse?: (Pick<Warehouse, "id" | "name" | "code">) | null;
  };
  members: Pick<User, "id" | "email" | "name">[];
  warehouses: Pick<Warehouse, "id" | "name" | "code">[];
  isNew: boolean;
}

export function DepartmentForm({
  department,
  members,
  warehouses,
  isNew,
}: DepartmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: department?.name ?? "",
    code: department?.code ?? "",
    color: department?.color ?? "#000000",
    managerId: department?.manager?.id ?? "",
    warehouseId: department?.warehouse?.id ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const action = isNew ? createDepartmentAction : updateDepartmentAction;
      const payload = isNew
        ? formData
        : { id: department!.id, ...formData };

      const result = await action(payload);
      if (result.ok) {
        toast.success(isNew ? "Department created" : "Department updated");
        router.push("/departments");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    setIsDeleting(true);
    startTransition(async () => {
      const result = await deleteDepartmentAction({ id: department!.id });
      setIsDeleting(false);

      if (result.ok) {
        toast.success("Department deleted");
        router.push("/departments");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Department Name</Label>
        <Input
          id="name"
          placeholder="e.g., Receiving"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={isPending}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Code (Optional)</Label>
        <Input
          id="code"
          placeholder="e.g., REC"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color">Color</Label>
        <div className="flex items-center gap-2">
          <input
            id="color"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            disabled={isPending}
            className="h-10 w-20 cursor-pointer rounded border"
          />
          <span className="text-sm text-muted-foreground">{formData.color}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="manager">Manager (Optional)</Label>
        <Select
          value={formData.managerId}
          onValueChange={(value) => setFormData({ ...formData, managerId: value })}
          disabled={isPending}
        >
          <SelectTrigger id="manager">
            <SelectValue placeholder="Select a manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No manager</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name || member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="warehouse">Primary Warehouse (Optional)</Label>
        <Select
          value={formData.warehouseId}
          onValueChange={(value) => setFormData({ ...formData, warehouseId: value })}
          disabled={isPending}
        >
          <SelectTrigger id="warehouse">
            <SelectValue placeholder="Select a warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No warehouse</SelectItem>
            {warehouses.map((wh) => (
              <SelectItem key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isNew ? "Create Department" : "Save Changes"}
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
