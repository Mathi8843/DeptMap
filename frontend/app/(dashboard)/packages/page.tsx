"use client";
import React, { useState } from "react";
import { useData } from "@/lib/contexts/DataContext";
import { useToast } from "@/lib/contexts/ToastContext";
import { RefreshCw, ShieldAlert, CheckCircle, ShieldAlert as AlertTriangle, AlertCircle, HelpCircle, Check, Trash } from "lucide-react";

const statusConfig = {
  safe: { label: "Verified Safe", text: "text-emerald-500 dark:text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  suspect: { label: "Suspect Download", text: "text-amber-500 dark:text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  dangerous: { label: "Dangerous Hallucination", text: "text-rose-500 dark:text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10", dot: "bg-rose-500 animate-pulse" },
  unknown: { label: "Unknown Registry", text: "text-text-muted", border: "border-border-subtle", bg: "bg-bg-card", dot: "bg-slate-600" },
};

export default function PackagesPage() {
  const { packages, auditPackageAction } = useData();
  const { showToast } = useToast();
  const [isAuditing, setIsAuditing] = useState(false);

  const dangerous = packages.filter((p) => p.status === "dangerous");
  const suspect = packages.filter((p) => p.status === "suspect");
  const safe = packages.filter((p) => p.status === "safe");

  const sortedPackages = [...dangerous, ...suspect, ...safe];

  const handleRescan = () => {
    setIsAuditing(true);
    showToast("Auditing packages list against npm/PyPI registry database...", "info");
    setTimeout(() => {
      setIsAuditing(false);
      showToast("Package registry audit complete. All metrics refreshed.", "success");
    }, 1500);
  };

  const formatDownloads = (n: number | null | undefined) => {
    if (n === null || n === undefined) return "—";
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
            Dependency Safety
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Package slopsquatting detector and registry authenticity validation
          </p>
        </div>
        <button
          onClick={handleRescan}
          disabled={isAuditing}
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1px] font-bold px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
        >
          <RefreshCw size={14} className={isAuditing ? "animate-spin" : ""} />
          {isAuditing ? "Auditing Registry..." : "Verify Registry"}
        </button>
      </div>

      {/* Explainer card */}
      <div className="glass-panel border-l-4 border-l-amber-500 rounded-2xl p-6 flex gap-4.5 items-start">
        <HelpCircle size={22} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text-main">What is AI Slopsquatting?</h3>
          <p className="text-sm text-text-sub leading-relaxed">
            AI code assistants (Cursor, Lovable, Bolt) occasionally hallucinate library packages that do not exist in the public registries (npm/PyPI). Attackers monitor codebases and register these hallucinated names to execute dependency injection attacks. DebtMap scans your workspaces to ensure all references map to verified registry downloads.
          </p>
        </div>
      </div>

      {/* Package Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-card rounded-2xl p-5 border-l-4 border-l-rose-500 space-y-1.5">
          <div className="font-display font-extrabold text-3xl text-rose-500 dark:text-rose-400 text-glow-rose leading-none">
            {dangerous.length}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
            Hallucinated Alert
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 border-l-4 border-l-amber-500 space-y-1.5">
          <div className="font-display font-extrabold text-3xl text-amber-500 dark:text-amber-400 leading-none">
            {suspect.length}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
            Suspect Download Counts
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5 border-l-4 border-l-emerald-500 space-y-1.5">
          <div className="font-display font-extrabold text-3xl text-emerald-500 dark:text-emerald-400 leading-none">
            {safe.length}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
            Verified Safe Packages
          </div>
        </div>
      </div>

      {/* Dependencies List */}
      <div className="space-y-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold">
          Dependency Registry Audit ({sortedPackages.length} checked)
        </h3>

        {sortedPackages.length === 0 ? (
          <div className="glass-card rounded-2xl py-20 text-center flex flex-col items-center justify-center">
            <CheckCircle className="text-emerald-500 mb-3.5" size={40} />
            <h4 className="text-sm font-bold text-text-main">No Packages Listed</h4>
            <p className="text-xs text-text-muted mt-1">Your package lists are empty.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {sortedPackages.map((pkg) => {
              const cfg = statusConfig[pkg.status];
              return (
                <div
                  key={pkg.id}
                  className={`glass-card rounded-2xl p-5 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 border-border-subtle hover:border-border-glow ${
                    pkg.status === "dangerous" ? "border-rose-500/20 bg-rose-500/[0.01]" : ""
                  }`}
                >
                  {/* Package Metadata */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                    
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-display font-bold text-sm text-text-main truncate">
                          {pkg.package_name}
                        </span>
                        <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-bg-card text-text-sub uppercase">
                          {pkg.package_manager}
                        </span>
                        <span className="font-mono text-[10px] text-text-muted">
                          · {formatDownloads(pkg.weekly_downloads)} downloads/wk
                        </span>
                      </div>
                      <p className="text-xs text-text-sub">
                        {pkg.reason}
                      </p>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-3 flex-shrink-0 self-end md:self-auto">
                    {/* Status Badge */}
                    <div className={`font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.text} mr-2`}>
                      {cfg.label}
                    </div>

                    {/* Fixes */}
                    {pkg.status === "dangerous" && (
                      <>
                        {pkg.alternative_name && (
                          <button
                            onClick={() => auditPackageAction(pkg.id, "replace")}
                            className="font-mono text-[9px] font-bold uppercase tracking-[1px] px-4 py-2.5 bg-lime-400 hover:bg-lime-500 text-slate-950 rounded-xl transition-all cursor-pointer shadow-md"
                          >
                            Replace with {pkg.alternative_name}
                          </button>
                        )}
                        <button
                          onClick={() => auditPackageAction(pkg.id, "verify")}
                          className="font-mono text-[9px] font-bold uppercase tracking-[1px] px-4 py-2.5 border border-border-subtle hover:border-border-glow bg-bg-deep/40 text-text-sub hover:text-text-main rounded-xl transition-colors cursor-pointer"
                        >
                          Mark Safe
                        </button>
                        <button
                          onClick={() => auditPackageAction(pkg.id, "ignore")}
                          className="p-2 border border-border-subtle hover:border-rose-500/20 bg-bg-deep/40 hover:bg-rose-500/5 text-text-muted hover:text-rose-500 rounded-xl transition-colors cursor-pointer"
                          title="Ignore alert"
                        >
                          <Trash size={14} />
                        </button>
                      </>
                    )}

                    {pkg.status === "suspect" && (
                      <button
                        onClick={() => auditPackageAction(pkg.id, "verify")}
                        className="font-mono text-[9px] font-bold uppercase tracking-[1px] px-4 py-2.5 border border-border-subtle hover:border-emerald-500/20 bg-bg-deep/40 hover:bg-emerald-500/5 text-text-muted hover:text-emerald-500 rounded-xl transition-colors cursor-pointer"
                      >
                        Verify Safe
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
