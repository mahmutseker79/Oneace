"use client";

import { Download, Building2, AlertCircle, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getMessages, getRegion } from "@/lib/i18n";
import { hasPlanCapability } from "@/lib/plans";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { cn, formatCurrency } from "@/lib/utils";

interface DepartmentVariance {
	departmentId: string;
	departmentName: string;
	itemCount: number;
	variance: number;
	variancePercent: number;
	status: "good" | "warning" | "critical";
}

export default function DepartmentVariancePage() {
	const [data, setData] = useState<DepartmentVariance[]>([]);
	const [loading, setLoading] = useState(true);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [t, setT] = useState<any>(null);
	const [region, setRegion] = useState<any>(null);
	const [plan, setPlan] = useState<"FREE" | "PRO" | "BUSINESS">("FREE");

	useEffect(() => {
		async function init() {
			try {
				const messages = await getMessages();
				const regionData = await getRegion();
				setT(messages);
				setRegion(regionData);

				const sessionRes = await fetch("/api/session");
				const sessionData = await sessionRes.json();
				setPlan(sessionData.plan);

				// Fetch variance data
				const res = await fetch("/api/reports/department-variance");
				if (!res.ok) throw new Error("Failed to fetch data");
				const varianceData = await res.json();
				setData(varianceData);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load data");
			} finally {
				setLoading(false);
			}
		}

		init();
	}, []);

	const handleExport = async (format: "csv" | "xlsx") => {
		setExporting(true);
		try {
			const res = await fetch("/api/reports/department-variance/export", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ format, data }),
			});

			if (!res.ok) throw new Error("Export failed");

			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `department-variance-${new Date().toISOString().split("T")[0]}.${format}`;
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
				<div className="flex items-start gap-3">
					<Building2 className="text-muted-foreground mt-1 h-5 w-5" />
					<div>
						<h1 className="text-2xl font-semibold">Department Variance</h1>
						<p className="text-muted-foreground">Variance by department</p>
					</div>
				</div>
				<UpgradePrompt
					reason="Reports are available on Pro and Business plans."
					requiredPlan="PRO"
					variant="banner"
					description="Upgrade to access advanced reports."
				/>
			</div>
		);
	}

	const avgVariance = data.length > 0 ? data.reduce((sum, d) => sum + d.variancePercent, 0) / data.length : 0;
	const criticalDepts = data.filter((d) => d.status === "critical").length;

	const chartData = data.map((d) => ({
		name: d.departmentName,
		variance: d.variancePercent,
		items: d.itemCount,
	}));

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<Building2 className="text-muted-foreground mt-1 h-5 w-5" />
					<div>
						<h1 className="text-2xl font-semibold">Department Variance</h1>
						<p className="text-muted-foreground">
							Variance analysis by department
						</p>
					</div>
				</div>
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
			</div>

			{error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{criticalDepts > 0 && (
				<Alert variant="destructive">
					<TrendingDown className="h-4 w-4" />
					<AlertTitle>High Variance Departments</AlertTitle>
					<AlertDescription>
						{criticalDepts} department(s) with variance above 10%
					</AlertDescription>
				</Alert>
			)}

			{/* KPI Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Departments
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{data.length}</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Average Variance
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{avgVariance.toFixed(1)}%</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Critical Issues
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className={cn("text-2xl font-bold", criticalDepts > 0 && "text-red-600")}>
							{criticalDepts}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Variance Chart */}
			{data.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Variance by Department</CardTitle>
						<CardDescription>
							Percentage variance across departments
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ResponsiveContainer width="100%" height={300}>
							<BarChart data={chartData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="name" />
								<YAxis />
								<Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
								<Legend />
								<Bar
									dataKey="variance"
									fill="hsl(0, 84%, 60%)"
									name="Variance %"
								/>
							</BarChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}

			{/* Summary Table */}
			<Card>
				<CardHeader>
					<CardTitle>Department Summary</CardTitle>
					<CardDescription>Detailed variance metrics per department</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Department</TableHead>
									<TableHead className="text-right">Items</TableHead>
									<TableHead className="text-right">Variance</TableHead>
									<TableHead className="text-right">Variance %</TableHead>
									<TableHead className="text-center">Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.map((dept) => (
									<TableRow key={dept.departmentId} className={cn(
										dept.status === "critical" && "bg-red-50/50 dark:bg-red-950/20",
										dept.status === "warning" && "bg-yellow-50/50 dark:bg-yellow-950/20"
									)}>
										<TableCell className="font-medium">
											{dept.departmentName}
										</TableCell>
										<TableCell className="text-right">
											{dept.itemCount}
										</TableCell>
										<TableCell className="text-right font-mono">
											{dept.variance > 0 ? "+" : ""}
											{dept.variance}
										</TableCell>
										<TableCell className="text-right font-mono">
											{dept.variancePercent.toFixed(2)}%
										</TableCell>
										<TableCell className="text-center">
											{dept.status === "good" && (
												<Badge variant="outline" className="bg-green-50">
													Good
												</Badge>
											)}
											{dept.status === "warning" && (
												<Badge variant="secondary" className="bg-yellow-100">
													Warning
												</Badge>
											)}
											{dept.status === "critical" && (
												<Badge variant="destructive">
													Critical
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
		</div>
	);
}
