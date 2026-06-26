"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/contexts/DataContext";
import { Search, CheckCircle, X, Shield } from "lucide-react";

const severityConfig = {
  critical: { label: "Critical", text: "text-rose-500 dark:text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10", dot: "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" },
  high: { label: "High", text: "text-amber-500 dark:text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  medium: { label: "Medium", text: "text-blue-500 dark:text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/10", dot: "bg-blue-500" },
  low: { label: "Low", text: "text-text-muted", border: "border-border-subtle", bg: "bg-bg-card", dot: "bg-slate-500" },
};

export default function IssuesPage() {
  const { issues, attackSurfaces } = useData();
  const [activeTab, setActiveTab] = useState<"correlated" | "all">("correlated");
  const [activeSeverity, setActiveSeverity] = useState<string>("all");
  const [activeStatus, setActiveStatus] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState("");

  const severities = ["all", "critical", "high", "medium", "low"];
  const statuses = ["open", "fixed", "dismissed"];

  // Filter logic
  const filteredIssues = issues
    .filter((issue) => activeSeverity === "all" || issue.severity === activeSeverity)
    .filter((issue) => issue.status === activeStatus)
    .filter((issue) => {
      const q = searchQuery.toLowerCase();
      return (
        issue.plain_english_title.toLowerCase().includes(q) ||
        issue.repo_name.toLowerCase().includes(q) ||
        issue.file_path.toLowerCase().includes(q)
      );
    });

  // Filter attack surfaces dynamically based on active status, severity and search queries of their linked issues
  const activeAttackSurfaces = (attackSurfaces || []).filter((surface) => {
    const linkedIssues = issues.filter((i) => surface.issue_ids.includes(i.id));
    const matchingIssues = linkedIssues
      .filter((i) => i.status === activeStatus)
      .filter((i) => activeSeverity === "all" || i.severity === activeSeverity)
      .filter((i) => {
        const q = searchQuery.toLowerCase();
        return (
          i.plain_english_title.toLowerCase().includes(q) ||
          i.repo_name.toLowerCase().includes(q) ||
          i.file_path.toLowerCase().includes(q)
        );
      });
    // Show attack surface if it has 2 or more matching issues
    return matchingIssues.length >= 2;
  });

  const getIssueCount = (sev: string, stat: string) => {
    return issues.filter((i) => (sev === "all" || i.severity === sev) && i.status === stat).length;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-24 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
            Code Vulnerabilities
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Vulnerabilities detected by static analysis scanner
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-bg-deep/60 p-1.5 rounded-xl border border-border-subtle self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("correlated")}
            className={`font-mono text-[10px] uppercase tracking-[1px] font-bold px-[1.125rem] py-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "correlated"
                ? "bg-indigo-500 text-white shadow"
                : "text-text-sub hover:text-text-main"
            }`}
          >
            Correlated Surfaces ({activeAttackSurfaces.length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`font-mono text-[10px] uppercase tracking-[1px] font-bold px-[1.125rem] py-2.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-indigo-500 text-white shadow"
                : "text-text-sub hover:text-text-main"
            }`}
          >
            All Vulnerabilities ({filteredIssues.length})
          </button>
        </div>
      </div>

      {/* Filter and Search HUD */}
      <div className="glass-panel rounded-2xl p-5 space-y-5">
        {/* Search Bar & Status Tabs */}
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <label htmlFor="issue-search" className="sr-only">Search vulnerabilities</label>
            <input
              id="issue-search"
              type="text"
              placeholder="Search by vulnerability, file path, or workspace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-deep border border-border-subtle rounded-xl pl-10 pr-4 py-3 text-sm text-text-main placeholder-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          {/* Status Tabs */}
          <div className="flex bg-bg-deep/60 p-1.5 rounded-xl border border-border-subtle self-start md:self-auto">
            {statuses.map((s) => {
              const count = issues.filter((i) => i.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setActiveStatus(s)}
                  className={`font-mono text-[10px] uppercase tracking-[1px] font-bold px-[1.125rem] py-2.5 rounded-lg transition-all cursor-pointer ${
                    activeStatus === s
                      ? "bg-indigo-500 text-white shadow"
                      : "text-text-sub hover:text-text-main"
                  }`}
                >
                  {s} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Severity Filter Pills */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold mr-2">
            Severity:
          </span>
          {severities.map((sev) => {
            const count = getIssueCount(sev, activeStatus);
            const isSelected = activeSeverity === sev;
            
            return (
              <button
                key={sev}
                onClick={() => setActiveSeverity(sev)}
                className={`font-mono text-[10px] uppercase tracking-[1px] font-bold px-4 py-2 rounded-full border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500 dark:text-indigo-400"
                    : "border-border-subtle hover:border-border-glow text-text-sub hover:text-text-main"
                }`}
              >
                {sev} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Attack Surfaces Section */}
      {activeTab === "correlated" && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <Shield className="text-indigo-500 dark:text-indigo-400" size={18} />
            <h2 className="font-display font-extrabold text-base text-text-main">
              Correlated Attack Surfaces ({activeAttackSurfaces.length})
            </h2>
          </div>
          {activeAttackSurfaces.length === 0 ? (
            <div className="glass-card rounded-2xl py-20 text-center flex flex-col items-center justify-center">
              <CheckCircle className="text-emerald-400 mb-3.5" size={40} />
              <h3 className="font-display font-extrabold text-base text-text-main font-bold">
                No Correlated Attack Surfaces
              </h3>
              <p className="text-xs text-text-sub mt-1.5 max-w-sm">
                No components currently have multiple vulnerabilities of the selected status and severity that correlate into a single attack surface.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAttackSurfaces.map((surface) => {
                // Find active matching issues in this attack surface
                const matchingIssues = issues.filter(
                  (i) => surface.issue_ids.includes(i.id) && i.status === activeStatus
                );
                
                return (
                  <div 
                    key={surface.id}
                    className="glass-card rounded-2xl p-5 border border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/[0.02] space-y-4 transition-all"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[9px] font-bold uppercase tracking-[1px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-550 dark:text-indigo-400">
                          {surface.component} Component
                        </span>
                        <span className="font-mono text-[9px] text-text-muted">
                          {matchingIssues.length} vulnerabilities
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-sm text-text-main">
                        {surface.title}
                      </h3>
                      <p className="text-xs text-text-sub leading-relaxed">
                        {surface.description}
                      </p>
                    </div>

                    {/* Linked Issues list */}
                    <div className="space-y-2 border-t border-border-subtle pt-3.5">
                      <span className="font-mono text-[8px] font-bold uppercase tracking-[1px] text-text-muted block">
                        Linked Issues:
                      </span>
                      <div className="space-y-1.5">
                        {matchingIssues.map((issue) => {
                          const cfg = severityConfig[issue.severity];
                          return (
                            <Link
                              key={issue.id}
                              href={`/issues/${issue.id}`}
                              className="flex items-center justify-between p-2 rounded-lg bg-bg-deep/40 hover:bg-bg-deep border border-border-subtle hover:border-border-glow transition-all text-[11px] group"
                            >
                              <span className="text-text-sub group-hover:text-indigo-505 dark:group-hover:text-indigo-400 transition-colors truncate max-w-[70%]">
                                {issue.plain_english_title}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-text-muted font-mono truncate">
                                  {issue.file_path.split("/").pop()}:{issue.line_start}
                                </span>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "all" && (
        <section aria-labelledby="issues-list-heading">
          <h2 id="issues-list-heading" className="sr-only">Vulnerability Issues List</h2>
          {/* Issues List */}
          {filteredIssues.length === 0 ? (
            <div className="glass-card rounded-2xl py-20 text-center flex flex-col items-center justify-center">
              <CheckCircle className="text-emerald-400 mb-3.5" size={40} />
              <h3 className="font-display font-extrabold text-base text-text-main">No Issues Identified</h3>
              <p className="text-xs text-text-sub mt-1.5 max-w-sm">
                {searchQuery 
                  ? "No vulnerabilities match your query terms. Try refining search." 
                  : `Zero ${activeStatus} vulnerabilities match the current filters.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredIssues.map((issue) => {
                const cfg = severityConfig[issue.severity];
                return (
                  <div 
                    key={issue.id}
                    className="glass-card rounded-2xl p-[1.375rem] flex flex-col md:flex-row md:items-center justify-between gap-5 border border-border-subtle hover:border-border-glow group animate-fade-in"
                  >
                    {/* Visual state dot */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                      
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                          {issue.source === "ai_review" && (
                            <span className="font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/10 text-indigo-405 dark:text-indigo-400">
                              AI Review
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-text-muted truncate">
                            {issue.repo_name} · {issue.file_path}:{issue.line_start}
                          </span>
                        </div>

                        <h3 className="font-display font-bold text-sm text-text-main group-hover:text-indigo-500 transition-colors">
                          {issue.plain_english_title}
                        </h3>
                        <p className="text-[12px] text-text-sub leading-relaxed line-clamp-2">
                          {issue.plain_english_body}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0 self-end md:self-auto">
                      {issue.status === "open" && (
                        <Link
                          href={`/issues/${issue.id}`}
                          className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] px-[1.125rem] py-2.5 bg-lime-400 hover:bg-lime-500 text-slate-950 rounded-xl transition-all cursor-pointer active:scale-95 shadow-md shadow-lime-400/5 hover:shadow-lime-400/15"
                        >
                          Fix Issue
                        </Link>
                      )}
                      {issue.status === "fixed" && issue.fix_pr_url && (
                        <a
                          href={issue.fix_pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] px-[1.125rem] py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                        >
                          View Pull Request
                        </a>
                      )}
                      <Link
                        href={`/issues/${issue.id}`}
                        className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] px-[1.125rem] py-2.5 border border-border-subtle hover:border-border-glow bg-bg-deep/40 text-text-sub hover:text-text-main rounded-xl transition-colors"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
