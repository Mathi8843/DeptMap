import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#06060c] p-8">
      <div className="max-w-md w-full glass-card rounded-2xl p-8 border border-border-subtle text-center space-y-5 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="font-display font-extrabold text-4xl text-text-main">404</h1>
          <p className="text-sm text-text-sub leading-relaxed">
            This page does not exist. It may have been moved or the URL is incorrect.
          </p>
        </div>

        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] font-bold uppercase tracking-[1px] rounded-xl transition-all"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
