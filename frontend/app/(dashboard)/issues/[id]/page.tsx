"use client";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useData } from "@/lib/contexts/DataContext";
import { useToast } from "@/lib/contexts/ToastContext";
import { ArrowLeft, GitPullRequest, Copy, X, Terminal, CheckCircle2, ShieldAlert, FileCode, Check, ArrowRight } from "lucide-react";
import clsx from "clsx";

const severityConfig = {
  critical: { label: "Critical Risk — Fix Immediately", text: "text-rose-500 dark:text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10", glow: "glow-rose" },
  high: { label: "High Risk — Resolve This Week", text: "text-amber-500 dark:text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10", glow: "glow-amber" },
  medium: { label: "Medium Risk", text: "text-blue-500 dark:text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/10", glow: "" },
  low: { label: "Low Risk", text: "text-text-muted", border: "border-border-subtle", bg: "bg-bg-card", glow: "" },
};

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { issues, fixIssueSimulate, dismissIssue } = useData();
  const { showToast } = useToast();
  
  const issueId = params.id as string;
  const issue = issues.find((i) => i.id === issueId) || issues[0];
  
  const [isReviewing, setIsReviewing] = useState(false);
  const [chunkApproved, setChunkApproved] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixStep, setFixStep] = useState(0);
  const [fixLogs, setFixLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  if (!issue) {
    return (
      <div className="p-8 text-center text-text-muted font-mono text-sm">
        Vulnerability not found.
      </div>
    );
  }

  const cfg = severityConfig[issue.severity];

  const handleCopy = () => {
    navigator.clipboard.writeText(issue.ai_fix_code);
    setCopied(true);
    showToast("AI fix code copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismiss = () => {
    dismissIssue(issue.id);
    router.push("/issues");
  };

  const handleApplyFix = async () => {
    if (isFixing || issue.status === "fixed") return;
    setIsFixing(true);
    setFixStep(1);
    setFixLogs(["[GIT] Creating new hotfix branch: 'security/fix-vulnerability'..."]);

    const steps = [
      { delay: 600, log: "[AST] Merging approved modification AST patch..." },
      { delay: 700, log: "[TESTER] Running regression test suites. 12/12 validation scripts OK." },
      { delay: 600, log: `[GIT] Committing patch: 'security-fix: resolve vulnerability in endpoint'...` },
      { delay: 800, log: "[GIT] Pushing security branch to origin upstream..." },
      { delay: 500, log: "[GITHUB] Creating Pull Request. Mapped to SOC 2 CC6.1 compliance checklist..." },
      { delay: 400, log: "[GITHUB] Auto-merging verified Pull Request branch into main..." }
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, steps[i].delay));
      setFixStep((prev) => prev + 1);
      setFixLogs((prev) => [...prev, steps[i].log]);
    }

    // Call state fix
    await fixIssueSimulate(issue.id);
    setIsFixing(false);
    setIsReviewing(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2.5">
        <Link 
          href="/issues" 
          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[1px] text-text-muted hover:text-text-main transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Issues
        </Link>
        <span className="text-text-muted text-xs">/</span>
        <span className="text-[11px] font-mono uppercase text-text-sub truncate max-w-xs">
          {issue.plain_english_title}
        </span>
      </div>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 border-b border-border-subtle pb-5">
        <div className="space-y-2.5 flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.text} ${cfg.glow}`}>
              {cfg.label}
            </span>
            <span className="font-mono text-[10px] text-text-muted truncate">
              {issue.repo_name} · {issue.file_path}:{issue.line_start}
            </span>
          </div>
          <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide leading-tight">
            {issue.plain_english_title}
          </h1>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Descriptions */}
        <div className="space-y-6">
          {/* Plain English explainer */}
          <div className="glass-card rounded-2xl p-6 space-y-3.5">
            <h3 className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
              Vulnerability Explanation
            </h3>
            <p className="text-sm text-text-sub leading-relaxed">
              {issue.plain_english_body}
            </p>
          </div>

          {/* Exploit impact */}
          <div className="glass-card rounded-2xl p-6 space-y-3.5">
            <h3 className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
              Security Impact
            </h3>
            <div className="space-y-3.5">
              {issue.impact_bullets.map((bullet, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 text-xs text-text-sub"
                >
                  <ShieldAlert className="text-rose-500 dark:text-rose-400 mt-0.5 flex-shrink-0" size={15} />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Details */}
          <div className="glass-card rounded-2xl p-6 space-y-3.5">
            <h3 className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
              Technical Metrics
            </h3>
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between border-b border-border-subtle py-2">
                <span className="text-text-muted">Semgrep Rule ID</span>
                <span className="text-text-sub select-all">{issue.semgrep_rule_id}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle py-2">
                <span className="text-text-muted">Target File Path</span>
                <span className="text-text-sub truncate pl-4 select-all">{issue.file_path}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-text-muted">Code Lines Audited</span>
                <span className="text-text-sub">{issue.line_start} to {issue.line_end}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Merge AST Code Editor & Console */}
        <div className="space-y-6">
          {/* AST Code review workspace - scaled height */}
          <div className="glass-panel border border-border-subtle rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[420px]">
            {/* Headers tabs */}
            <div className="bg-slate-950 px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <FileCode size={16} />
                <span className="font-mono text-[11px] uppercase tracking-[1px]">{issue.file_path.split("/").pop()}</span>
              </div>
              <span className="font-mono text-[9px] font-bold text-indigo-400">AST RESOLUTION DESK</span>
            </div>

            {/* Code Body - scaled text to text-sm */}
            <div className="flex-1 overflow-auto p-5 space-y-5 font-mono text-sm leading-relaxed bg-[#030308]">
              {isReviewing ? (
                <div className="space-y-5 animate-fade-in">
                  <div className="text-[11px] text-slate-500 uppercase tracking-[1px] font-bold pb-2 border-b border-white/5">
                    Review Code Modification Chunk #1
                  </div>
                  
                  {/* Visual Diff */}
                  <div className="grid grid-cols-1 gap-3.5">
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-rose-500 uppercase tracking-[1px]">Original codebase block</div>
                      <pre className="code-diff-removed p-3 rounded-xl text-rose-300/80 overflow-x-auto whitespace-pre text-xs">
                        {issue.code_snippet}
                      </pre>
                    </div>

                    <div className="flex justify-center text-slate-600">
                      <ArrowRight size={16} className="rotate-90 md:rotate-0" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[10px] text-emerald-500 uppercase tracking-[1px]">Proposed resolution block</div>
                      <pre className="code-diff-added p-3 rounded-xl text-emerald-300/90 overflow-x-auto whitespace-pre text-xs">
                        {issue.ai_fix_code}
                      </pre>
                    </div>
                  </div>

                  {/* Approve chunk */}
                  <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                    <div className="text-[11px] text-slate-400 font-sans">
                      Validate AST patch structure compatibility.
                    </div>
                    <button
                      onClick={() => {
                        setChunkApproved(true);
                        showToast("AST Code patch chunk approved.", "success");
                      }}
                      className={clsx(
                        "font-mono text-[10px] font-bold uppercase tracking-[1px] px-4 py-2.5 rounded-xl transition-all cursor-pointer",
                        chunkApproved
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                          : "bg-indigo-500 text-white"
                      )}
                    >
                      {chunkApproved ? "✓ Chunk Approved" : "Approve Chunk"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 h-full flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Vulnerable code */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-rose-500 uppercase tracking-[1px] font-bold">Vulnerable Code</div>
                      <pre className="code-diff-removed p-3.5 rounded-xl overflow-x-auto text-rose-300/95 whitespace-pre text-xs">
                        {issue.code_snippet}
                      </pre>
                    </div>

                    {/* Proposed fix */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-emerald-500 uppercase tracking-[1px] font-bold">AI Suggested Code Resolution</div>
                      <pre className="code-diff-added p-3.5 rounded-xl overflow-x-auto text-emerald-300/95 whitespace-pre text-xs">
                        {issue.ai_fix_code}
                      </pre>
                    </div>
                  </div>

                  {issue.status === "open" && (
                    <div className="pb-2">
                      <button
                        onClick={() => setIsReviewing(true)}
                        className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-colors cursor-pointer text-center"
                      >
                        Start Code Review Merge
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Remediation HUD actions */}
          <div className="space-y-4">
            {issue.status === "open" ? (
              <div className="space-y-4">
                {isReviewing && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleApplyFix}
                      disabled={!chunkApproved || isFixing}
                      className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-3.5 font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer shadow-lg",
                        chunkApproved
                          ? "bg-lime-400 hover:bg-lime-500 text-slate-950 shadow-lime-400/5 hover:shadow-lime-400/15"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                      )}
                    >
                      <GitPullRequest size={14} />
                      Commit Fix as GitHub PR #44
                    </button>
                    <button 
                      onClick={() => setIsReviewing(false)}
                      className="px-5 py-3.5 border border-border-subtle hover:border-border-glow bg-bg-deep/40 text-text-sub hover:text-text-main rounded-xl transition-colors cursor-pointer font-mono text-[10px] uppercase tracking-[1px]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                
                {!isReviewing && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 border border-border-subtle hover:border-border-glow bg-bg-deep/40 text-text-sub hover:text-text-main rounded-xl transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold">{copied ? "Copied" : "Copy Code"}</span>
                    </button>

                    <button 
                      onClick={handleDismiss}
                      className="flex items-center justify-center gap-2 px-8 py-3.5 border border-border-subtle hover:border-rose-500/20 bg-bg-deep/40 hover:bg-rose-500/5 text-text-muted hover:text-rose-500 rounded-xl transition-colors cursor-pointer"
                    >
                      <X size={14} />
                      <span className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold">Dismiss</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel border-l-4 border-l-emerald-500 rounded-2xl p-5 flex gap-4 items-center shadow-lg shadow-emerald-950/10">
                <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={20} />
                <div className="flex-1 space-y-0.5">
                  <h4 className="text-sm font-bold text-text-main">Vulnerability Remediated</h4>
                  <p className="text-xs text-text-sub">
                    Hotfix applied successfully via pull request. Code status is clean.
                  </p>
                </div>
                {issue.fix_pr_url && (
                  <a 
                    href={issue.fix_pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] font-bold uppercase tracking-[1px] px-4.5 py-2.5 border border-emerald-500/30 hover:border-emerald-500/55 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-xl transition-all"
                  >
                    View PR
                  </a>
                )}
              </div>
            )}

            {/* Git Action Simulation Console Output */}
            {isFixing && (
              <div className="bg-black border border-white/10 rounded-2xl overflow-hidden font-mono text-[11px] text-slate-400 flex flex-col h-[200px] shadow-xl animate-slide-up">
                <div className="bg-slate-950 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-lime-400" />
                    <span className="text-slate-300 font-bold">AUTOMATED PULL REQUEST RUNNER</span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-ping" />
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-1.5 leading-relaxed">
                  {fixLogs.map((log, index) => (
                    <div key={index} className={log.includes("[GIT]") ? "text-indigo-400" : log.includes("[GITHUB]") ? "text-amber-400" : "text-slate-400"}>
                      {log}
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 text-slate-600 mt-1">
                    <span>running process</span>
                    <span className="w-1 h-3 bg-slate-600 animate-pulse" />
                  </div>
                </div>
                <div className="bg-slate-950 px-4 py-2.5 text-[10px] text-slate-500 border-t border-white/10 flex justify-between">
                  <span>Task progress: {fixStep} / 7</span>
                  <span>remediating...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
