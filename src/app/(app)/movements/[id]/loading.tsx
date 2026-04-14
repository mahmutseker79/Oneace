// Phase 15.1 — skeleton loading state for movement detail page.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MovementDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-48" />
        </div>
      </div>

      {/* Main details card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {["d0", "d1", "d2", "d3", "d4", "d5"].map((id) => (
            <div key={id} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
