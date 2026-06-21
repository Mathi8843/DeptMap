export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 min-h-full">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-3">
          <div className="h-8 w-64 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-48 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-36 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-10 w-40 rounded-xl bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 h-[140px] space-y-3">
            <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
            <div className="h-8 w-16 rounded bg-white/5 animate-pulse" />
            <div className="h-6 w-full rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-4 w-48 rounded bg-white/5 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 h-28 space-y-3">
                <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
                <div className="h-3 w-48 rounded bg-white/5 animate-pulse" />
                <div className="h-6 w-20 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 h-[415px] space-y-3">
          <div className="h-4 w-40 rounded bg-white/5 animate-pulse" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
