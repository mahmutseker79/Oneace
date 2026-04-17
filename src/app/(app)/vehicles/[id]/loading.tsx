export default function VehicleDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-muted h-4 w-24 rounded" />
      <div className="border-border bg-card space-y-4 rounded-lg border p-6">
        <div className="bg-muted h-7 w-48 rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="bg-muted h-4 w-24 rounded" />
            <div className="bg-muted h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
      <div className="border-border bg-card rounded-lg border p-6">
        <div className="bg-muted h-6 w-32 rounded" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted h-12 w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
