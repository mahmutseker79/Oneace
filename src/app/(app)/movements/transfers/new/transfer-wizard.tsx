"use client";

import {
	ArrowRight,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Loader2,
	Plus,
	ScanLine,
	Trash2,
	TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { scanError, scanSuccess } from "@/lib/scanner/feedback";
import type { CreateTransferInput } from "@/lib/validation/transfer";
import { createTransferAction } from "./actions";

// ---------------------------------------------------------------------------
// Prop types — passed from the server component
// ---------------------------------------------------------------------------

export type WarehouseOption = {
	id: string;
	name: string;
	code: string;
};

export type ItemOption = {
	id: string;
	name: string;
	sku: string;
	/** Phase 11.4: barcode for client-side scan matching. null when item has no barcode. */
	barcode?: string | null;
	/** On-hand quantity at a given warehouse; populated when warehouse is selected */
	onHand?: number;
};

export type StockSnapshot = {
	itemId: string;
	warehouseId: string;
	quantity: number;
};

export type TransferWizardLabels = {
	stepLocations: string;
	stepItems: string;
	stepReview: string;
	from: string;
	to: string;
	fromPlaceholder: string;
	toPlaceholder: string;
	sameWarehouseError: string;
	itemsHeading: string;
	addItem: string;
	item: string;
	itemPlaceholder: string;
	quantity: string;
	onHand: string;
	onHandInsufficient: string;
	remove: string;
	noItemsError: string;
	reviewHeading: string;
	reviewFrom: string;
	reviewTo: string;
	reviewItem: string;
	reviewQty: string;
	reviewOnHand: string;
	reference: string;
	referencePlaceholder: string;
	note: string;
	notePlaceholder: string;
	back: string;
	next: string;
	submit: string;
	submitting: string;
	successMessage: string;
	errorMessage: string;
	cancel: string;
	// Phase 11.4 — scan input
	scanInputLabel: string;
	scanInputPlaceholder: string;
	scanInputHint: string;
	scanMatched: string;
	scanIncremented: string;
	scanNotFound: string;
};

type TransferWizardProps = {
	warehouses: WarehouseOption[];
	items: ItemOption[];
	stockSnapshot: StockSnapshot[];
	labels: TransferWizardLabels;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "locations" | "items" | "review";

type LineDraft = {
	key: string;
	itemId: string;
	quantity: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateKey(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2);
}

function generateIdempotencyKey(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

function getOnHand(
	snapshot: StockSnapshot[],
	itemId: string,
	warehouseId: string,
): number {
	return (
		snapshot.find((s) => s.itemId === itemId && s.warehouseId === warehouseId)
			?.quantity ?? 0
	);
}

// ---------------------------------------------------------------------------
// Scan matching logic (pure — exported for tests)
// ---------------------------------------------------------------------------

/**
 * Phase 11.4 — Find an item in the catalog by scanned code.
 *
 * Match priority:
 *   1. item.barcode (exact match)
 *   2. item.sku    (case-insensitive)
 *
 * Returns the matched ItemOption or null.
 */
export function matchItemByCode(
	items: ItemOption[],
	code: string,
): ItemOption | null {
	const trimmed = code.trim();
	if (!trimmed) return null;

	// Priority 1: barcode exact match
	const byBarcode = items.find(
		(i) => i.barcode != null && i.barcode !== "" && i.barcode === trimmed,
	);
	if (byBarcode) return byBarcode;

	// Priority 2: SKU case-insensitive
	const lower = trimmed.toLowerCase();
	return items.find((i) => i.sku.toLowerCase() === lower) ?? null;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
	steps,
	current,
}: {
	steps: { id: Step; label: string }[];
	current: Step;
}) {
	const currentIndex = steps.findIndex((s) => s.id === current);
	return (
		<nav aria-label="Transfer steps" className="flex items-center gap-2">
			{steps.map((step, index) => {
				const done = index < currentIndex;
				const active = step.id === current;
				return (
					<div key={step.id} className="flex items-center gap-2">
						<div
							className={[
								"flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
								done
									? "bg-primary text-primary-foreground"
									: active
										? "border-2 border-primary text-primary"
										: "border border-muted-foreground/30 text-muted-foreground",
							]
								.filter(Boolean)
								.join(" ")}
						>
							{done ? <Check className="h-3.5 w-3.5" /> : index + 1}
						</div>
						<span
							className={[
								"text-sm",
								active
									? "font-medium text-foreground"
									: "text-muted-foreground",
							]
								.filter(Boolean)
								.join(" ")}
						>
							{step.label}
						</span>
						{index < steps.length - 1 ? (
							<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
						) : null}
					</div>
				);
			})}
		</nav>
	);
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function TransferWizard({
	warehouses,
	items,
	stockSnapshot,
	labels,
}: TransferWizardProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const { reset: resetUnsaved, setDirty } = useUnsavedWarning();

	// ── Step state ────────────────────────────────────────────────────────────
	const [step, setStep] = useState<Step>("locations");

	// ── Step 1: Locations ─────────────────────────────────────────────────────
	const [fromId, setFromId] = useState<string>("");
	const [toId, setToId] = useState<string>("");

	// ── Step 2: Items ─────────────────────────────────────────────────────────
	const [lines, setLines] = useState<LineDraft[]>([
		{ key: generateKey(), itemId: "", quantity: "" },
	]);

	// ── Step 3: Review ────────────────────────────────────────────────────────
	const [reference, setReference] = useState<string>("");
	const [note, setNote] = useState<string>("");

	// ── Errors ────────────────────────────────────────────────────────────────
	const [locationError, setLocationError] = useState<string | null>(null);
	const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
	const [submitError, setSubmitError] = useState<string | null>(null);

	// ── Phase 11.4: scan state ────────────────────────────────────────────────
	const [scanValue, setScanValue] = useState("");
	const [scanStatus, setScanStatus] = useState<
		"idle" | "matched" | "incremented" | "not-found"
	>("idle");
	// Refs to each quantity input so we can auto-focus after a scan
	const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({});

	// ── Derived data ──────────────────────────────────────────────────────────

	const fromWarehouse = useMemo(
		() => warehouses.find((w) => w.id === fromId),
		[warehouses, fromId],
	);
	const toWarehouse = useMemo(
		() => warehouses.find((w) => w.id === toId),
		[warehouses, toId],
	);

	const destinationOptions = useMemo(
		() => warehouses.filter((w) => w.id !== fromId),
		[warehouses, fromId],
	);

	// Items that haven't already been added to the lines (for new line selects)
	function availableItemsForLine(lineKey: string): ItemOption[] {
		const usedIds = new Set(
			lines
				.filter((l) => l.key !== lineKey && l.itemId !== "")
				.map((l) => l.itemId),
		);
		return items.filter((item) => !usedIds.has(item.id));
	}

	// ── Step 1 handlers ───────────────────────────────────────────────────────

	function handleFromChange(value: string) {
		setFromId(value);
		// Reset destination if it's now the same
		if (value === toId) setToId("");
		setLocationError(null);
		setDirty(true);
	}

	function handleToChange(value: string) {
		setToId(value);
		setLocationError(null);
		setDirty(true);
	}

	function validateLocations(): boolean {
		if (!fromId) {
			setLocationError("Please select a source location.");
			return false;
		}
		if (!toId) {
			setLocationError("Please select a destination location.");
			return false;
		}
		if (fromId === toId) {
			setLocationError(labels.sameWarehouseError);
			return false;
		}
		return true;
	}

	// ── Step 2 handlers ───────────────────────────────────────────────────────

	function addLine() {
		setLines((prev) => [
			...prev,
			{ key: generateKey(), itemId: "", quantity: "" },
		]);
	}

	function removeLine(key: string) {
		setLines((prev) => prev.filter((l) => l.key !== key));
		setLineErrors((prev) => {
			const next = { ...prev };
			delete next[key];
			return next;
		});
	}

	function setLineItem(key: string, itemId: string) {
		setLines((prev) => prev.map((l) => (l.key === key ? { ...l, itemId } : l)));
		setLineErrors((prev) => {
			const next = { ...prev };
			delete next[key];
			return next;
		});
	}

	function setLineQty(key: string, qty: string) {
		setLines((prev) =>
			prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l)),
		);
	}

	function validateLines(): boolean {
		const errors: Record<string, string> = {};
		const seenItems = new Set<string>();
		let valid = true;

		for (const line of lines) {
			if (!line.itemId) {
				errors[line.key] = "Select an item.";
				valid = false;
				continue;
			}
			if (seenItems.has(line.itemId)) {
				errors[line.key] = "Item already added — combine quantities instead.";
				valid = false;
				continue;
			}
			seenItems.add(line.itemId);

			const qty = Number(line.quantity);
			if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
				errors[line.key] = "Enter a valid whole number (≥ 1).";
				valid = false;
			}
		}

		if (lines.length === 0) {
			valid = false;
		}

		setLineErrors(errors);
		return valid;
	}

	// ── Phase 11.4: scan handler ──────────────────────────────────────────────

	/**
	 * Handle a scanned/typed code in Step 2.
	 *
	 * Three outcomes:
	 *   1. Item already in lines → increment its quantity by 1.
	 *   2. Item not yet in lines → reuse the first empty line or add a new one; qty=1.
	 *   3. Item not found → show error, no state change.
	 */
	const handleTransferScan = useCallback(
		(code: string) => {
			const trimmed = code.trim();
			if (!trimmed) return;

			const matched = matchItemByCode(items, trimmed);

			if (!matched) {
				setScanStatus("not-found");
				scanError();
				return;
			}

			// Check if this item is already a line
			const existingLine = lines.find((l) => l.itemId === matched.id);

			if (existingLine) {
				// Increment quantity by 1
				setLines((prev) =>
					prev.map((l) => {
						if (l.key !== existingLine.key) return l;
						const current = Number(l.quantity) || 0;
						return { ...l, quantity: String(current + 1) };
					}),
				);
				setScanStatus("incremented");
				scanSuccess();
				// Focus the quantity input for this line
				const ref = quantityRefs.current[existingLine.key];
				if (ref) {
					ref.focus();
					ref.select();
				}
			} else {
				// Find the first empty line to reuse, or add a new one
				const emptyLine = lines.find((l) => l.itemId === "");
				if (emptyLine) {
					setLines((prev) =>
						prev.map((l) =>
							l.key === emptyLine.key
								? { ...l, itemId: matched.id, quantity: "1" }
								: l,
						),
					);
					setScanStatus("matched");
					scanSuccess();
					// Focus the quantity input for the filled line
					const ref = quantityRefs.current[emptyLine.key];
					if (ref) {
						ref.focus();
						ref.select();
					}
				} else {
					// All existing lines have items — add a new line
					const newKey = generateKey();
					setLines((prev) => [
						...prev,
						{ key: newKey, itemId: matched.id, quantity: "1" },
					]);
					setScanStatus("matched");
					scanSuccess();
					// Focus will happen after React re-renders via the ref callback
				}
				// Clear any error on this line from previous validation
				setLineErrors((prev) => {
					const next = { ...prev };
					const targetKey = lines.find((l) => l.itemId === "")?.key;
					if (targetKey) delete next[targetKey];
					return next;
				});
			}
		},
		[items, lines],
	);

	function handleScanSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		handleTransferScan(scanValue);
		setScanValue("");
	}

	// ── Navigation ────────────────────────────────────────────────────────────

	function goNext() {
		if (step === "locations") {
			if (!validateLocations()) return;
			setStep("items");
		} else if (step === "items") {
			if (!validateLines()) return;
			setStep("review");
		}
	}

	function goBack() {
		if (step === "items") setStep("locations");
		else if (step === "review") setStep("items");
	}

	// ── Submit ────────────────────────────────────────────────────────────────

	const handleSubmit = useCallback(() => {
		setSubmitError(null);

		const validLines = lines
			.filter((l) => l.itemId && Number(l.quantity) >= 1)
			.map((l) => ({
				itemId: l.itemId,
				quantity: Math.trunc(Number(l.quantity)),
			}));

		const input: CreateTransferInput = {
			fromWarehouseId: fromId,
			toWarehouseId: toId,
			lines: validLines,
			reference: reference.trim() || null,
			note: note.trim() || null,
		};

		// Generate one idempotency key per line before the async call so a
		// resubmit uses the same keys (preventing double-apply).
		const idempotencyKeys = validLines.map(() => generateIdempotencyKey());

		startTransition(async () => {
			const result = await createTransferAction(input, idempotencyKeys);
			if (result.ok) {
				resetUnsaved();
				router.push("/movements?type=TRANSFER");
				router.refresh();
			} else {
				setSubmitError(result.error);
			}
		});
	}, [fromId, toId, lines, reference, note, router, resetUnsaved]);

	// ── Step definitions ──────────────────────────────────────────────────────

	const stepDefs = [
		{ id: "locations" as Step, label: labels.stepLocations },
		{ id: "items" as Step, label: labels.stepItems },
		{ id: "review" as Step, label: labels.stepReview },
	];

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div className="max-w-2xl space-y-6">
			<StepIndicator steps={stepDefs} current={step} />

			{/* ── Step 1: Locations ─────────────────────────────────────── */}
			{step === "locations" ? (
				<Card>
					<CardHeader>
						<CardTitle>{labels.stepLocations}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="space-y-2">
							<Label htmlFor="transfer-from">{labels.from}</Label>
							<Select value={fromId} onValueChange={handleFromChange}>
								<SelectTrigger id="transfer-from">
									<SelectValue placeholder={labels.fromPlaceholder} />
								</SelectTrigger>
								<SelectContent>
									{warehouses.map((w) => (
										<SelectItem key={w.id} value={w.id}>
											{w.name}
											<span className="ml-2 text-xs text-muted-foreground">
												{w.code}
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="transfer-to">{labels.to}</Label>
							<Select
								value={toId}
								onValueChange={handleToChange}
								disabled={!fromId}
							>
								<SelectTrigger id="transfer-to">
									<SelectValue placeholder={labels.toPlaceholder} />
								</SelectTrigger>
								<SelectContent>
									{destinationOptions.map((w) => (
										<SelectItem key={w.id} value={w.id}>
											{w.name}
											<span className="ml-2 text-xs text-muted-foreground">
												{w.code}
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{locationError ? (
							<p className="text-sm text-destructive">{locationError}</p>
						) : null}

						<div className="flex justify-end gap-2 pt-2">
							<Button variant="ghost" onClick={() => router.back()}>
								{labels.cancel}
							</Button>
							<Button onClick={goNext} disabled={!fromId || !toId}>
								{labels.next}
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}

			{/* ── Step 2: Items ─────────────────────────────────────────── */}
			{step === "items" ? (
				<Card>
					<CardHeader>
						<CardTitle>
							{labels.stepItems}
							{fromWarehouse && toWarehouse ? (
								<span className="ml-2 text-sm font-normal text-muted-foreground">
									{fromWarehouse.name} → {toWarehouse.name}
								</span>
							) : null}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Phase 11.4: scan input panel */}
						<div className="rounded-md border bg-muted/30 p-3 space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium">
								<ScanLine className="h-4 w-4 text-muted-foreground" />
								{labels.scanInputLabel}
							</div>
							<form onSubmit={handleScanSubmit} className="flex gap-2">
								<Input
									type="text"
									value={scanValue}
									onChange={(e) => {
										setScanValue(e.target.value);
										setScanStatus("idle");
									}}
									placeholder={labels.scanInputPlaceholder}
									autoComplete="off"
									className="font-mono"
									aria-label={labels.scanInputLabel}
								/>
								<Button
									type="submit"
									variant="secondary"
									disabled={!scanValue.trim()}
									className="shrink-0"
								>
									<ScanLine className="h-4 w-4" />
								</Button>
							</form>
							<p className="text-xs text-muted-foreground">
								{labels.scanInputHint}
							</p>
							{scanStatus === "not-found" ? (
								<div
									className="flex items-center gap-1.5 text-xs text-destructive"
									role="alert"
								>
									<TriangleAlert className="h-3.5 w-3.5" />
									{labels.scanNotFound}
								</div>
							) : null}
							{scanStatus === "matched" ? (
								<div className="flex items-center gap-1.5 text-xs text-emerald-600">
									<CheckCircle2 className="h-3.5 w-3.5" />
									{labels.scanMatched}
								</div>
							) : null}
							{scanStatus === "incremented" ? (
								<div className="flex items-center gap-1.5 text-xs text-emerald-600">
									<CheckCircle2 className="h-3.5 w-3.5" />
									{labels.scanIncremented}
								</div>
							) : null}
						</div>

						{lines.map((line, index) => {
							const onHand = line.itemId
								? getOnHand(stockSnapshot, line.itemId, fromId)
								: null;
							const qty = Number(line.quantity);
							const insufficient =
								onHand !== null && Number.isFinite(qty) && qty > onHand;
							const error = lineErrors[line.key];

							return (
								<div key={line.key} className="rounded-md border p-3 space-y-3">
									<div className="flex items-center justify-between">
										<span className="text-xs font-medium text-muted-foreground">
											Item {index + 1}
										</span>
										{lines.length > 1 ? (
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
												onClick={() => removeLine(line.key)}
												aria-label={labels.remove}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										) : null}
									</div>

									<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
										<div className="space-y-1.5">
											<Label htmlFor={`item-${line.key}`} className="text-xs">
												{labels.item}
											</Label>
											<Select
												value={line.itemId}
												onValueChange={(v) => setLineItem(line.key, v)}
											>
												<SelectTrigger id={`item-${line.key}`}>
													<SelectValue placeholder={labels.itemPlaceholder} />
												</SelectTrigger>
												<SelectContent>
													{availableItemsForLine(line.key).map((item) => (
														<SelectItem key={item.id} value={item.id}>
															{item.name}
															<span className="ml-2 text-xs text-muted-foreground">
																{item.sku}
															</span>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-1.5">
											<Label htmlFor={`qty-${line.key}`} className="text-xs">
												{labels.quantity}
											</Label>
											<Input
												ref={(el) => {
													quantityRefs.current[line.key] = el;
												}}
												id={`qty-${line.key}`}
												type="number"
												min={1}
												step={1}
												value={line.quantity}
												onChange={(e) => setLineQty(line.key, e.target.value)}
												className="w-24"
											/>
										</div>
									</div>

									{line.itemId && onHand !== null ? (
										<div className="flex items-center gap-1.5 text-xs">
											{insufficient ? (
												<>
													<TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
													<span className="text-amber-600">
														{labels.onHandInsufficient} ({onHand} on hand)
													</span>
												</>
											) : (
												<span className="text-muted-foreground">
													{labels.onHand}: {onHand}
												</span>
											)}
										</div>
									) : null}

									{error ? (
										<p className="text-xs text-destructive">{error}</p>
									) : null}
								</div>
							);
						})}

						{lines.length === 0 ? (
							<p className="text-sm text-destructive">{labels.noItemsError}</p>
						) : null}

						<Button
							variant="outline"
							size="sm"
							onClick={addLine}
							disabled={lines.length >= items.length}
						>
							<Plus className="h-3.5 w-3.5" />
							{labels.addItem}
						</Button>

						<div className="flex justify-between pt-2">
							<Button variant="ghost" onClick={goBack}>
								<ChevronLeft className="h-4 w-4" />
								{labels.back}
							</Button>
							<Button
								onClick={goNext}
								disabled={lines.length === 0 || lines.some((l) => !l.itemId)}
							>
								{labels.next}
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}

			{/* ── Step 3: Review ────────────────────────────────────────── */}
			{step === "review" ? (
				<Card>
					<CardHeader>
						<CardTitle>{labels.stepReview}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-5">
						{/* Route summary */}
						<div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
							<span className="font-medium">{fromWarehouse?.name}</span>
							<Badge variant="outline" className="shrink-0">
								{fromWarehouse?.code}
							</Badge>
							<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
							<span className="font-medium">{toWarehouse?.name}</span>
							<Badge variant="outline" className="shrink-0">
								{toWarehouse?.code}
							</Badge>
						</div>

						{/* Line summary */}
						<div className="overflow-x-auto rounded-md border">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
										<th className="px-3 py-2 text-left">{labels.reviewItem}</th>
										<th className="px-3 py-2 text-right">{labels.reviewQty}</th>
										<th className="px-3 py-2 text-right">
											{labels.reviewOnHand}
										</th>
									</tr>
								</thead>
								<tbody>
									{lines
										.filter((l) => l.itemId && Number(l.quantity) >= 1)
										.map((line) => {
											const item = items.find((i) => i.id === line.itemId);
											const onHand = getOnHand(
												stockSnapshot,
												line.itemId,
												fromId,
											);
											const qty = Math.trunc(Number(line.quantity));
											const insufficient = qty > onHand;
											return (
												<tr key={line.key} className="border-b last:border-0">
													<td className="px-3 py-2">
														<div>{item?.name ?? line.itemId}</div>
														<div className="text-xs text-muted-foreground">
															{item?.sku}
														</div>
													</td>
													<td className="px-3 py-2 text-right font-medium">
														{qty}
													</td>
													<td className="px-3 py-2 text-right">
														{insufficient ? (
															<span className="text-amber-600">
																<TriangleAlert className="mr-1 inline h-3.5 w-3.5" />
																{onHand}
															</span>
														) : (
															<span className="text-muted-foreground">
																{onHand}
															</span>
														)}
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>

						{/* Reference + note */}
						<div className="space-y-3">
							<div className="space-y-1.5">
								<Label htmlFor="transfer-reference">{labels.reference}</Label>
								<Input
									id="transfer-reference"
									type="text"
									placeholder={labels.referencePlaceholder}
									maxLength={120}
									value={reference}
									onChange={(e) => setReference(e.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="transfer-note">{labels.note}</Label>
								<Textarea
									id="transfer-note"
									placeholder={labels.notePlaceholder}
									maxLength={1000}
									rows={3}
									value={note}
									onChange={(e) => setNote(e.target.value)}
								/>
							</div>
						</div>

						{submitError ? (
							<div
								role="alert"
								className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
							>
								{submitError}
							</div>
						) : null}

						<div className="flex justify-between pt-2">
							<Button variant="ghost" onClick={goBack} disabled={isPending}>
								<ChevronLeft className="h-4 w-4" />
								{labels.back}
							</Button>
							<Button onClick={handleSubmit} disabled={isPending}>
								{isPending ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										{labels.submitting}
									</>
								) : (
									labels.submit
								)}
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
