"use client";

import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { batchUpdateReorderPoints } from "./actions";

type Row = {
	id: string;
	sku: string;
	name: string;
	onHand: number;
	reorderPoint: number;
	reorderQty: number;
};

export type ReorderConfigFormLabels = {
	columnName: string;
	columnSku: string;
	columnOnHand: string;
	columnReorderPoint: string;
	columnReorderQty: string;
	saveCta: string;
	saving: string;
	noChanges: string;
	successToast: string;
	changedCount: string;
};

export function ReorderConfigForm({
	rows,
	labels,
}: {
	rows: Row[];
	labels: ReorderConfigFormLabels;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const { reset: resetUnsaved, setDirty } = useUnsavedWarning();
	const [edits, setEdits] = useState<
		Record<string, { reorderPoint?: number; reorderQty?: number }>
	>({});

	function handleChange(
		id: string,
		field: "reorderPoint" | "reorderQty",
		value: string,
	) {
		const num = value === "" ? 0 : Math.max(0, Number.parseInt(value, 10) || 0);
		setEdits((prev) => ({
			...prev,
			[id]: { ...prev[id], [field]: num },
		}));
		setDirty(true);
	}

	const changedRows = rows.filter((row) => {
		const edit = edits[row.id];
		if (!edit) return false;
		return (
			(edit.reorderPoint !== undefined &&
				edit.reorderPoint !== row.reorderPoint) ||
			(edit.reorderQty !== undefined && edit.reorderQty !== row.reorderQty)
		);
	});

	function handleSave() {
		if (changedRows.length === 0) return;
		const updates = changedRows.map((row) => ({
			id: row.id,
			reorderPoint: edits[row.id]?.reorderPoint ?? row.reorderPoint,
			reorderQty: edits[row.id]?.reorderQty ?? row.reorderQty,
		}));
		startTransition(async () => {
			await batchUpdateReorderPoints(updates);
			toast.success(
				labels.successToast.replace("{count}", String(updates.length)),
			);
			resetUnsaved();
			router.push("/items");
			router.refresh();
		});
	}

	return (
		<>
			<Card>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{labels.columnName}</TableHead>
								<TableHead>{labels.columnSku}</TableHead>
								<TableHead className="text-right">
									{labels.columnOnHand}
								</TableHead>
								<TableHead className="w-32 text-right">
									{labels.columnReorderPoint}
								</TableHead>
								<TableHead className="w-32 text-right">
									{labels.columnReorderQty}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="font-medium">{row.name}</TableCell>
									<TableCell className="font-mono text-xs">{row.sku}</TableCell>
									<TableCell className="text-right tabular-nums">
										{row.onHand}
									</TableCell>
									<TableCell className="text-right">
										<Input
											type="number"
											min={0}
											className="ml-auto h-8 w-20 text-right"
											defaultValue={row.reorderPoint || ""}
											placeholder="0"
											onChange={(e) =>
												handleChange(row.id, "reorderPoint", e.target.value)
											}
										/>
									</TableCell>
									<TableCell className="text-right">
										<Input
											type="number"
											min={0}
											className="ml-auto h-8 w-20 text-right"
											defaultValue={row.reorderQty || ""}
											placeholder="0"
											onChange={(e) =>
												handleChange(row.id, "reorderQty", e.target.value)
											}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
			<div className="flex items-center justify-between">
				<p className="text-xs text-muted-foreground">
					{changedRows.length === 0
						? labels.noChanges
						: labels.changedCount.replace(
								"{count}",
								String(changedRows.length),
							)}
				</p>
				<Button
					onClick={handleSave}
					disabled={isPending || changedRows.length === 0}
				>
					{isPending ? labels.saving : labels.saveCta}
				</Button>
			</div>
		</>
	);
}
