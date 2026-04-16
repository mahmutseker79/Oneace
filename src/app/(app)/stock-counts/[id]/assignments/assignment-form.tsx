"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Department, User, Warehouse } from "@/generated/prisma";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import { createAssignmentAction } from "./actions";

interface AssignmentFormProps {
  countId: string;
  members: Pick<User, "id" | "email" | "name">[];
  departments: Pick<Department, "id" | "name">[];
  warehouses: Pick<Warehouse, "id" | "name" | "code">[];
  isNew: boolean;
}

export function AssignmentForm({
  countId,
  members,
  departments,
  warehouses,
  isNew,
}: AssignmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    userId: "",
    role: "COUNTER",
    departmentId: "",
    warehouseId: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.userId) {
      toast.error("Please select a user");
      return;
    }

    startTransition(async () => {
      const result = await createAssignmentAction({
        countId,
        userId: formData.userId,
        role: formData.role,
        departmentId: formData.departmentId || null,
        warehouseId: formData.warehouseId || null,
      });

      if (result.ok) {
        toast.success("Assignment created");
        router.back();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="user">Counter</Label>
        <Select
          value={formData.userId}
          onValueChange={(value) => setFormData({ ...formData, userId: value })}
          disabled={isPending}
        >
          <SelectTrigger id="user">
            <SelectValue placeholder="Select a user" />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name || member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value) => setFormData({ ...formData, role: value })}
          disabled={isPending}
        >
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COUNTER">Counter</SelectItem>
            <SelectItem value="VERIFIER">Verifier</SelectItem>
            <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
          </SelectContent>
        </Select>
      </div>

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

      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Assignment
      </Button>
    </form>
  );
}
