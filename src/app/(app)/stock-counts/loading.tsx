import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["r0", "r1", "r2", "r3", "r4"];

export default function StockCountsLoading() {
  return (
    <div className="space-y-6">
      {/* Header with title, subtitle, and action button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* In-progress section with tab-like header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {ROWS.slice(0, 3).map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="ml-auto h-4 w-16 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Closed section with tab-like header */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {ROWS.slice(0, 2).map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="ml-auto h-4 w-16 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
