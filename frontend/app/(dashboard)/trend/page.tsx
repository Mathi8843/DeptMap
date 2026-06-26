"use client";
import React from "react";
import dynamic from "next/dynamic";
import { TrendingUp as TrendingUpIcon, ShieldCheck } from "lucide-react";
import { useData } from "@/lib/contexts/DataContext";

const TrendCharts = dynamic(() => import("./TrendCharts"), { ssr: false });

export default function TrendPage() {
  const { overallScore, issues, trendData } = useData();

  const currentScore = overallScore;
  const hasHistory = trendData && trendData.length > 0;
  const firstScore = hasHistory ? trendData[0].score : currentScore;
  const drop = firstScore - currentScore;

  const openIssues = issues.filter(i => i.status === "open").length;
  const fixedIssues = issues.filter(i => i.status === "fixed").length;

  const stats = [
    { label: "Current Score", value: currentScore, color: currentScore >= 70 ? "text-emerald-500 dark:text-emerald-400" : currentScore >= 40 ? "text-amber-500 dark:text-amber-400" : "text-rose-500", delta: drop > 0 ? `Drop of ${drop}pts since first scan` : `Increase of ${Math.abs(drop)}pts since first scan` },
    { label: "Trend Status", value: drop > 0 ? "Down" : "Up", color: drop > 0 ? "text-rose-500" : "text-emerald-500 dark:text-emerald-400", delta: hasHistory ? `Based on ${trendData.length} scans` : "No scan history yet" },
    { label: "Active Exposures", value: openIssues, color: "text-amber-500 dark:text-amber-400", delta: "Unresolved alerts" },
    { label: "Fixed via PRs", value: fixedIssues, color: "text-emerald-500 dark:text-emerald-400", delta: "Total resolved issues" },
  ];

  if (!hasHistory) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-500 glow-indigo mb-4">
          <TrendingUpIcon size={28} />
        </div>
        <h2 className="font-display font-extrabold text-xl text-text-main">No Scan History Yet</h2>
        <p className="text-sm text-text-sub text-center max-w-md leading-relaxed">
          Automated code health tracking logs scores after each repository scan. Connect a repository and run a scan to start visualizing your security score timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
          Code Health Trend
        </h1>
        <p className="text-sm text-text-sub">
          Historical analysis of security health and technical debt accumulation
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-5 space-y-1 border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-text-muted font-bold">{s.label}</div>
            <div className={`font-display font-extrabold text-3xl tracking-wide ${s.color}`}>
              {s.value}
            </div>
            <div className="text-[10px] text-text-muted">{s.delta}</div>
          </div>
        ))}
      </div>

      <TrendCharts trendData={trendData} drop={drop} />

      <section aria-labelledby="mitigation-heading">
      <h2 id="mitigation-heading" className="sr-only">Mitigation Plan</h2>
      {/* Mitigation Action card */}
      <div className="glass-card rounded-2xl p-6 flex gap-[1.125rem] items-start border border-border-subtle bg-bg-deep/10">
        <ShieldCheck size={20} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <h4 className="text-xs font-bold text-text-main font-mono uppercase tracking-[1px]">Debt Deficit Remediation Plan</h4>
          <p className="text-xs text-text-sub leading-relaxed">
            Close 3+ vulnerabilities weekly to clear debt accrual before the code health index declines below 50. Use Risk Guard AI's PR automated pipeline to fix vulnerabilities quickly.
          </p>
        </div>
      </div>
      </section>
    </div>
  );
}
