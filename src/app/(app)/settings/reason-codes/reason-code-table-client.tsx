"use client";

import { Edit2, Plus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReasonCategory, ReasonCode } from "@/generated/prisma";
import { toggleReasonCodeActiveAction } from "./actions";
import { ReasonCodeForm } from "./reason-code-form";

type ReasonCodeTableClientProps = {
  reasonCodes: ReasonCode[];
  categoryLabels: Record<ReasonCategory, string>;
  categoryColors: Record<ReasonCategory, string>;
};

export function ReasonCodeTableClient({
  reasonCodes,
  categoryLabels,

}: ReasonCodeTableClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<ReasonCode | null>(null);
  const [isTogglingActive, setIsTogglingActive] = useState<Record<string, boolean>>({});

  const categories: ReasonCategory[] = [
    "VARIANCE",
    "ADJUSTMENT",
    "TRANSFER",
    "RETURN",
    "DISPOSAL",
    "COUNT",
    "OTHER",
  ];

  const openForm = (code?: ReasonCode) => {
    if (code) {
      setSelectedCode(code);
    } else {
      setSelectedCode(null);
    }
    setFormOpen(true);
  };

  const handleToggleActive = async (id: string) => {
    setIsTogglingActive((prev) => ({ ...prev, [id]: true }));
    try {
      await toggleReasonCodeActiveAction(id);
    } finally {
      setIsTogglingActive((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Group codes by category
  const groupedCodes = new Map<ReasonCategory, ReasonCode[]>();
  for (const code of reasonCodes) {
    if (!groupedCodes.has(code.category)) {
      groupedCodes.set(code.category, []);
    }
    groupedCodes.get(code.category)?.push(code);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openForm()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Reason Code
        </Button>
      </div>

      <Tabs defaultValue="VARIANCE" className="w-full">
        <TabsList>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {categoryLabels[cat]}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => {
          const codes = groupedCodes.get(category) || [];
          return (
            <TabsContent key={category} value={category} className="space-y-4">
              {codes.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No reason codes in this category
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {categoryLabels[category]} ({codes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {codes.map((code) => (
                          <TableRow key={code.id}>
                            <TableCell className="font-mono font-semibold">{code.code}</TableCell>
                            <TableCell>{code.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                              {code.description || "—"}
                            </TableCell>
                            <TableCell>
                              {code.isActive ? (
                                <Badge variant="outline" className="bg-success-light">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="sm" onClick={() => openForm(code)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(code.id)}
                                disabled={isTogglingActive[code.id]}
                              >
                                {code.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <ReasonCodeForm open={formOpen} onOpenChange={setFormOpen} reasonCode={selectedCode} />
    </div>
  );
}
