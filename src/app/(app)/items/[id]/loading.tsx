// Phase 13.3 — skeleton loading state for item detail page.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ItemDetailLoading() {
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

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {["k0", "k1", "k2"].map((id) => (
          <Card key={id}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stock levels table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="p-0">
          {["s0", "s1"].map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Movement history table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="p-0">
          {["m0", "m1", "m2"].map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
