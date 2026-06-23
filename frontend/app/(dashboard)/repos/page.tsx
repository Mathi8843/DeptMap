"use client";
import React, { useState, useRef, useEffect } from "react";
import { useData } from "@/lib/contexts/DataContext";
import { useScan } from "@/lib/contexts/ScanContext";
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
  const { repos, issues } = useData();
  const { triggerScan, isScanning, scanLogs, scanProgress, scanStatus } = useScan();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [activeScanningRepo, setActiveScanningRepo] = useState<string | null>(null);

  // Terminal State — static CLI for manual commands
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "DebtMap Workspace CLI Console v1.0",
    'Type "help" to view list of available audit commands.',
    ""
  ]);

  // Merge real scan logs from AppContext into the terminal display whenever a scan is active
  // scanLogs comes from AppContext polling /api/scans/{id}/status → log_messages in DB
  const displayLogs: string[] = isScanning || scanStatus === "completed" || scanStatus === "failed"
    ? scanLogs
    : terminalLogs;
  
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const handleScanRepo = async (repoId: string) => {
    setActiveScanningRepo(repoId);
    await triggerScan(repoId);
    setActiveScanningRepo(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return { text: "text-emerald-500 dark:text-emerald-400", stroke: "stroke-emerald-500 dark:stroke-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    if (score >= 40) return { text: "text-amber-500 dark:text-amber-400", stroke: "stroke-amber-500 dark:stroke-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    return { text: "text-rose-500 dark:text-rose-400", stroke: "stroke-rose-600 dark:stroke-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" };
  };

  // Auto-scroll terminal container whenever logs update (real scan logs or manual CLI logs)
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [displayLogs]);

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
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

      {/* Repos and CLI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Repos list */}
        <div className="lg:col-span-2 space-y-4">
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
                      <circle cx="32" cy="32" r="28" className="stroke-slate-200 dark:stroke-slate-800 fill-none" strokeWidth="3.5" />
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
                        <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
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
                    className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[1px] font-bold px-[1.125rem] py-2.5 border border-border-subtle hover:border-border-glow bg-bg-deep text-text-sub hover:text-text-main rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isRepoScanning ? "animate-spin" : ""} />
                    {isRepoScanning ? "Scanning..." : "Scan Workspace"}
                  </button>
                  <Link
                    href="/issues"
                    className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] px-[1.125rem] py-2.5 bg-lime-400 hover:bg-lime-500 text-slate-950 rounded-xl transition-colors text-center cursor-pointer"
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
            className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 bg-bg-card/50 hover:bg-bg-card border border-dashed border-border-subtle hover:border-indigo-500/30 rounded-2xl p-6 transition-all group cursor-pointer"
          >
            <Plus size={18} className="text-text-muted group-hover:text-indigo-500 transition-colors" />
            <span className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold text-text-muted group-hover:text-indigo-500 transition-colors">
              Connect Another Workspace Repository
            </span>
          </button>
        </div>

        {/* CLI Terminal */}
        <section aria-labelledby="cli-heading" className="lg:col-span-1 space-y-3.5">
          <h2 id="cli-heading" className="sr-only">CLI Terminal</h2>
          <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold flex items-center gap-1.5">
            <Terminal size={14} className="text-indigo-500" /> CLI Terminal Console
          </h3>
          
          <div className="bg-[#030308] border border-zinc-800/80 rounded-2xl overflow-hidden font-mono text-xs flex flex-col h-[280px] shadow-2xl">
            {/* Header */}
            <div className="bg-black/40 px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
              <span className="text-slate-400 font-bold tracking-wide text-[9px] truncate">
                {isScanning ? "LIVE SCAN" : "INTERACTIVE CLI"}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isScanning && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-emerald-400 font-mono">{scanProgress}%</span>
                  </div>
                )}
                <div className="flex gap-1 items-center">
                  <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
                  <span className="text-[9px] text-slate-600 uppercase">{isScanning ? "Active" : "Online"}</span>
                </div>
              </div>
            </div>

            {/* Logs */}
            <div ref={logsContainerRef} className="flex-1 p-4 overflow-y-auto space-y-1.5 select-text text-emerald-400 text-[11px] leading-relaxed">
              {displayLogs.map((log, index) => (
                <div
                  key={index}
                  className={clsx(
                    log.startsWith("$") && "text-slate-100 font-bold",
                    log.includes("Vulnerability") && "text-rose-400",
                    log.includes("running:") && "text-slate-500 italic",
                    log.startsWith("[SEMGREP]") && "text-cyan-400",
                    log.startsWith("[GITLEAKS]") && "text-purple-400",
                    log.startsWith("[GROQ]") && "text-yellow-400",
                    log.startsWith("[REGISTRY]") && "text-blue-400",
                    log.startsWith("[SCORER]") && "text-emerald-400",
                    log.startsWith("[DB]") && "text-slate-400",
                    log.startsWith("[SYSTEM]") && "text-slate-300",
                    log.startsWith("[SUCCESS]") && "text-emerald-300 font-bold",
                    log.startsWith("[ERROR]") && "text-rose-400 font-bold",
                  )}
                >
                  {log}
                </div>
              ))}
            </div>

            {/* Input field */}
            <form onSubmit={handleTerminalSubmit} className="bg-black/50 px-4 py-3 border-t border-zinc-800/50 flex items-center gap-2">
              <span className="text-slate-100 font-bold">$</span>
              <input
                type="text"
                placeholder={isScanning ? "Scan in progress..." : 'Type e.g. "help", "semgrep"...'}
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                disabled={isScanning}
                className="flex-1 bg-transparent border-none focus-visible:outline-none focus-visible:ring-0 text-white text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </form>
          </div>
        </section>
      </div>

      {/* Connect Repo Modal Container */}
      <ConnectRepoModal 
        isOpen={connectModalOpen} 
        onClose={() => setConnectModalOpen(false)} 
      />
    </div>
  );
}
