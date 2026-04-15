import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7"];

export default function ItemsLoading() {
  return (
    <div className="space-y-6">
      {/* Header with title, subtitle, and action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </CardHeader>
      </Card>

      {/* Table skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="ml-auto h-5 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {SKELETON_ROWS.map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="ml-auto h-4 w-16 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
