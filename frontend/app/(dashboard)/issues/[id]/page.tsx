"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useData } from "@/lib/contexts/DataContext";
import { useToast } from "@/lib/contexts/ToastContext";
import {
  ArrowLeft, GitPullRequest, Copy, X, Terminal,
  CheckCircle2, ShieldAlert, FileCode, Check, ArrowRight,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import CodeDiffViewer from "@/components/ui/CodeDiffViewer";

const severityConfig = {
  critical: {
    label: "Critical Risk — Fix Immediately",
    text: "text-rose-500 dark:text-rose-400",
    border: "border-rose-500/20",
    bg: "bg-rose-500/10",
    glow: "glow-rose",
    bar: "bg-rose-500",
    accentBorder: "border-l-rose-500",
  },
  high: {
    label: "High Risk — Resolve This Week",
    text: "text-amber-500 dark:text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
    glow: "glow-amber",
    bar: "bg-amber-500",
    accentBorder: "border-l-amber-500",
  },
  medium: {
    label: "Medium Risk",
    text: "text-blue-500 dark:text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/10",
    glow: "",
    bar: "bg-blue-500",
    accentBorder: "border-l-blue-500",
  },
  low: {
    label: "Low Risk",
    text: "text-text-muted",
    border: "border-border-subtle",
    bg: "bg-bg-card",
    glow: "",
    bar: "bg-slate-500",
    accentBorder: "border-l-slate-500",
  },
};

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { issues, fixIssueSimulate, dismissIssue } = useData();
  const { showToast } = useToast();

  const hasOneClickPr = PLAN_LIMITS[user.plan].one_click_pr;
  const issueId = params.id as string;
  const issue = issues.find((i) => i.id === issueId);

  useEffect(() => {
    if (!issue && issues.length > 0) {
      showToast(`Issue "${issueId}" not found`, "warning");
    }
  }, [issue, issueId, issues.length, showToast]);

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
      { delay: 500, log: "[GITHUB] Creating Pull Request with plain English explanation..." },
      { delay: 400, log: "[GITHUB] Auto-merging verified Pull Request branch into main..." },
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, steps[i].delay));
      setFixStep((prev) => prev + 1);
      setFixLogs((prev) => [...prev, steps[i].log]);
    }

    await fixIssueSimulate(issue.id);
    setIsFixing(false);
    setIsReviewing(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-7 animate-fade-in">

      {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
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

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={clsx(
        "glass-card rounded-2xl p-6 border-l-4 space-y-3",
        cfg.accentBorder
      )}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-1 rounded-md border ${cfg.bg} ${cfg.border} ${cfg.text} ${cfg.glow}`}>
            {cfg.label}
          </span>
          {issue.source === "ai_review" && (
            <span className="font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
              AI Review
            </span>
          )}
          {issue.status === "fixed" && (
            <span className="font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              Remediated
            </span>
          )}
          <span className="font-mono text-[10px] text-text-muted">
            {issue.repo_name} · {issue.file_path}:{issue.line_start}
          </span>
        </div>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-text-main tracking-wide leading-tight">
          {issue.plain_english_title}
        </h1>
        <p className="text-sm text-text-sub leading-relaxed max-w-3xl">
          {issue.plain_english_body}
        </p>
      </div>

      {/* ── 3-col meta strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Security impact */}
        <div className="glass-card rounded-2xl p-5 space-y-3 sm:col-span-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
            Security Impact
          </h3>
          <div className="space-y-2.5">
            {issue.impact_bullets.map((bullet, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-xs text-text-sub"
              >
                <ShieldAlert className="text-rose-500 dark:text-rose-400 mt-0.5 flex-shrink-0" size={13} />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Technical metrics + confidence */}
        <div className="space-y-4">
          {/* Confidence */}
          {issue.confidence !== undefined && issue.confidence !== null && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
                  Fix Confidence
                </span>
                <span className={clsx(
                  "font-mono text-[10px] font-bold uppercase tracking-[1px] px-2 py-0.5 rounded",
                  issue.confidence >= 80 ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" :
                  issue.confidence >= 50 ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" :
                  "text-rose-400 bg-rose-500/10 border border-rose-500/20"
                )}>
                  {issue.confidence}%
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-white/5">
                <div
                  className={clsx("h-full rounded-full transition-all duration-700", cfg.bar)}
                  style={{ width: `${issue.confidence}%` }}
                />
              </div>
              {issue.confidence < 50 && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  <ShieldAlert size={13} className="text-rose-400 flex-shrink-0" />
                  <span>Developer review recommended.</span>
                </div>
              )}
            </div>
          )}

          {/* Technical details */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
              Technical Metrics
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex flex-col gap-0.5 border-b border-border-subtle py-2">
                <span className="text-text-muted text-[10px]">Rule ID</span>
                <span className="text-text-sub select-all break-all">{issue.semgrep_rule_id}</span>
              </div>
              <div className="flex flex-col gap-0.5 border-b border-border-subtle py-2">
                <span className="text-text-muted text-[10px]">File</span>
                <span className="text-text-sub break-all select-all">{issue.file_path}</span>
              </div>
              <div className="flex flex-col gap-0.5 py-2">
                <span className="text-text-muted text-[10px]">Lines</span>
                <span className="text-text-sub">{issue.line_start} → {issue.line_end}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DIFF PANEL — full-width ──────────────────────────────────────── */}
      <div className="glass-panel border border-border-subtle rounded-2xl overflow-hidden shadow-2xl">
        {/* Panel header */}
        <div className="dark:bg-slate-950 bg-bg-card px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-text-muted">
            <FileCode size={15} />
            <span className="font-mono text-[11px] uppercase tracking-[1px]">
              {issue.file_path.split("/").pop()}
            </span>
            <span className="font-mono text-[9px] opacity-60">
              Lines {issue.line_start}–{issue.line_end}
            </span>
          </div>
          <span className="font-mono text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-[1px]">
            Code Diff · AI Resolution
          </span>
        </div>

        {/* "What this fix does" banner */}
        {issue.what_changed && (
          <div className="bg-indigo-950/20 border-b border-indigo-500/10 px-5 py-3.5 flex items-start gap-3">
            <Zap size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[1.5px] text-indigo-400 block mb-0.5">
                What this fix does
              </span>
              <p className="text-xs text-text-sub leading-relaxed">{issue.what_changed}</p>
            </div>
          </div>
        )}

        {/* Diff viewer — full width, tall */}
        {!isReviewing ? (
          <div className="p-4">
            <CodeDiffViewer
              oldCode={issue.code_snippet || ""}
              newCode={issue.ai_fix_code || ""}
              filename={issue.file_path}
            />
          </div>
        ) : (
          /* ── Review mode — show diff + approve chunk ── */
          <div className="p-4 space-y-4 animate-fade-in">
            <div className="text-[11px] text-text-muted uppercase tracking-[1px] font-bold font-mono pb-2 border-b border-border-subtle">
              Review Code Modification Chunk #1
            </div>
            <CodeDiffViewer
              oldCode={issue.code_snippet || ""}
              newCode={issue.ai_fix_code || ""}
              filename={issue.file_path}
            />
            <div className="p-4 dark:bg-slate-950/60 bg-bg-card border border-border-subtle rounded-2xl flex items-center justify-between gap-4">
              <div className="text-xs text-text-sub font-sans">
                Validate AST patch structure compatibility before committing.
              </div>
              <button
                onClick={() => {
                  setChunkApproved(true);
                  showToast("AST Code patch chunk approved.", "success");
                }}
                className={clsx(
                  "font-mono text-[10px] font-bold uppercase tracking-[1px] px-5 py-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0",
                  chunkApproved
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                    : "bg-indigo-500 hover:bg-indigo-600 text-white"
                )}
              >
                {chunkApproved ? "✓ Chunk Approved" : "Approve Chunk"}
              </button>
            </div>
          </div>
        )}

        {/* Panel footer — action bar */}
        <div className="dark:bg-slate-950/60 bg-bg-card border-t border-border-subtle px-5 py-4">
          {issue.status !== "open" ? (
            /* Fixed state */
            <div className="flex items-center gap-4">
              <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={18} />
              <div className="flex-1">
                <p className="text-sm font-bold text-text-main">Vulnerability Remediated</p>
                <p className="text-xs text-text-sub">Hotfix applied successfully. Code status is clean.</p>
              </div>
              {issue.fix_pr_url && (
                <a
                  href={issue.fix_pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] font-bold uppercase tracking-[1px] px-4 py-2.5 border border-emerald-500/30 hover:border-emerald-500/55 bg-emerald-500/10 text-emerald-400 rounded-xl transition-all flex-shrink-0"
                >
                  View PR
                </a>
              )}
            </div>
          ) : isReviewing ? (
            /* Reviewing state */
            <div className="flex gap-3">
              <button
                onClick={handleApplyFix}
                disabled={!chunkApproved || isFixing}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer shadow-lg",
                  chunkApproved
                    ? "bg-lime-400 hover:bg-lime-500 text-slate-950 shadow-lime-400/10"
                    : "bg-bg-panel text-text-muted cursor-not-allowed border border-border-subtle"
                )}
              >
                <GitPullRequest size={14} />
                Commit Fix as GitHub PR
              </button>
              <button
                onClick={() => { setIsReviewing(false); setChunkApproved(false); }}
                className="px-5 py-3.5 border border-border-subtle hover:border-border-glow bg-bg-deep/40 text-text-sub hover:text-text-main rounded-xl transition-colors cursor-pointer font-mono text-[10px] uppercase tracking-[1px]"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Default open state */
            <div className="flex flex-col sm:flex-row gap-3">
              {/* One-click PR */}
              <button
                onClick={() => {
                  if (!hasOneClickPr) {
                    showToast("One-click fix PR is a premium feature. Please upgrade your plan.", "warning");
                    router.push("/settings?upgrade=pro");
                  } else {
                    setIsReviewing(true);
                  }
                }}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer",
                  hasOneClickPr
                    ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/10"
                    : "bg-bg-card border border-border-glow text-text-muted hover:border-indigo-500/30 hover:text-indigo-500 dark:hover:text-indigo-400"
                )}
              >
                <GitPullRequest size={14} />
                {hasOneClickPr ? "Start Code Review Merge" : "⚡ Upgrade for 1-Click PR"}
              </button>

              {/* Copy */}
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-6 py-3.5 border border-border-subtle hover:border-border-glow bg-bg-deep/40 text-text-sub hover:text-text-main rounded-xl transition-colors cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold">
                  {copied ? "Copied" : "Copy Fix"}
                </span>
              </button>

              {/* Dismiss */}
              <button
                onClick={handleDismiss}
                className="flex items-center justify-center gap-2 px-5 py-3.5 border border-border-subtle hover:border-rose-500/20 bg-bg-deep/40 hover:bg-rose-500/5 text-text-muted hover:text-rose-500 rounded-xl transition-colors cursor-pointer"
              >
                <X size={14} />
                <span className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold">Dismiss</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PR Runner console ───────────────────────────────────────────── */}
      {isFixing && (
        <div className="dark:bg-black bg-bg-panel border border-border-subtle rounded-2xl overflow-hidden font-mono text-[11px] text-text-muted flex flex-col shadow-xl animate-slide-up">
          <div className="dark:bg-slate-950 bg-bg-card px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-lime-500 dark:text-lime-400" />
              <span className="text-text-sub font-bold">AUTOMATED PULL REQUEST RUNNER</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-lime-500 dark:bg-lime-400 animate-ping" />
          </div>
          <div className="p-4 overflow-y-auto space-y-1.5 leading-relaxed" style={{ maxHeight: "200px" }}>
            {fixLogs.map((log, index) => (
              <div
                key={index}
                className={
                  log.includes("[GITHUB]") ? "text-amber-400" :
                  log.includes("[AST]") ? "text-violet-400" :
                  log.includes("[TESTER]") ? "text-cyan-400" :
                  "text-slate-400"
                }
              >
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
  );
}
