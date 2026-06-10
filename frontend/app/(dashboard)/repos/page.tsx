"use client";
import React, { useState, useRef, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import Link from "next/link";
import { GitBranch, Plus, RefreshCw, Lock, Globe, Clock, ShieldCheck, Terminal, X } from "lucide-react";
import ConnectRepoModal from "@/components/layout/ConnectRepoModal";
import clsx from "clsx";

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export default function ReposPage() {
  const { repos, issues, triggerScan } = useApp();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [activeScanningRepo, setActiveScanningRepo] = useState<string | null>(null);

  // Terminal State
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "DebtMap Workspace CLI Console v1.0",
    'Type "help" to view list of available audit commands.',
    ""
  ]);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const handleScanRepo = async (repoId: string) => {
    setActiveScanningRepo(repoId);
    await triggerScan(repoId);
    setActiveScanningRepo(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return { text: "text-emerald-500 dark:text-emerald-400", stroke: "stroke-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    if (score >= 40) return { text: "text-amber-500 dark:text-amber-400", stroke: "stroke-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    return { text: "text-rose-500 dark:text-rose-400", stroke: "stroke-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" };
  };

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Terminal commands handling
  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = terminalInput.trim().toLowerCase();
    if (!cmd) return;

    const newLogs = [...terminalLogs, `$ ${terminalInput}`];

    if (cmd === "help") {
      newLogs.push(
        "Available workspace CLI utilities:",
        "  semgrep      - Run semantic code scanner",
        "  npm audit    - Audit node dependencies registry",
        "  git log      - Display recent security commits log",
        "  clear        - Clear console history buffer"
      );
    } else if (cmd === "clear") {
      setTerminalLogs([
        "DebtMap Workspace CLI Console v1.0",
        'Type "help" to view list of available audit commands.',
        ""
      ]);
      setTerminalInput("");
      return;
    } else if (cmd === "semgrep") {
      newLogs.push(
        "running: semgrep --config auto .",
        "scanning src/api/users.js ... [1 warning]",
        "scanning src/payment.js ... [1 warning]",
        "scanning src/api/search.js ... [0 warnings]",
        "  Vulnerability BOLA missing ownership check found: src/api/users.js:47",
        "  Vulnerability Hardcoded Stripe secret key found: src/payment.js:12",
        "Scan complete. 2 vulnerabilities identified."
      );
    } else if (cmd === "npm audit") {
      newLogs.push(
        "running: npm audit",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "=== npm audit Security Report ===",
        "Severity: Critical (2)",
        "  - express-auth-middleware-pro (Hallucinated package risk)",
        "  - supabase-rls-helper (Hallucinated package risk)",
        "",
        "Severity: Suspect (1)",
        "  - next-api-validator (12 downloads weekly threshold warning)",
        "",
        "Scan complete. Review safety options in Packages dashboard."
      );
    } else if (cmd === "git log") {
      newLogs.push(
        "commit f22a901 (HEAD -> main, origin/main)",
        "Author: Mathivanan G <mathi@debtmap.io>",
        "Date:   Wed Jun 10 10:50:00 2026 +0530",
        "    security-fix: resolve Stripe hardcoded secret key exposure",
        "",
        "commit a89c1b3",
        "Author: Lovable Agent <lovable@lovable.dev>",
        "Date:   Wed Jun 10 10:48:00 2026 +0530",
        "    feat: create database models and router middleware routes"
      );
    } else {
      newLogs.push(`Command not found: "${cmd}". Type "help" to view list of available commands.`);
    }

    newLogs.push(""); // spacer
    setTerminalLogs(newLogs);
    setTerminalInput("");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
            Connected Workspaces
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Linked repositories audited by continuous analysis rules
          </p>
        </div>
        <button
          onClick={() => setConnectModalOpen(true)}
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1px] font-bold px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/15 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={14} />
          Connect GitHub Repo
        </button>
      </div>

      {/* Repos list */}
      <div className="space-y-4">
        {repos.map((repo) => {
          const repoIssues = issues.filter((i) => i.repo_id === repo.id && i.status === "open");
          const critical = repoIssues.filter((i) => i.severity === "critical").length;
          const high = repoIssues.filter((i) => i.severity === "high").length;
          const clr = getScoreColor(repo.health_score);
          const isRepoScanning = activeScanningRepo === repo.id;

          return (
            <div 
              key={repo.id} 
              className="glass-card rounded-2xl p-5 border border-border-subtle hover:border-border-glow transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 group animate-fade-in"
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                {/* SVG circular score gauge */}
                <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" className="stroke-bg-deep fill-none" strokeWidth="3.5" />
                    <circle 
                      cx="32" cy="32" r="28" 
                      className={`fill-none transition-all duration-1000 ${clr.stroke}`} 
                      strokeWidth="3.5" 
                      strokeDasharray="176"
                      strokeDashoffset={176 - (176 * repo.health_score) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className={`absolute font-display font-extrabold text-xs ${clr.text}`}>
                    {repo.health_score}
                  </span>
                </div>

                {/* Metadata */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-display font-bold text-base text-text-main truncate group-hover:text-indigo-500 transition-colors">
                      {repo.full_name}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[9px] text-text-muted uppercase">
                      {repo.is_private ? <Lock size={10} className="text-text-muted" /> : <Globe size={10} className="text-text-muted" />}
                      {repo.is_private ? "Private" : "Public"}
                    </span>
                    <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-bg-card border border-border-subtle text-text-sub uppercase">
                      {repo.language}
                    </span>
                    <span className="font-mono text-[9px] text-purple-500 dark:text-purple-400 px-2 py-0.5 bg-purple-500/10 rounded-full">
                      {repo.generator}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
                    <Clock size={12} />
                    <span>Scanned {timeAgo(repo.last_scanned_at)}</span>
                    <span>·</span>
                    <span>branch: {repo.default_branch}</span>
                  </div>

                  {/* Vulnerability indicators */}
                  <div className="flex gap-2 pt-1.5 flex-wrap">
                    {critical > 0 && (
                      <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        {critical} critical exposure{critical > 1 ? "s" : ""}
                      </span>
                    )}
                    {high > 0 && (
                      <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        {high} high risk{high > 1 ? "s" : ""}
                      </span>
                    )}
                    {repoIssues.length === 0 && (
                      <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                        <ShieldCheck size={12} /> Safe workspace
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => handleScanRepo(repo.id)}
                  disabled={isRepoScanning}
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[1px] font-bold px-4.5 py-2.5 border border-border-subtle hover:border-border-glow bg-bg-deep text-text-sub hover:text-text-main rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isRepoScanning ? "animate-spin" : ""} />
                  {isRepoScanning ? "Scanning..." : "Scan Workspace"}
                </button>
                <Link
                  href="/issues"
                  className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] px-4.5 py-2.5 bg-lime-400 hover:bg-lime-500 text-slate-950 rounded-xl transition-colors text-center cursor-pointer"
                >
                  View Issues
                </Link>
              </div>
            </div>
          );
        })}

        {/* Connect box */}
        <button
          onClick={() => setConnectModalOpen(true)}
          className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 bg-bg-deep/20 hover:bg-bg-deep/40 border border-dashed border-border-subtle hover:border-border-glow rounded-2xl p-6 transition-all group cursor-pointer"
        >
          <Plus size={18} className="text-text-muted group-hover:text-indigo-500 transition-colors" />
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold text-text-muted group-hover:text-indigo-500 transition-colors">
            Connect Another Workspace Repository
          </span>
        </button>
      </div>

      {/* Retro developer CLI Console terminal bottom widget - styled dark but theme-adjusted */}
      <div className="space-y-3.5">
        <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold flex items-center gap-1.5">
          <Terminal size={14} className="text-indigo-500" /> Workspace Command Line Explorer (CLI)
        </h3>
        
        <div className="bg-[#030308] border border-border-subtle rounded-2xl overflow-hidden font-mono text-xs flex flex-col h-[280px] shadow-2xl">
          {/* Header */}
          <div className="bg-black/40 px-5 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-slate-400 font-bold tracking-wide text-[10px]">DEBTMAP INTERACTIVE CLI</span>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] text-slate-600">ONLINE</span>
            </div>
          </div>

          {/* Logs */}
          <div className="flex-1 p-5 overflow-y-auto space-y-1.5 select-text text-emerald-400 text-xs leading-relaxed">
            {terminalLogs.map((log, index) => (
              <div 
                key={index} 
                className={clsx(
                  log.startsWith("$") && "text-slate-100 font-bold",
                  log.includes("Vulnerability") && "text-rose-400",
                  log.includes("running:") && "text-slate-500 italic"
                )}
              >
                {log}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          {/* Input field */}
          <form onSubmit={handleTerminalSubmit} className="bg-black/50 px-5 py-3 border-t border-border-subtle flex items-center gap-2">
            <span className="text-slate-100 font-bold">$</span>
            <input
              type="text"
              placeholder='Type a command like "help", "semgrep", "npm audit" or "git log" and press Enter...'
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-white text-xs"
            />
          </form>
        </div>
      </div>

      {/* Connect Repo Modal Container */}
      <ConnectRepoModal 
        isOpen={connectModalOpen} 
        onClose={() => setConnectModalOpen(false)} 
      />
    </div>
  );
}
