"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { Lock, Globe, GitBranch, ChevronRight, Check, Terminal, Shield, AlertTriangle, Zap, ArrowRight } from "lucide-react";


const STEPS = [
  { id: 1, label: "Connect GitHub" },
  { id: 2, label: "Select Repo" },
  { id: 3, label: "Run First Scan" },
  { id: 4, label: "View Results" },
];

const DEMO_REPOS = [
  { full_name: "mathivanan/saas-app", language: "TypeScript", private: true, generator: "Lovable", stars: 0, issues: "2 critical, 5 high" },
  { full_name: "mathivanan/api-backend", language: "Python", private: true, generator: "Cursor", stars: 3, issues: "1 high, 4 medium" },
  { full_name: "mathivanan/landing-page", language: "JavaScript", private: false, generator: "Bolt", stars: 12, issues: "Clean" },
];

const GENERATORS = ["Lovable", "Bolt", "Cursor", "Replit", "v0", "Other"];

export default function OnboardingPage() {
  const router = useRouter();
  const { connectRepo, triggerScan, scanLogs, scanProgress, isScanning } = useApp();

  const [step, setStep] = useState(1);
  const [githubConnected, setGithubConnected] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [selectedGenerator, setSelectedGenerator] = useState<string>("Lovable");
  const [scanStarted, setScanStarted] = useState(false);
  const [scanDone, setScanDone] = useState(false);

  const handleConnectGitHub = () => {
    setGithubConnected(true);
    setTimeout(() => setStep(2), 600);
  };

  const handleSelectRepo = (repoName: string) => {
    setSelectedRepo(repoName);
  };

  const handleConfirmRepo = () => {
    if (!selectedRepo) return;
    const repo = DEMO_REPOS.find((r) => r.full_name === selectedRepo)!;
    connectRepo(repo.full_name, repo.language, selectedGenerator, repo.private);
    setStep(3);
  };

  const handleStartScan = async () => {
    setScanStarted(true);
    await triggerScan();
    setScanDone(true);
    setTimeout(() => setStep(4), 800);
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div
      style={{ background: "radial-gradient(circle at 50% -10%, #15102a 0%, #06060c 65%)" }}
      className="min-h-screen text-[#eeeeff] flex flex-col"
    >
      {/* Top bar */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#b8ff57] flex items-center justify-center font-bold text-black text-sm">D</div>
          <span className="font-bold text-base text-white">DebtMap</span>
        </Link>
        <Link href="/dashboard" className="font-mono text-[10px] text-[#44446a] hover:text-[#8888bb] uppercase tracking-widest transition-colors">
          Skip → View Demo
        </Link>
      </div>

      {/* Step Progress Bar */}
      <div className="border-b border-white/5 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step > s.id
                        ? "bg-[#b8ff57] text-black"
                        : step === s.id
                        ? "bg-indigo-500 text-white"
                        : "bg-white/5 text-[#44446a]"
                    }`}
                  >
                    {step > s.id ? <Check size={14} /> : s.id}
                  </div>
                  <span className={`font-mono text-[9px] uppercase tracking-[1px] whitespace-nowrap ${step >= s.id ? "text-[#8888bb]" : "text-[#44446a]"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 mb-5 transition-all ${step > s.id ? "bg-[#b8ff57]/40" : "bg-white/5"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">

          {/* STEP 1 — Connect GitHub */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in text-center">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-[#44446a] mb-3">Step 1 of 4</div>
                <h1 className="text-4xl font-extrabold mb-4">Connect your GitHub account</h1>
                <p className="text-[#8888bb] text-lg max-w-md mx-auto">
                  We need read access to your repositories to scan for security vulnerabilities.
                </p>
              </div>

              {!githubConnected ? (
                <div className="space-y-4">
                  <button
                    onClick={handleConnectGitHub}
                    className="w-full max-w-sm mx-auto flex items-center justify-center gap-3 py-4 bg-white text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-all shadow-lg cursor-pointer"
                  >
                    <GitBranch size={20} /> Authorize DebtMap on GitHub
                  </button>
                  <p className="text-[11px] text-[#44446a] font-mono">
                    We only request <strong className="text-[#8888bb]">read access</strong> to your code. We never write or store your source code.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3 py-4 bg-[#b8ff57]/10 border border-[#b8ff57]/20 rounded-xl text-[#b8ff57] font-bold">
                  <Check size={18} /> GitHub Connected Successfully
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { icon: Shield, label: "Read-only access" },
                  { icon: Lock, label: "No code stored" },
                  { icon: Zap, label: "Scan in 60 seconds" },
                ].map((f) => (
                  <div key={f.label} className="bg-white/3 border border-white/5 rounded-xl p-4 space-y-2">
                    <f.icon size={20} className="text-[#b8ff57] mx-auto" />
                    <div className="text-xs text-[#8888bb]">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Select Repo */}
          {step === 2 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-[#44446a] mb-3">Step 2 of 4</div>
                <h1 className="text-4xl font-extrabold mb-4">Select a repository to scan</h1>
                <p className="text-[#8888bb]">Choose the app you want to audit. You can add more repositories later.</p>
              </div>

              <div className="space-y-3">
                {DEMO_REPOS.map((repo) => (
                  <button
                    key={repo.full_name}
                    onClick={() => handleSelectRepo(repo.full_name)}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedRepo === repo.full_name
                        ? "border-[#b8ff57]/40 bg-[#b8ff57]/5"
                        : "border-white/8 bg-white/3 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectedRepo === repo.full_name ? (
                          <div className="w-5 h-5 rounded-full bg-[#b8ff57] flex items-center justify-center flex-shrink-0">
                            <Check size={11} className="text-black" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-white/15 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-sm text-white">{repo.full_name}</div>
                          <div className="text-xs text-[#44446a] font-mono mt-0.5">{repo.language} · {repo.generator} · {repo.private ? "Private" : "Public"}</div>
                        </div>
                      </div>
                      <div className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        repo.issues === "Clean"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {repo.issues}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Generator select */}
              {selectedRepo && (
                <div className="space-y-3 animate-fade-in">
                  <label className="font-mono text-[10px] uppercase tracking-[2px] text-[#44446a] block">
                    Which AI tool generated this code?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GENERATORS.map((g) => (
                      <button
                        key={g}
                        onClick={() => setSelectedGenerator(g)}
                        className={`font-mono text-[10px] uppercase tracking-[1px] px-4 py-2 rounded-lg border transition-all cursor-pointer ${
                          selectedGenerator === g
                            ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
                            : "border-white/8 text-[#44446a] hover:text-[#8888bb] hover:border-white/15"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleConfirmRepo}
                disabled={!selectedRepo}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[#b8ff57] text-black font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#d4ff8a] cursor-pointer"
              >
                Connect {selectedRepo?.split("/")[1] || "Repository"} <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 3 — Scan */}
          {step === 3 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-[#44446a] mb-3">Step 3 of 4</div>
                <h1 className="text-4xl font-extrabold mb-4">Running your first security scan</h1>
                <p className="text-[#8888bb]">
                  We're scanning your code with Semgrep and checking all dependencies against npm/PyPI registries.
                </p>
              </div>

              {/* Terminal */}
              <div className="bg-black border border-white/10 rounded-2xl overflow-hidden font-mono text-xs flex flex-col h-[280px] shadow-2xl">
                <div className="bg-[#0d0d1a] px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-[#b8ff57]" />
                    <span className="text-[#8888bb] font-bold text-[10px] uppercase tracking-widest">DEBTMAP SCAN ENGINE v1.0</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/40" />
                    <div className={`w-2.5 h-2.5 rounded-full ${isScanning ? "bg-[#28c840] animate-pulse" : "bg-[#28c840]/30"}`} />
                  </div>
                </div>
                <div className="flex-1 p-5 overflow-y-auto space-y-1.5 text-slate-400 leading-relaxed">
                  {!scanStarted && (
                    <div className="text-[#44446a]">Awaiting scan trigger...</div>
                  )}
                  {scanLogs.map((log, idx) => {
                    let color = "text-slate-400";
                    if (log.includes("[SUCCESS]")) color = "text-[#b8ff57] font-bold";
                    else if (log.includes("[WARN]")) color = "text-[#ffaa33]";
                    else if (log.includes("[SYSTEM]")) color = "text-indigo-400";
                    return <div key={idx} className={color}>{log}</div>;
                  })}
                  {isScanning && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span>$ scanning</span>
                      <span className="w-1.5 h-4 bg-slate-400 animate-pulse" />
                    </div>
                  )}
                </div>
                {scanStarted && (
                  <div className="bg-[#0d0d1a] px-5 py-3 border-t border-white/5 flex items-center gap-4">
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#b8ff57] h-full rounded-full transition-all duration-300"
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
                  className="w-full py-4 bg-[#b8ff57] text-black font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl hover:bg-[#d4ff8a] transition-all cursor-pointer"
                >
                  ▶ Start Security Scan
                </button>
              ) : scanDone ? (
                <div className="flex items-center justify-center gap-3 py-4 bg-[#b8ff57]/10 border border-[#b8ff57]/20 rounded-xl text-[#b8ff57] font-bold">
                  <Check size={18} /> Scan complete — loading results...
                </div>
              ) : (
                <div className="text-center text-sm text-[#44446a] font-mono animate-pulse">
                  Scanning in progress...
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Results */}
          {step === 4 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-[#44446a] mb-3">Step 4 of 4</div>
                <h1 className="text-4xl font-extrabold mb-4">
                  Your scan is <span className="text-[#b8ff57]">complete.</span>
                </h1>
                <p className="text-[#8888bb]">We found issues in your repository. Here's a summary:</p>
              </div>

              {/* Quick summary */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { val: "34", label: "Health Score", color: "text-[#ff5757]" },
                  { val: "7", label: "Open Issues", color: "text-[#ffaa33]" },
                  { val: "2", label: "Critical — Fix Now", color: "text-[#ff5757]" },
                ].map((s) => (
                  <div key={s.label} className="bg-[#0d0d1a] border border-white/8 rounded-xl p-4 text-center">
                    <div className={`text-3xl font-extrabold ${s.color} mb-1`}>{s.val}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[1px] text-[#44446a]">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Sample issues */}
              <div className="space-y-3">
                <div className="font-mono text-[10px] uppercase tracking-[2px] text-[#44446a]">Issues found</div>
                {[
                  { sev: "critical", title: "Anyone can read any user's data", file: "src/api/users.js:47" },
                  { sev: "critical", title: "Your Stripe secret key is visible to everyone", file: "src/payment.js:12" },
                  { sev: "high", title: "Search box can be used to steal your database", file: "src/api/search.js:23" },
                ].map((issue) => (
                  <div key={issue.title} className="bg-[#0d0d1a] border border-white/8 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${issue.sev === "critical" ? "bg-[#ff5757] shadow-[0_0_6px_#ff5757]" : "bg-[#ffaa33]"}`} />
                      <div>
                        <div className="text-sm font-bold text-white">{issue.title}</div>
                        <div className="font-mono text-[10px] text-[#44446a]">{issue.file}</div>
                      </div>
                    </div>
                    <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      issue.sev === "critical" ? "bg-[#ff5757]/10 text-[#ff5757] border border-[#ff5757]/20" : "bg-[#ffaa33]/10 text-[#ffaa33] border border-[#ffaa33]/20"
                    }`}>{issue.sev}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleGoToDashboard}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-[#b8ff57] text-black font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl hover:bg-[#d4ff8a] transition-all cursor-pointer"
                >
                  Go to Dashboard — Fix Issues <ArrowRight size={16} />
                </button>
                <p className="text-center text-xs text-[#44446a] font-mono">
                  Every issue has a one-click fix. You don't need to understand the code.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
