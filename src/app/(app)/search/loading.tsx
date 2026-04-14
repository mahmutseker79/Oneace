import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["r0", "r1", "r2", "r3", "r4"];

export default function SearchLoading() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="space-y-2">
				<Skeleton className="h-7 w-28" />
				<Skeleton className="h-4 w-52" />
			</div>

			{/* Items section */}
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-24" />
				</CardHeader>
				<CardContent className="p-0">
					{ROWS.map((id) => (
						<div
							key={id}
							className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0"
						>
							<div className="flex-1 space-y-1.5">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-3 w-32" />
							</div>
							<Skeleton className="h-4 w-4" />
						</div>
					))}
				</CardContent>
			</Card>

			{/* Suppliers section */}
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-20" />
				</CardHeader>
				<CardContent className="p-0">
					{ROWS.slice(0, 3).map((id) => (
						<div
							key={id}
							className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0"
						>
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-4 w-4" />
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}
