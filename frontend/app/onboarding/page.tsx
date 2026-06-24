"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useData } from "@/lib/contexts/DataContext";
import { useScan } from "@/lib/contexts/ScanContext";
import { useToast } from "@/lib/contexts/ToastContext";
import { Lock, Globe, GitBranch, ChevronRight, Check, Terminal, Shield, AlertTriangle, Zap, ArrowRight, Loader2, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/contexts/ThemeContext";

const STEPS = [
  { id: 1, label: "Connect GitHub" },
  { id: 2, label: "Select Repo" },
  { id: 3, label: "Run First Scan" },
  { id: 4, label: "View Results" },
];

const GENERATORS = ["Lovable", "Bolt", "Cursor", "Replit", "v0", "Other"];

import { apiFetch, getSavedUser } from "@/lib/api";
import GitHubPermissionsModal from "@/components/layout/GitHubPermissionsModal";

export default function OnboardingPage() {
  useEffect(() => { document.title = "Onboarding — DebtMap"; }, []);
  const router = useRouter();
  const { user } = useAuth();
  const { repos, issues, connectRepo } = useData();
  const { triggerScan, scanLogs, scanProgress, isScanning, scanStatus } = useScan();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();

  const [step, setStep] = useState(1);
  const [githubConnected, setGithubConnected] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [selectedGenerator, setSelectedGenerator] = useState<string>("Lovable");
  const [scanStarted, setScanStarted] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  
  // Real repositories fetched from user's GitHub account
  const [reposList, setReposList] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Sync selected repository default branch and fetch available branches
  useEffect(() => {
    if (!selectedRepo) {
      setBranches([]);
      setBranch("");
      return;
    }
    const repo = reposList.find((r) => r.full_name === selectedRepo);
    if (repo && repo.default_branch) {
      setBranch(repo.default_branch);
    }

    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        const list = await apiFetch(`/repos/github-branches?repo_name=${encodeURIComponent(selectedRepo)}`);
        setBranches(list || ["main", "master"]);
      } catch (err) {
        console.error("Failed to fetch branches:", err);
        setBranches(["main", "master"]);
      } finally {
        setLoadingBranches(false);
      }
    };
    fetchBranches();
  }, [selectedRepo, reposList]);

  // Auto-detect if user already authorized GitHub on mount
  useEffect(() => {
    const saved = getSavedUser();
    const isMockToken = saved?.session_token === "mock-session-token";
    const isProduction = process.env.NODE_ENV === "production";
    
    // Only auto-skip if github is connected and it's not a mock token in production
    if (saved && saved.has_github_token && !(isMockToken && isProduction)) {
      setTimeout(() => {
        setGithubConnected(true);
        setStep(2);
      }, 0);
    }
  }, []);

  // Synchronize scanStarted if the application is already scanning
  useEffect(() => {
    if (isScanning || scanStatus === "queued" || scanStatus === "running") {
      setTimeout(() => {
        setScanStarted(true);
      }, 0);
    }
  }, [isScanning, scanStatus]);

  // Handle automatic transition to Step 4 when scan finishes successfully
  useEffect(() => {
    if (scanStatus === "completed") {
      setTimeout(() => {
        setScanDone(true);
      }, 0);
      const timer = setTimeout(() => {
        setStep(4);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [scanStatus]);

  // Fetch repositories from backend once GitHub is connected
  useEffect(() => {
    if (githubConnected) {
      const fetchGithubRepos = async () => {
        setLoadingRepos(true);
        try {
          const fetched = await apiFetch("/repos/github-list");
          setReposList(fetched);
        } catch (err: any) {
          console.error("Failed to load GitHub repos:", err);
          showToast(err.message || "Failed to load GitHub repositories. Please connect your GitHub account again.", "error");
          setReposList([]);
          
          // Re-authenticate if token is missing or invalid
          if (err.status === 400 || (err.message && (err.message.includes("token") || err.message.includes("authenticate")))) {
            setGithubConnected(false);
            setStep(1);
          }
        } finally {
          setLoadingRepos(false);
        }
      };
      fetchGithubRepos();
    }
  }, [githubConnected, showToast]);

  const handleConnectGitHub = async () => {
    try {
      setStatusMessage("Retrieving authorization link from server...");
      const data = await apiFetch(`/auth/github?current_user_id=${user.id}`);
      if (data && data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        throw new Error("No authorization URL returned from backend");
      }
    } catch (err: any) {
      console.error("GitHub authorization redirect failed:", err);
      showToast(err.message || "Failed to retrieve GitHub connection link. Please check your network connection.", "error");
      setStatusMessage("Authorize DebtMap on GitHub");
    }
  };

  const [statusMessage, setStatusMessage] = useState("Authorize DebtMap on GitHub");

  const handleSelectRepo = (repoName: string) => {
    setSelectedRepo(repoName);
  };

  const handleConfirmRepo = async () => {
    if (!selectedRepo) return;
    const repo = reposList.find((r) => r.full_name === selectedRepo);
    if (!repo) return;
    
    await connectRepo(
      repo.full_name,
      repo.language || "TypeScript",
      selectedGenerator,
      repo.is_private ?? true,
      branch || repo.default_branch || "main",
      false
    );
    setStep(3);
  };

  const handleStartScan = async () => {
    setScanStarted(true);
    // Find the repo we just connected to get its real ID from backend repos state
    const connectedRepo = repos.find((r) => r.full_name === selectedRepo);
    if (connectedRepo) {
      await triggerScan(connectedRepo.id);
    } else {
      await triggerScan();
    }
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  // Find info of the repo we just scanned to display dynamic stats in Step 4
  const targetRepo = repos.find((r) => r.full_name === selectedRepo);
  const repoIssues = issues.filter((i) => i.repo_id === (targetRepo?.id || ""));
  const openIssuesCount = repoIssues.filter((i) => i.status === "open").length;
  const criticalCount = repoIssues.filter((i) => i.status === "open" && i.severity === "critical").length;
  const healthScore = targetRepo?.health_score ?? 100;


  const background = theme === "dark"
    ? "radial-gradient(ellipse at 50% 0%, #15102a 0%, #06060c 65%)"
    : "radial-gradient(ellipse at 50% 0%, #c7d2fe 0%, #e2e8f0 35%, #f1f5f9 100%)";

  return (
    <div
      style={{ background }}
      className="min-h-screen text-text-main flex flex-col transition-all duration-200"
    >
      {/* Top bar */}
      <div className="border-b border-border-subtle px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-sm">D</div>
          <span className="font-bold text-base text-text-main">DebtMap</span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-lg border border-border-subtle hover:bg-border-subtle text-text-sub hover:text-text-main transition-all cursor-pointer"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link href="/dashboard" className="font-mono text-[10px] text-text-muted hover:text-text-sub uppercase tracking-widest transition-colors">
            Skip → View Demo
          </Link>
        </div>
      </div>

      {/* Step Progress Bar */}
      <div className="border-b border-border-subtle px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <div className="flex items-center gap-0 min-w-[400px] sm:min-w-0">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step > s.id
                        ? "bg-emerald-500 text-white dark:bg-[#b8ff57] dark:text-black"
                        : step === s.id
                        ? "bg-indigo-500 text-white"
                        : "bg-bg-card border border-border-subtle text-text-muted"
                    }`}
                  >
                    {step > s.id ? <Check size={14} /> : s.id}
                  </div>
                  <span className={`font-mono text-[9px] uppercase tracking-[1px] whitespace-nowrap ${step >= s.id ? "text-text-sub" : "text-text-muted"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 mb-5 transition-all ${step > s.id ? "bg-emerald-500/30 dark:bg-[#b8ff57]/40" : "bg-border-subtle"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-2xl">

          {/* STEP 1 — Connect GitHub */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in text-center">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-text-muted mb-3">Step 1 of 4</div>
                <h1 className="text-2xl sm:text-4xl font-extrabold mb-4 text-text-main">Connect your GitHub account</h1>
                <p className="text-text-sub text-lg max-w-md mx-auto">
                  We need read access to your repositories to scan for security vulnerabilities.
                </p>
              </div>

              {!githubConnected ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setPermissionsModalOpen(true)}
                    className="w-full max-w-sm mx-auto flex items-center justify-center gap-3 py-4 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:text-black dark:hover:bg-[#d4ff8a] rounded-xl font-semibold text-sm transition-all shadow-lg cursor-pointer"
                  >
                    <GitBranch size={20} /> Authorize DebtMap on GitHub
                  </button>
                  <p className="font-mono text-[10px] text-text-muted">{statusMessage}</p>
                  <p className="text-[11px] text-text-muted font-mono">
                    We only request <strong className="text-text-sub">read access</strong> to your code. We never write or store your source code.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  <Check size={18} /> GitHub Connected Successfully
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                {[
                  { icon: Shield, label: "Read-only access" },
                  { icon: Lock, label: "No code stored" },
                  { icon: Zap, label: "Scan in 60 seconds" },
                ].map((f) => (
                  <div key={f.label} className="bg-bg-card border border-border-subtle rounded-xl p-4 space-y-2">
                    <f.icon size={20} className="text-indigo-500 dark:text-[#b8ff57] mx-auto" />
                    <div className="text-xs text-text-sub">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Select Repo */}
          {step === 2 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-text-muted mb-3">Step 2 of 4</div>
                <h1 className="text-2xl sm:text-4xl font-extrabold mb-4 text-text-main">Select a repository to scan</h1>
                <p className="text-text-sub">Choose the app you want to audit. You can add more repositories later.</p>
              </div>

              {loadingRepos ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <Loader2 className="animate-spin text-indigo-400" size={24} />
                  <p className="text-xs text-text-sub font-mono">Loading repositories from GitHub...</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {reposList.map((repo) => (
                    <button
                      key={repo.full_name}
                      onClick={() => handleSelectRepo(repo.full_name)}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedRepo === repo.full_name
                          ? "border-indigo-500/40 bg-indigo-500/5"
                          : "border-border-subtle bg-bg-card hover:border-border-glow"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedRepo === repo.full_name ? (
                            <div className="w-5 h-5 rounded-full bg-indigo-500 dark:bg-[#b8ff57] flex items-center justify-center flex-shrink-0">
                              <Check size={11} className="text-white dark:text-black" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-border-subtle flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-text-main truncate">{repo.full_name}</div>
                            <div className="text-xs text-text-muted font-mono mt-0.5 truncate">
                              {repo.language || "Unknown language"} · {repo.is_private ? "Private" : "Public"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  {reposList.length === 0 && (
                    <p className="text-center text-xs text-text-muted py-6">No repositories found. Connect an account first.</p>
                  )}
                </div>
              )}

              {/* Branch select and Generator select */}
              {selectedRepo && (
                <div className="space-y-5 animate-fade-in">
                  <div className="space-y-3">
                    <label htmlFor="branch-select" className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted block">
                      Target Branch to Scan
                    </label>
                    {loadingBranches ? (
                      <div className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 flex items-center gap-2.5 justify-center">
                        <Loader2 className="animate-spin text-indigo-400" size={16} />
                        <span className="text-xs text-text-sub font-mono">Fetching branches...</span>
                      </div>
                    ) : (
                      <select
                        id="branch-select"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full bg-bg-deep border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-colors cursor-pointer"
                        required
                      >
                        {branches.map((b) => (
                          <option key={b} value={b} className="bg-bg-panel text-text-main">
                            {b}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted block">
                      Which AI tool generated this code?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GENERATORS.map((g) => (
                        <button
                          key={g}
                          onClick={() => setSelectedGenerator(g)}
                          className={`font-mono text-[10px] uppercase tracking-[1px] px-4 py-2 rounded-lg border transition-all cursor-pointer ${
                            selectedGenerator === g
                              ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400"
                              : "border-border-subtle text-text-muted hover:text-text-sub hover:border-border-glow"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleConfirmRepo}
                disabled={!selectedRepo}
                className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:text-black dark:hover:bg-[#d4ff8a] font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-600/90 dark:hover:bg-[#d4ff8a] cursor-pointer"
              >
                Connect {selectedRepo?.split("/")[1] || "Repository"} <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 3 — Scan */}
          {step === 3 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-text-muted mb-3">Step 3 of 4</div>
                <h1 className="text-2xl sm:text-4xl font-extrabold mb-4 text-text-main">Running your first security scan</h1>
                <p className="text-text-sub">
                  We're scanning your code with Semgrep and checking all dependencies against npm/PyPI registries.
                </p>
              </div>

              {/* Terminal */}
              <div className="bg-[#030308] border border-zinc-800 rounded-2xl overflow-hidden font-mono text-xs flex flex-col h-[280px] shadow-2xl">
                <div className="bg-black/40 px-5 py-3 border-b border-zinc-850 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-indigo-500" />
                    <span className="text-text-muted font-bold text-[10px] uppercase tracking-widest">DEBTMAP SCAN ENGINE v1.0</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/40" />
                    <div className={`w-2.5 h-2.5 rounded-full ${isScanning ? "bg-[#28c840] animate-pulse" : "bg-[#28c840]/30"}`} />
                  </div>
                </div>
                <div className="flex-1 p-5 overflow-y-auto space-y-1.5 text-slate-300 leading-relaxed">
                  {!scanStarted && (
                    <div className="text-text-muted">Awaiting scan trigger...</div>
                  )}
                  {scanLogs.map((log, idx) => {
                    let color = "text-slate-300";
                    if (log.includes("[SUCCESS]")) color = "text-emerald-500 dark:text-[#b8ff57] font-bold";
                    else if (log.includes("[WARN]")) color = "text-amber-500";
                    else if (log.includes("[SYSTEM]")) color = "text-indigo-500 dark:text-indigo-400";
                    else if (log.includes("[AI REVIEW]")) color = "text-indigo-500 dark:text-indigo-400 font-bold";
                    return <div key={idx} className={color}>{log}</div>;
                  })}
                  {isScanning && (
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <span>$ scanning</span>
                      <span className="w-1.5 h-4 bg-zinc-500 animate-pulse" />
                    </div>
                  )}
                </div>
                {scanStarted && (
                  <div className="bg-black/40 px-5 py-3 border-t border-zinc-850 flex items-center gap-4">
                    <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 dark:bg-[#b8ff57] h-full rounded-full transition-all duration-300"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <span className="text-white font-bold text-xs w-10 text-right">{scanProgress}%</span>
                  </div>
                )}
              </div>

              {!scanStarted ? (
                <button
                  onClick={handleStartScan}
                  className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:text-black dark:hover:bg-[#d4ff8a] font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl hover:bg-indigo-650 transition-all cursor-pointer"
                >
                  ▶ Start Security Scan
                </button>
              ) : scanStatus === "failed" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 py-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
                    <AlertTriangle size={18} /> Scan failed. Please check the terminal logs.
                  </div>
                  <button
                    onClick={handleStartScan}
                    className="w-full py-4 bg-bg-card border border-border-subtle hover:bg-border-glow text-text-main font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer"
                  >
                    🔄 Retry Scan
                  </button>
                </div>
              ) : scanDone ? (
                <div className="flex items-center justify-center gap-3 py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  <Check size={18} /> Scan complete — loading results...
                </div>
              ) : (
                <div className="text-center text-sm text-text-muted font-mono animate-pulse">
                  Scanning in progress... ({scanProgress}%)
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Results */}
          {step === 4 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-text-muted mb-3">Step 4 of 4</div>
                <h1 className="text-2xl sm:text-4xl font-extrabold mb-4 text-text-main">
                  Your scan is <span className="text-indigo-600 dark:text-[#b8ff57]">complete.</span>
                </h1>
                <p className="text-text-sub">We found issues in your repository. Here's a summary:</p>
              </div>

              {/* Quick summary */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                  { val: healthScore, label: "Health Score", color: healthScore < 50 ? "text-rose-500" : healthScore < 85 ? "text-amber-500" : "text-emerald-500 dark:text-[#b8ff57]" },
                  { val: openIssuesCount, label: "Open Issues", color: openIssuesCount > 0 ? "text-amber-500" : "text-emerald-500 dark:text-[#b8ff57]" },
                  { val: criticalCount, label: "Critical — Fix Now", color: criticalCount > 0 ? "text-rose-500" : "text-text-muted" },
                ].map((s) => (
                  <div key={s.label} className="bg-bg-deep border border-border-subtle rounded-xl p-2 sm:p-4 text-center">
                    <div className={`text-xl sm:text-3xl font-extrabold ${s.color} mb-1`}>{s.val}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[1px] text-text-muted">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Sample issues */}
              <div className="space-y-3">
                <div className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted">Issues found</div>
                {repoIssues.slice(0, 3).map((issue) => (
                  <div key={issue.id} className="bg-bg-deep border border-border-subtle rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${issue.severity === "critical" ? "bg-rose-500 shadow-[0_0_6px_#ef4444]" : "bg-amber-500"}`} />
                      <div className="min-w-0 font-sans">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-bold text-text-main truncate">{issue.plain_english_title}</div>
                          {issue.source === "ai_review" && (
                            <span className="font-mono text-[8px] font-bold uppercase tracking-[1px] px-1.5 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/10 text-indigo-450 dark:text-indigo-400">
                              AI Review
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-text-muted truncate">{issue.file_path}:{issue.line_start}</div>
                      </div>
                    </div>
                    <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      issue.severity === "critical" ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    }`}>{issue.severity}</span>
                  </div>
                ))}
                {repoIssues.length === 0 && (
                  <p className="text-xs text-text-muted py-4 text-center font-mono">No security issues detected. Your app is clean!</p>
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleGoToDashboard}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:text-black dark:hover:bg-[#d4ff8a] font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer"
                >
                  Go to Dashboard — Fix Issues <ArrowRight size={16} />
                </button>
                <p className="text-center text-xs text-text-muted font-mono">
                  Every issue has a one-click fix. You don't need to understand the code.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <GitHubPermissionsModal 
        isOpen={permissionsModalOpen} 
        onClose={() => setPermissionsModalOpen(false)} 
        onConfirm={handleConnectGitHub} 
      />
    </div>
  );
}
