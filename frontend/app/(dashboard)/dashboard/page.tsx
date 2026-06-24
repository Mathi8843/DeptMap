"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import GitHubPermissionsModal from "@/components/layout/GitHubPermissionsModal";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useData } from "@/lib/contexts/DataContext";
import { useScan } from "@/lib/contexts/ScanContext";
import { useToast } from "@/lib/contexts/ToastContext";
import { RefreshCw, Download, AlertTriangle, ShieldAlert, CheckCircle, ArrowUpRight, Terminal, Bell, MessageSquare, Mail, GitBranch, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

const Sparkline = dynamic(() => import("./Sparkline"), { ssr: false });

export default function DashboardPage() {
  const { user } = useAuth();
  const { issues, repos, overallScore, packages, webhookAlerts, trendData } = useData();
  const { isScanning, scanProgress, scanLogs, scanStatus, triggerScan, terminalOpen, setTerminalOpen } = useScan();
  const { showToast } = useToast();
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);

  const showTerminal = terminalOpen;
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal to bottom as logs come in
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scanLogs]);

  // Escape key dismisses terminal
  useEffect(() => {
    if (!showTerminal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTerminalOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showTerminal, setTerminalOpen]);

  const handleConnectGitHub = async () => {
    try {
      const data = await apiFetch(`/auth/github?current_user_id=${user.id}`);
      if (data && data.auth_url) {
        sessionStorage.setItem("auth_redirect", "/dashboard");
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      showToast(err.message || "Failed to retrieve GitHub connection link.", "error");
    }
  };

  const openIssues = issues.filter((i) => i.status === "open");
  const critical = openIssues.filter((i) => i.severity === "critical");
  const high = openIssues.filter((i) => i.severity === "high");
  const fixed = issues.filter((i) => i.status === "fixed").length;
  const dangerPackages = packages.filter((p) => p.status === "dangerous").length;

  // Export audit report as JSON
  const handleExport = useCallback(() => {
    if (issues.length === 0) {
      showToast("No audit data to export. Run a scan first.", "warning");
      return;
    }
    const report = {
      generatedAt: new Date().toISOString(),
      overallScore,
      openIssues: openIssues.length,
      criticalAlerts: critical.length,
      remediatedPRs: fixed,
      issues: issues.map((i) => ({
        id: i.id,
        severity: i.severity,
        status: i.status,
        title: i.plain_english_title,
        file: `${i.file_path}:${i.line_start}`,
      })),
      packages: {
        total: packages.length,
        dangerous: packages.filter((p) => !p.exists_in_registry).length,
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debtmap-audit-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [issues, overallScore, openIssues.length, critical.length, fixed, packages]);

  const handleRunScan = () => { triggerScan(); };

  const getScoreColor = (score: number) => {
    if (score >= 70) return { text: "text-emerald-500 dark:text-emerald-400", border: "border-emerald-500/20", glow: "glow-teal", bg: "bg-emerald-500/10", stroke: "#10b981" };
    if (score >= 40) return { text: "text-amber-500 dark:text-amber-400", border: "border-amber-500/20", glow: "glow-amber", bg: "bg-amber-500/10", stroke: "#f59e0b" };
    return { text: "text-rose-500 dark:text-rose-400", border: "border-rose-500/20", glow: "glow-rose", bg: "bg-rose-500/10", stroke: "#f43f5e" };
  };

  const scoreTheme = getScoreColor(overallScore);

  // Color-code each log line by its engine prefix — matches exactly what backend sends
  const getLogColor = (log: string): string => {
    if (log.startsWith("[SUCCESS]"))  return "text-emerald-400 font-bold";
    if (log.startsWith("[ERROR]"))    return "text-rose-400 font-bold";
    if (log.startsWith("[SYSTEM]"))   return "text-indigo-400";
    if (log.startsWith("[SEMGREP]"))  return "text-cyan-400";
    if (log.startsWith("[GITLEAKS]")) return "text-purple-400";
    if (log.startsWith("[GROQ]"))     return "text-yellow-400";
    if (log.startsWith("[REGISTRY]")) return "text-blue-400";
    if (log.startsWith("[SCORER]"))   return "text-emerald-400";
    if (log.startsWith("[DB]"))       return "text-slate-400";
    return "text-slate-300";
  };

  // Sparkline data generators — derive from trendData when available
  const { healthSparkData, openSparkData, criticalSparkData, fixedSparkData } = useMemo(() => {
    if (trendData && trendData.length > 1) {
      const sorted = [...trendData].sort(
        (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const health = sorted.map((d: any) => ({ v: d.score }));
      let cumOpen = 0;
      const open = sorted.map((d: any) => {
        cumOpen += (d.introduced || 0) - (d.fixed || 0);
        return { v: Math.max(0, cumOpen) };
      });
      const critVals = sorted.map((_: any, i: number) => ({
        v: Math.round(critical.length * (i + 1) / sorted.length),
      }));
      let cumFixed = 0;
      const fixedVals = sorted.map((d: any) => {
        cumFixed += d.fixed || 0;
        return { v: cumFixed };
      });
      return { healthSparkData: health, openSparkData: open, criticalSparkData: critVals, fixedSparkData: fixedVals };
    }
    return {
      healthSparkData: [{ v: 80 }, { v: 75 }, { v: 68 }, { v: 62 }, { v: 55 }, { v: 47 }, { v: 41 }, { v: 38 }, { v: overallScore }],
      openSparkData:   [{ v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 6 }, { v: openIssues.length }],
      criticalSparkData: [{ v: 0 }, { v: 1 }, { v: 1 }, { v: 1 }, { v: 2 }, { v: 2 }, { v: 2 }, { v: 2 }, { v: critical.length }],
      fixedSparkData:  [{ v: 1 }, { v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }, { v: 3 }, { v: 4 }, { v: 4 }, { v: fixed }],
    };
  }, [trendData, overallScore, openIssues.length, critical.length, fixed]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 relative min-h-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">Security Status</h1>
          <p className="text-sm text-text-sub mt-1">Real-time vulnerability monitor and AI remediation desk</p>
        </div>
        <div className="flex items-center gap-3">
          {scanStatus !== "idle" && scanLogs.length > 0 && (
            <button 
              onClick={() => setTerminalOpen(true)}
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1px] font-bold px-5 py-3 border border-border-subtle hover:border-border-glow bg-bg-deep text-text-sub rounded-xl transition-all cursor-pointer hover:bg-bg-panel/40"
            >
              <Terminal size={14} /> Show Logs
            </button>
          )}
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1px] font-bold px-5 py-3 border border-border-subtle hover:border-border-glow bg-bg-deep text-text-sub rounded-xl transition-all cursor-pointer hover:bg-bg-panel/40"
          >
            <Download size={14} /> Export Audit Report
          </button>
          <button 
            onClick={handleRunScan}
            disabled={isScanning}
            aria-busy={isScanning}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[1px] font-bold px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
            {isScanning ? "Running Audit..." : "Run Security Scan"}
          </button>
        </div>
      </div>

      {/* GitHub Connection Banner */}
      {!user.has_github_token && (
        <div className="glass-panel border-l-4 border-l-indigo-500 rounded-2xl p-5 flex gap-4 items-start glow-indigo animate-fade-in">
          <GitBranch className="text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="text-sm font-bold text-text-main">GitHub Account Not Connected</h4>
            <p className="text-xs text-text-sub leading-relaxed">Please connect your GitHub account to import and scan your repositories.</p>
          </div>
          <button onClick={() => setPermissionsModalOpen(true)} className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[1px] text-[#b8ff57] hover:underline flex-shrink-0 mt-0.5 cursor-pointer">
            Connect GitHub <ArrowUpRight size={14} />
          </button>
        </div>
      )}

      {/* Critical Alert Banner */}
      {critical.length > 0 && (
        <div className="glass-panel border-l-4 border-l-rose-500 rounded-2xl p-5 flex gap-4 items-start glow-rose animate-fade-in">
          <ShieldAlert className="text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="text-sm font-bold text-text-main">Critical Exposure Detected</h4>
            <p className="text-xs text-text-sub leading-relaxed">
              Active exploit route found in repository <strong className="text-text-main">{critical[0].repo_name}</strong>: {critical[0].plain_english_body}
            </p>
          </div>
          <Link href={`/issues/${critical[0].id}`} className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[1px] text-lime-500 dark:text-lime-400 hover:underline flex-shrink-0 mt-0.5 cursor-pointer">
            Apply Fix <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* Danger Packages Banner */}
      {dangerPackages > 0 && (
        <div className="glass-panel border-l-4 border-l-amber-500 rounded-2xl p-5 flex gap-4 items-start glow-amber animate-fade-in">
          <AlertTriangle className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="text-sm font-bold text-text-main">AI Dependency Risk (Slopsquatting)</h4>
            <p className="text-xs text-text-sub leading-relaxed">
              <strong className="text-text-main">{dangerPackages} dependencies</strong> found in your codebase that do not exist on the public npm repository registry.
            </p>
          </div>
          <Link href="/packages" className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[1px] text-lime-500 dark:text-lime-400 hover:underline flex-shrink-0 mt-0.5 cursor-pointer">
            Audit Packages <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-[140px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-[1.5px] text-text-muted font-bold">Health Score</div>
              <div className={`font-display font-extrabold text-3xl tracking-wide ${scoreTheme.text}`}>{overallScore}</div>
            </div>
            <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
              <svg aria-hidden="true" className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" className="stroke-bg-deep fill-none" strokeWidth="3.5" />
                <circle cx="32" cy="32" r="28" className="fill-none stroke-indigo-500 transition-all duration-1000" strokeWidth="3.5" strokeDasharray="176" strokeDashoffset={176 - (176 * overallScore) / 100} />
              </svg>
              <span className="absolute text-[11px] font-display font-extrabold text-indigo-500 dark:text-indigo-400">{overallScore}%</span>
            </div>
          </div>
            <Sparkline data={healthSparkData} stroke={scoreTheme.stroke} />
          </div>

        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-[140px]">
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-[1.5px] text-text-muted font-bold">Open Issues</div>
            <div className="font-display font-extrabold text-3xl text-text-main tracking-wide">{openIssues.length}</div>
          </div>
            <Sparkline data={openSparkData} stroke="#f59e0b" />
          </div>

        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-[140px]">
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-[1.5px] text-text-muted font-bold">Critical Alerts</div>
            <div className="font-display font-extrabold text-3xl text-rose-500 tracking-wide text-glow-rose">{critical.length}</div>
          </div>
            <Sparkline data={criticalSparkData} stroke="#f43f5e" />
          </div>

        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-[140px]">
          <div className="space-y-1">
            <div className="text-xs font-mono uppercase tracking-[1.5px] text-text-muted font-bold">Remediated PRs</div>
            <div className="font-display font-extrabold text-3xl text-emerald-500 dark:text-emerald-400 tracking-wide">{fixed}</div>
          </div>
            <Sparkline data={fixedSparkData} stroke="#10b981" />
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section aria-labelledby="workspaces-heading">
            <h2 id="workspaces-heading" className="sr-only">Connected Workspaces</h2>
            <div className="space-y-3.5">
            <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold">Connected Workspaces ({repos.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {repos.map((repo) => {
                const repoIssues = openIssues.filter((i) => i.repo_id === repo.id);
                const critCount = repoIssues.filter((i) => i.severity === "critical").length;
                const highCount = repoIssues.filter((i) => i.severity === "high").length;
                return (
                  <div key={repo.id} className="glass-card rounded-2xl p-5 flex items-center justify-between border border-border-subtle hover:border-border-glow">
                    <div className="space-y-1.5 min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="font-display font-bold text-sm text-text-main truncate">{repo.full_name.split("/")[1]}</span>
                        <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-bg-card border border-border-subtle text-text-sub uppercase">{repo.language}</span>
                      </div>
                      <div className="text-xs text-text-muted font-mono">CI generated: {repo.generator} · scanned 4m ago</div>
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        {critCount > 0 && <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-500">{critCount} critical</span>}
                        {highCount > 0 && <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">{highCount} high</span>}
                        {repoIssues.length === 0 && <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 flex items-center gap-1.5"><CheckCircle size={10} /> Clean</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className="relative w-14 h-14 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" aria-label={`Health score ${repo.health_score}`}>
                          <circle cx="28" cy="28" r="24" className="stroke-bg-deep fill-none" strokeWidth="3" />
                          <circle cx="28" cy="28" r="24" className={`fill-none transition-all duration-1000 ${repo.health_score >= 70 ? "stroke-emerald-400" : repo.health_score >= 40 ? "stroke-amber-400" : "stroke-rose-400"}`} strokeWidth="3" strokeDasharray={repo.health_score >= 70 ? "151" : repo.health_score >= 40 ? "8 6" : "3 4"} strokeDashoffset={151 - (151 * repo.health_score) / 100} />
                        </svg>
                        <div className={`absolute font-display font-extrabold text-xs ${getScoreColor(repo.health_score).text}`}>{repo.health_score}</div>
                      </div>
                      <button onClick={() => triggerScan(repo.id)} className="text-[10px] font-mono text-text-muted hover:text-indigo-500 cursor-pointer transition-colors">Scan Workspace</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </section>

          <section aria-labelledby="vulnerabilities-heading">
          <h2 id="vulnerabilities-heading" className="sr-only">Open Vulnerabilities</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold">Open Vulnerabilities (High & Critical)</h3>
              <Link href="/issues" className="font-mono text-[10px] text-indigo-500 hover:text-indigo-400 font-bold uppercase tracking-[1px] cursor-pointer">View All →</Link>
            </div>
            {openIssues.length === 0 ? (
              <div className="glass-card rounded-2xl py-14 text-center flex flex-col items-center justify-center">
                <CheckCircle className="text-emerald-500/80 mb-3" size={36} />
                <h4 className="text-sm font-bold text-text-main">Your Workspace is Secure</h4>
                <p className="text-xs text-text-muted mt-1.5 max-w-sm">All code vulnerabilities have been remediated or reviewed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {openIssues.filter((i) => ["critical", "high"].includes(i.severity)).slice(0, 3).map((issue) => {
                  const badgeColor = { critical: "bg-rose-500/10 text-rose-500 border-rose-500/20", high: "bg-amber-500/10 text-amber-500 border-amber-500/20", medium: "bg-blue-500/10 text-blue-500 border-blue-500/20", low: "bg-slate-800 text-text-sub border-white/5" }[issue.severity];
                  return (
                    <div key={issue.id} className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-border-subtle hover:border-border-glow group animate-fade-in">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-0.5 rounded border ${badgeColor}`}>{issue.severity}</span>
                          <span className="font-mono text-[10px] text-text-muted">{issue.repo_name} · {issue.file_path}:{issue.line_start}</span>
                        </div>
                        <h4 className="text-sm font-bold text-text-main group-hover:text-indigo-500 transition-colors">{issue.plain_english_title}</h4>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Link href={`/issues/${issue.id}`} className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] px-[1.125rem] py-2.5 bg-lime-400 hover:bg-lime-500 text-slate-950 rounded-xl transition-colors cursor-pointer text-center">Fix exposure</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </section>
        </div>

        <section aria-labelledby="alerts-heading">
        <h2 id="alerts-heading" className="sr-only">Integration Alerts</h2>
        <div className="space-y-4">
          <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold flex items-center gap-1.5">
            <Bell size={12} className="text-indigo-500" /> Integration Alert Feed
          </h3>
          <div className="glass-panel border border-border-subtle rounded-2xl p-5 h-[415px] flex flex-col justify-between">
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              {webhookAlerts.map((alert) => (
                <div key={alert.id} className="p-3.5 bg-bg-deep/50 border border-border-subtle rounded-xl space-y-2 flex gap-3 items-start animate-fade-in">
                  <div className="mt-0.5 flex-shrink-0">
                    {alert.type === "slack" ? (
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500"><MessageSquare size={13} /></div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500"><Mail size={13} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[9px] font-bold text-text-sub uppercase truncate pr-1">{alert.channel}</span>
                      <span className="font-mono text-[9px] text-text-muted flex-shrink-0">{alert.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-text-sub leading-relaxed break-words font-sans">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border-subtle pt-3.5 mt-3 text-[10px] text-text-muted leading-relaxed font-sans">
              Webhook alert signals trigger automatically when code scan indexes complete or when one-click AI patches are committed.
            </div>
          </div>
        </div>
        </section>
      </div>

      {/* ── Scan Terminal Overlay ─────────────────────────────────────────────── */}
      {showTerminal && (
        <div role="alert" className="fixed inset-0 z-[999] flex items-center justify-center" style={{ padding: "calc(env(safe-area-inset-top, 0px) + 1rem) calc(env(safe-area-inset-right, 0px) + 1rem) calc(env(safe-area-inset-bottom, 0px) + 1rem) calc(env(safe-area-inset-left, 0px) + 1rem)" }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setTerminalOpen(false)} />
          <div className="relative w-full max-w-xl bg-black border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10 font-mono text-xs flex flex-col h-[420px]">

            {/* Terminal header */}
            <div className="bg-slate-950 px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={15} className="text-indigo-400" />
                <span className="text-white font-bold tracking-wide">DEBTMAP AUDIT RUNNER v1.4</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Engine legend */}
                <div className="hidden sm:flex items-center gap-2 text-[9px]">
                  <span className="text-cyan-400">SEMGREP</span>
                  <span className="text-purple-400">GITLEAKS</span>
                  <span className="text-yellow-400">GROQ</span>
                  <span className="text-blue-400">DEPS</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/30" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
                  <div className={`w-2.5 h-2.5 rounded-full ${isScanning ? "bg-emerald-500 animate-pulse" : "bg-emerald-500/50"}`} />
                </div>
                {/* Close button */}
                <button
                  onClick={() => setTerminalOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close terminal"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Log output */}
            <div className="flex-1 p-5 overflow-y-auto space-y-1.5 leading-relaxed">
              {scanLogs.length === 0 ? (
                <span className="text-slate-500 italic">Waiting for scan to start...</span>
              ) : (
                scanLogs.map((log, idx) => (
                  <div key={idx} className={getLogColor(log)}>
                    {log}
                  </div>
                ))
              )}
              {/* Blinking cursor — only while scanning */}
              {isScanning && (
                <div className="text-slate-400 flex items-center gap-1.5 mt-1">
                  <span>$</span>
                  <span className="w-1.5 h-4 bg-slate-400 animate-pulse inline-block" />
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Progress bar footer */}
            <div className="bg-slate-950 px-5 py-4 border-t border-white/10 flex items-center justify-between gap-4">
              <div className="flex-1 bg-slate-900 rounded-full h-2.5 overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-300 shadow-md ${
                    scanStatus === "failed" ? "bg-rose-500 shadow-rose-500/45" :
                    scanStatus === "completed" ? "bg-emerald-500 shadow-emerald-500/45" :
                    "bg-indigo-500 shadow-indigo-500/45"
                  }`}
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold ${
                  scanStatus === "failed" ? "text-rose-400" :
                  scanStatus === "completed" ? "text-emerald-400" :
                  "text-white"
                }`}>
                  {scanStatus === "completed" ? "COMPLETE" : scanStatus === "failed" ? "FAILED" : `${scanProgress}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <GitHubPermissionsModal 
        isOpen={permissionsModalOpen} 
        onClose={() => setPermissionsModalOpen(false)} 
        onConfirm={handleConnectGitHub} 
      />
    </div>
  );
}