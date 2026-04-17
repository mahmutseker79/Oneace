import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CARDS = ["c0", "c1", "c2", "c3", "c4", "c5"];

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      {/* Header with icon, title, and subtitle */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Report cards grid - 3x2 for reports hub */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((id) => (
          <Card key={id}>
            <CardHeader className="pb-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Chart placeholder with rounded-lg */}
              <Skeleton className="h-20 w-full rounded-lg" />
              {/* CTA button */}
              <Skeleton className="h-9 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
