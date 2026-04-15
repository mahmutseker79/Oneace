// Phase 13.3 — skeleton loading state for purchase order detail page.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrderDetailLoading() {
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

      {/* Lines table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent className="p-0">
          {["l0", "l1", "l2"].map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Receipt history skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="p-0">
          {["r0", "r1", "r2"].map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
