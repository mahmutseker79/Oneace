import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const KPI_KEYS = ["k0", "k1", "k2", "k3"];
const TABLE_ROWS = ["r0", "r1", "r2", "r3", "r4"];

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      {/* KPI cards — match actual KpiCard layout */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_KEYS.map((id) => (
          <Card key={id} className="overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-24" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Activation tips / onboarding progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {["s0", "s1", "s2", "s3"].map((id) => (
            <div key={id} className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Movement Trend Chart */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/40">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent className="pt-4">
          <Skeleton className="h-[260px] w-full rounded-lg" />
        </CardContent>
      </Card>

      {/* Two-column charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 border-b border-border/40">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent className="pt-4">
            <Skeleton className="h-[260px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3 border-b border-border/40">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="pt-4">
            <Skeleton className="h-[260px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>

      {/* Bottom tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="space-y-2">
            {TABLE_ROWS.map((id) => (
              <Skeleton key={id} className="h-9 w-full rounded" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            {TABLE_ROWS.map((id) => (
              <Skeleton key={id} className="h-9 w-full rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
