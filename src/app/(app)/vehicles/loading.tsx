export default function VehiclesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="bg-muted h-7 w-40 rounded" />
          <div className="bg-muted h-4 w-64 rounded" />
        </div>
        <div className="bg-muted h-10 w-32 rounded-md" />
      </div>
      <div className="border-border bg-card rounded-lg border">
        <div className="border-border border-b px-4 py-3">
          <div className="flex gap-4">
            {[120, 100, 80, 80].map((w, i) => (
              <div key={i} className="bg-muted h-4 rounded" style={{ width: w }} />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border border-b px-4 py-3 last:border-0">
            <div className="flex gap-4">
              {[140, 90, 60, 80].map((w, j) => (
                <div key={j} className="bg-muted h-4 rounded" style={{ width: w }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
