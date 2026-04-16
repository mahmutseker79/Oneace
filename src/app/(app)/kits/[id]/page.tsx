// Kit detail page
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Kit {
  name: string;
  parentItemId: string;
  type: string;
  components?: Array<{ id: string; componentItemId: string; variantId?: string; quantityPerKit: number }>;
  active: boolean;
}

export default function KitDetailPage({ params: _params }: { params: { id: string } }) {
  const [kit] = useState<Kit | null>(null);
  const [assembleQty, setAssembleQty] = useState(1);
  const [disassembleQty, setDisassembleQty] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useState(() => {
    // TODO: Fetch kit by ID
    setIsLoading(false);
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!kit) {
    return <div>Kit not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{kit.name}</h1>
        <p className="text-muted-foreground">Parent Item: {kit.parentItemId}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="font-semibold">{kit.type}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Components</p>
          <p className="font-semibold">{kit.components?.length || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="font-semibold">{kit.active ? "Yes" : "No"}</p>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/50 border-b px-6 py-3">
          <h2 className="font-semibold">Components</h2>
        </div>
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">Item ID</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Variant</th>
              <th className="px-6 py-3 text-center text-sm font-medium">Qty per Kit</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {kit.components?.map((comp) => (
              <tr key={comp.id} className="hover:bg-muted/50">
                <td className="px-6 py-3 text-sm font-medium">{comp.componentItemId}</td>
                <td className="px-6 py-3 text-sm text-muted-foreground">{comp.variantId || "—"}</td>
                <td className="px-6 py-3 text-sm text-center">{comp.quantityPerKit}</td>
                <td className="px-6 py-3 text-sm">
                  <button className="text-red-600 hover:underline text-xs">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold">Assemble Kit</h3>
          <p className="text-sm text-muted-foreground">Combine components into parent item</p>
          <div>
            <label className="block text-sm font-medium mb-2">Quantity to Assemble</label>
            <Input
              type="number"
              min="1"
              value={assembleQty}
              onChange={(e) => setAssembleQty(Number.parseInt(e.target.value) || 1)}
            />
          </div>
          <Button className="w-full">Assemble</Button>
        </div>

        <div className="rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold">Disassemble Kit</h3>
          <p className="text-sm text-muted-foreground">Break kit back into components</p>
          <div>
            <label className="block text-sm font-medium mb-2">Quantity to Disassemble</label>
            <Input
              type="number"
              min="1"
              value={disassembleQty}
              onChange={(e) => setDisassembleQty(Number.parseInt(e.target.value) || 1)}
            />
          </div>
          <Button className="w-full" variant="outline">
            Disassemble
          </Button>
        </div>
      </div>
    </div>
  );
}
