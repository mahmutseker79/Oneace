// Phase 13.3 — skeleton loading state for stock count detail page.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StockCountDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-3.5" />
        <Skeleton className="h-3.5 w-24" />
      </div>

      {/* Title + badge */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" /> {/* back button */}
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Status Timeline placeholder (4 circles connected by lines) */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                {i < 3 && <Skeleton className="h-0.5 w-8 -mt-1" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Entry form skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-24" />
        </CardContent>
      </Card>

      {/* Variance table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="p-0">
          {["v0", "v1", "v2", "v3"].map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
