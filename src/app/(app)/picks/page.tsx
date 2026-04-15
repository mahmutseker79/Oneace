import { Plus, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

type PickStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "PICKED" | "VERIFIED" | "CANCELLED";
type SearchParams = Promise<{ tab?: string }>;

export async function generateMetadata(): Promise<Metadata> {
	return { title: "Pick Tasks — OneAce" };
}

export default async function PickTasksPage({ searchParams }: { searchParams?: SearchParams }) {
	const { membership, session } = await requireActiveMembership();
	const t = await getMessages();
	const region = await getRegion();

	const params = (await searchParams) ?? {};
	const tab = (params.tab ?? "all").toLowerCase();

	// P10.1 — capability flag for conditional UI rendering
	const canCreate = hasCapability(membership.role, "picks.create");

	const picks = await db.pickTask.findMany({
		where: {
			organizationId: membership.organizationId,
			...(tab === "mine"
				? { assignedToUserId: session.user.id }
				: tab === "pending"
					? { status: "PENDING" }
					: tab === "in-progress"
						? { status: "IN_PROGRESS" }
						: tab === "completed"
							? { status: { in: ["PICKED", "VERIFIED"] } }
							: {}),
		},
		include: {
			item: { select: { id: true, name: true, sku: true } },
			warehouse: { select: { id: true, name: true } },
			assignedToUser: { select: { id: true, name: true } },
		},
		orderBy: { createdAt: "desc" },
		take: 100,
	});

	const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, { dateStyle: "medium" });

	function statusBadge(status: PickStatus) {
		if (status === "PENDING") return <Badge variant="warning">{status}</Badge>;
		if (status === "ASSIGNED") return <Badge variant="info">{status}</Badge>;
		if (status === "IN_PROGRESS") return <Badge variant="processing">{status}</Badge>;
		if (status === "PICKED") return <Badge variant="success">{status}</Badge>;
		if (status === "VERIFIED") return <Badge variant="success">{status}</Badge>;
		return <Badge variant="secondary">{status}</Badge>;
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Pick Tasks</h1>
					<p className="text-muted-foreground">Manage warehouse picking operations</p>
				</div>
				{canCreate ? (
					<Button asChild>
						<Link href="/picks/new">
							<Plus className="h-4 w-4" />
							Create Pick Task
						</Link>
					</Button>
				) : null}
			</div>

			{/* Status tabs */}
			<div className="flex gap-2 border-b">
				{[
					{ value: "all", label: "All" },
					{ value: "mine", label: "My Tasks" },
					{ value: "pending", label: "Pending" },
					{ value: "in-progress", label: "In Progress" },
					{ value: "completed", label: "Completed" },
				].map((t) => (
					<Link
						key={t.value}
						href={`/picks?tab=${t.value}`}
						className={`px-4 py-2 text-sm border-b-2 transition-colors ${
							tab === t.value
								? "border-primary text-primary font-medium"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
					>
						{t.label}
					</Link>
				))}
			</div>

			{picks.length === 0 ? (
				<EmptyState
					icon={ClipboardList}
					title="No pick tasks"
					description="Create or generate pick tasks to manage your warehouse operations."
					actions={
						canCreate
							? [
									{
										label: "Create pick task",
										href: "/picks/new",
										icon: Plus,
									},
								]
							: undefined
					}
				/>
			) : (
				<Card>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<Table className="min-w-[700px]">
								<TableHeader>
									<TableRow>
										<TableHead>Item</TableHead>
										<TableHead>Warehouse</TableHead>
										<TableHead>Bin</TableHead>
										<TableHead className="text-right">Qty</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Assigned To</TableHead>
										<TableHead>Created</TableHead>
										<TableHead className="w-20" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{picks.map((pick) => (
										<TableRow key={pick.id} className="hover:bg-muted/50 transition-colors">
											<TableCell>
												<Link
													href={`/picks/${pick.id}`}
													className="font-medium hover:underline"
												>
													{pick.item.name}
												</Link>
												<div className="text-muted-foreground font-mono text-xs">
													{pick.item.sku}
												</div>
											</TableCell>
											<TableCell className="text-sm">
												{pick.warehouse.name}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{pick.fromBinId || "—"}
											</TableCell>
											<TableCell className="text-right tabular-nums font-medium">
												{pick.quantity}
											</TableCell>
											<TableCell>
												{statusBadge(pick.status as PickStatus)}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{pick.assignedToUser?.name || "—"}
											</TableCell>
											<TableCell className="text-xs text-muted-foreground">
												{dateFormatter.format(pick.createdAt)}
											</TableCell>
											<TableCell className="text-right">
												<Button variant="ghost" size="sm" asChild>
													<Link href={`/picks/${pick.id}`}>View</Link>
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
