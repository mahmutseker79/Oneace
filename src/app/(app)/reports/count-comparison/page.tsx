"use client";

import { Download, GitCompareIcon as CompareIcon, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
// Note: getMessages/getRegion are server-only. This client component uses hardcoded strings.
import { hasPlanCapability } from "@/lib/plans";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { cn, formatCurrency } from "@/lib/utils";

interface CountData {
	id: string;
	name: string;
	state: string;
	createdAt: string;
	itemCount: number;
}

interface ComparisonItem {
	itemId: string;
	sku: string;
	name: string;
	count1Qty: number | null;
	count2Qty: number | null;
	variance: number;
	variancePercent: number;
}

export default function CountComparisonPage() {
	const [counts, setCounts] = useState<CountData[]>([]);
	const [comparison, setComparison] = useState<ComparisonItem[]>([]);
	const [selectedCount1, setSelectedCount1] = useState<string>("");
	const [selectedCount2, setSelectedCount2] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [comparing, setComparing] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [t, setT] = useState<any>(null);
	const [region, setRegion] = useState<any>(null);
	const [plan, setPlan] = useState<"FREE" | "PRO" | "BUSINESS">("FREE");

	useEffect(() => {
		async function init() {
			try {
				// server-only: use defaults instead
				const messages = { reports: { heading: "Reports" } } as any;
				const regionData = { numberLocale: "en-US", currency: "USD" };
				setT(messages);
				setRegion(regionData);

				const sessionRes = await fetch("/api/session");
				const sessionData = await sessionRes.json();
				setPlan(sessionData.plan);

				// Fetch available counts
				const countsRes = await fetch("/api/reports/count-comparison/counts");
				const countsData = await countsRes.json();
				setCounts(countsData);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load counts");
			} finally {
				setLoading(false);
			}
		}

		init();
	}, []);

	const handleCompare = async () => {
		if (!selectedCount1 || !selectedCount2) {
			setError("Please select two counts to compare");
			return;
		}

		setComparing(true);
		try {
			const res = await fetch("/api/reports/count-comparison/compare", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					count1Id: selectedCount1,
					count2Id: selectedCount2,
				}),
			});

			if (!res.ok) throw new Error("Comparison failed");

			const data = await res.json();
			setComparison(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Comparison failed");
		} finally {
			setComparing(false);
		}
	};

	const handleExport = async (format: "csv" | "xlsx") => {
		setExporting(true);
		try {
			const res = await fetch("/api/reports/count-comparison/export", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					format,
					comparison,
					count1Name: counts.find((c) => c.id === selectedCount1)?.name,
					count2Name: counts.find((c) => c.id === selectedCount2)?.name,
				}),
			});

			if (!res.ok) throw new Error("Export failed");

			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `count-comparison-${new Date().toISOString().split("T")[0]}.${format}`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Export failed");
		} finally {
			setExporting(false);
		}
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (!t) return <div>Loading...</div>;

	const canViewReport = hasPlanCapability(plan, "reports");

	if (!canViewReport) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Count Comparison"
					description="Compare two stock counts side-by-side"
					backHref="/reports"
					breadcrumb={[
						{ label: "Reports", href: "/reports" },
						{ label: "Count Comparison" },
					]}
				/>
				<UpgradePrompt
					reason="Reports are available on Pro and Business plans."
					requiredPlan="PRO"
					variant="banner"
					description="Upgrade to access advanced reports."
				/>
			</div>
		);
	}

	const varianceStats = {
		totalItems: comparison.length,
		withVariance: comparison.filter((c) => c.variance !== 0).length,
		avgVariance: comparison.length > 0
			? Math.abs(
					comparison.reduce((sum, c) => sum + c.variance, 0) / comparison.length,
				)
			: 0,
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<PageHeader
				title="Count Comparison"
				description="Compare two stock counts side-by-side"
				backHref="/reports"
				breadcrumb={[
					{ label: "Reports", href: "/reports" },
					{ label: "Count Comparison" },
				]}
			/>

			{error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Count Selection */}
			<Card>
				<CardHeader>
					<CardTitle>Select Counts</CardTitle>
					<CardDescription>Choose two counts to compare</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<label className="text-sm font-medium mb-2 block">First Count</label>
							<Select value={selectedCount1} onValueChange={setSelectedCount1}>
								<SelectTrigger>
									<SelectValue placeholder="Select count..." />
								</SelectTrigger>
								<SelectContent>
									{counts.map((count) => (
										<SelectItem key={count.id} value={count.id}>
											{count.name} ({count.itemCount} items)
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-sm font-medium mb-2 block">Second Count</label>
							<Select value={selectedCount2} onValueChange={setSelectedCount2}>
								<SelectTrigger>
									<SelectValue placeholder="Select count..." />
								</SelectTrigger>
								<SelectContent>
									{counts.map((count) => (
										<SelectItem key={count.id} value={count.id}>
											{count.name} ({count.itemCount} items)
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<Button onClick={handleCompare} disabled={comparing || !selectedCount1 || !selectedCount2}>
						{comparing ? "Comparing..." : "Compare Counts"}
					</Button>
				</CardContent>
			</Card>

			{comparison.length > 0 && (
				<>
					{/* Statistics */}
					<div className="grid gap-4 md:grid-cols-3">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Total Items
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">{varianceStats.totalItems}</div>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Items with Variance
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold text-red-600">
									{varianceStats.withVariance}
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									{(
										(varianceStats.withVariance / varianceStats.totalItems) *
										100
									).toFixed(1)}% of items
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Avg Variance
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-bold">
									{varianceStats.avgVariance.toFixed(0)} units
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Export Buttons */}
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleExport("csv")}
							disabled={exporting}
						>
							<Download className="h-4 w-4 mr-1" />
							CSV
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleExport("xlsx")}
							disabled={exporting}
						>
							<Download className="h-4 w-4 mr-1" />
							XLSX
						</Button>
					</div>

					{/* Comparison Table */}
					<Card>
						<CardHeader>
							<CardTitle>Variance Comparison</CardTitle>
							<CardDescription>
								Items with differences between the two counts
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>SKU</TableHead>
											<TableHead>Name</TableHead>
											<TableHead className="text-right">Count 1</TableHead>
											<TableHead className="text-right">Count 2</TableHead>
											<TableHead className="text-right">Variance</TableHead>
											<TableHead className="text-right">% Variance</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{comparison.map((item) => (
											<TableRow key={item.itemId} className={cn(
												item.variance !== 0 && "bg-red-50/50 dark:bg-red-950/20"
											)}>
												<TableCell className="font-mono text-sm">
													{item.sku}
												</TableCell>
												<TableCell>{item.name}</TableCell>
												<TableCell className="text-right font-mono">
													{item.count1Qty ?? "-"}
												</TableCell>
												<TableCell className="text-right font-mono">
													{item.count2Qty ?? "-"}
												</TableCell>
												<TableCell className="text-right font-mono font-bold">
													{item.variance > 0 ? "+" : ""}
													{item.variance}
												</TableCell>
												<TableCell className="text-right font-mono">
													{item.variancePercent.toFixed(1)}%
												</TableCell>
												<TableCell>
													{item.variance === 0 ? (
														<Badge variant="outline" className="bg-green-50">
															Match
														</Badge>
													) : (
														<Badge variant="destructive">
															Mismatch
														</Badge>
													)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</CardContent>
					</Card>
				</>
			)}
		</div>
	);
}
