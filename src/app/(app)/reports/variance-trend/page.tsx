"use client";

import { Download, LineChart as LineChartIcon, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
// Note: getMessages is server-only. This client component uses hardcoded strings.
import { hasPlanCapability } from "@/lib/plans";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";

interface TrendPoint {
	date: string;
	variance: number;
}

export default function VarianceTrendPage() {
	const [trendData, setTrendData] = useState<TrendPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [t, setT] = useState<any>(null);
	const [plan, setPlan] = useState<"FREE" | "PRO" | "BUSINESS">("FREE");

	useEffect(() => {
		async function init() {
			try {
				// server-only: use defaults instead
				const messages = { reports: { heading: "Reports" } } as any;
				setT(messages);

				const sessionRes = await fetch("/api/session");
				const sessionData = await sessionRes.json();
				setPlan(sessionData.plan);

				// Fetch trend data
				const res = await fetch("/api/reports/variance-trend");
				if (!res.ok) throw new Error("Failed to fetch data");
				const data = await res.json();
				setTrendData(data);
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
			const res = await fetch("/api/reports/variance-trend/export", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ format, data: trendData }),
			});

			if (!res.ok) throw new Error("Export failed");

			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `variance-trend-${new Date().toISOString().split("T")[0]}.${format}`;
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
					title="Variance Trend"
					description="Variance over time"
					backHref="/reports"
					breadcrumb={[
						{ label: "Reports", href: "/reports" },
						{ label: "Variance Trend" },
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

	const avgVariance = trendData.length > 0
		? trendData.reduce((sum, d) => sum + d.variance, 0) / trendData.length
		: 0;

	const latestVariance = trendData.length > 0 ? trendData[trendData.length - 1].variance : 0;
	const trend = latestVariance < avgVariance ? "improving" : "worsening";

	return (
		<div className="space-y-6">
			{/* Header */}
			<PageHeader
				title="Variance Trend"
				description="Inventory variance over time"
				backHref="/reports"
				breadcrumb={[
					{ label: "Reports", href: "/reports" },
					{ label: "Variance Trend" },
				]}
				actions={
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
				}
			/>

			{error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* KPI Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Average Variance
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{avgVariance.toFixed(2)}%</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Latest Variance
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{latestVariance.toFixed(2)}%</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Trend
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold capitalize">
							{trend === "improving" ? "🟢" : "🔴"} {trend}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Trend Chart */}
			{trendData.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Variance Over Time</CardTitle>
						<CardDescription>
							Percentage variance tracked daily over the last 30 days
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ResponsiveContainer width="100%" height={300}>
							<LineChart data={trendData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis />
								<Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
								<Legend />
								<Line
									type="monotone"
									dataKey="variance"
									stroke="hsl(0, 84%, 60%)"
									dot={false}
									name="Variance %"
								/>
							</LineChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
