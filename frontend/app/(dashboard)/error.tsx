"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-md w-full glass-card rounded-2xl p-8 border border-rose-500/20 text-center space-y-5 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-display font-extrabold text-xl text-text-main">Section Error</h2>
          <p className="text-sm text-text-sub leading-relaxed">
            A dashboard section crashed. The sidebar and navigation are still available.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-xs text-rose-400 text-left overflow-x-auto font-mono">
              {error.message}
            </pre>
          )}
        </div>

        <button
          onClick={reset}
          className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] font-bold uppercase tracking-[1px] rounded-xl transition-all cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
