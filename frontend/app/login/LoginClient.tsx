"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useToast } from "@/lib/contexts/ToastContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { GitBranch, Eye, EyeOff, Shield, Sun, Moon, ArrowRight, Check } from "lucide-react";
import ThreeDGrid from "@/components/ui/ThreeDGrid";
import TiltCard from "@/components/ui/TiltCard";

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const handleGithubLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/auth/github`);
      if (!response.ok) throw new Error("Failed to retrieve GitHub connection link.");
      const data = await response.json();
      if (data?.auth_url) {
        sessionStorage.setItem("auth_redirect", "/dashboard");
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      showToast(err.message || "Failed to initiate GitHub login.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email || !password) { setErrorMsg("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Authentication failed");
      }
      const data = await res.json();
      login({ id: data.user_id, name: data.name, email: data.email, avatar_url: null, plan: data.plan, session_token: data.session_token, has_github_token: false, is_admin: data.is_admin });
      router.push(data.is_admin ? "/admin" : "/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative h-dvh overflow-hidden flex flex-col"
      style={{
        background: isDark
          ? "radial-gradient(ellipse at 60% 0%, #1a1040 0%, #06060c 60%)"
          : "radial-gradient(ellipse at 60% 0%, #c7d2fe 0%, #e2e8f0 40%, #f1f5f9 100%)",
      }}
    >
      {/* 3D Grid background — fills full screen */}
      <div className="absolute inset-0 pointer-events-none">
        <ThreeDGrid
          className="w-full h-full pointer-events-auto"
          lineColor={isDark ? "rgba(99,102,241,0.09)" : "rgba(99,102,241,0.06)"}
          dotColor={isDark ? "rgba(99,102,241,0.7)" : "rgba(99,102,241,0.5)"}
          cols={22}
          rows={14}
          warpRadius={210}
          warpStrength={0.4}
        />
      </div>

      {/* Ambient glow orbs */}
      <div aria-hidden="true" className="absolute pointer-events-none" style={{ top: "-15%", left: "-10%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)", filter: "blur(60px)" }} />
      <div aria-hidden="true" className="absolute pointer-events-none" style={{ bottom: "-20%", right: "-10%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", filter: "blur(50px)" }} />

      {/* Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-4 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group" aria-label="Risk Guard AI home">
          <span className="font-bold text-base tracking-wide text-text-main">Risk Guard AI</span>
          <span className="font-mono text-[9px] px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-full uppercase tracking-widest">Beta</span>
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={() => setTheme(isDark ? "light" : "dark")} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-border-subtle hover:bg-border-subtle text-text-sub hover:text-text-main transition-all cursor-pointer" aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link href="/signup" className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5">
            Sign Up <ArrowRight size={11} />
          </Link>
        </div>
      </nav>

      {/* Two-column layout — left info, right form */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-2 min-h-0">
        <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center gap-8 lg:gap-14">

          {/* Left — value props (hidden on small, shown on lg) */}
          <div className="hidden lg:flex flex-col flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1.5 w-fit">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[2px] text-indigo-600 dark:text-indigo-400 font-bold">Secure & Compliant</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-text-main">
              Welcome back to<span className="block text-indigo-600 dark:text-indigo-400 mt-1">Risk Guard AI.</span>
            </h1>
            <p className="text-sm text-text-sub leading-relaxed max-w-xs">
              Your security posture dashboard is ready. Monitor scan history, check your repository health score, and export compliance maps.
            </p>
            <ul className="space-y-2.5">
              {[
                "Real-time vulnerability mapping",
                "Groq-powered AI issue explanation",
                "Automatic PR resolution guides",
                "SOC 2 Type II readiness checks",
              ].map((perk) => (
                <li key={perk} className="flex items-center gap-3 text-sm text-text-sub">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <Check size={11} className="text-indigo-500" />
                  </div>
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — form card */}
          <div className="w-full max-w-md flex-shrink-0">
            <TiltCard className="glass-card rounded-3xl shadow-2xl" maxTilt={8} perspective={1000} scale={1.01} shineColor="rgba(99,102,241,0.07)">
              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mx-auto">
                    <Shield size={20} className="text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-text-main tracking-tight">Welcome back</h2>
                    <p className="text-[11px] text-text-muted mt-0.5">Sign in to your Risk Guard AI dashboard</p>
                  </div>
                </div>

                {/* GitHub */}
                <button onClick={handleGithubLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 py-2.5 bg-bg-deep border border-border-subtle hover:border-border-glow rounded-2xl text-sm font-semibold text-text-main transition-all cursor-pointer group disabled:opacity-50" aria-label="Continue with GitHub">
                  <GitBranch size={17} className="text-text-sub group-hover:text-indigo-500 transition-colors" />
                  Continue with GitHub
                </button>

                {/* Divider */}
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-border-subtle" />
                  <span className="mx-3 font-mono text-[9px] text-text-muted uppercase tracking-widest flex-shrink">or email</span>
                  <div className="flex-grow border-t border-border-subtle" />
                </div>

                {/* Error */}
                {errorMsg && (
                  <div id="login-error" role="alert" aria-live="polite" className="bg-rose-500/5 border border-rose-500/15 rounded-xl p-3 text-center text-xs text-rose-500 font-medium">
                    {errorMsg}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleEmailSignIn} className="space-y-2.5" aria-label="Sign in form" noValidate>
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-semibold text-text-sub mb-1">Email Address</label>
                    <input id="login-email" type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errorMsg} aria-describedby={errorMsg ? "login-error" : undefined} className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-2 text-sm text-text-main placeholder-text-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 transition-all" />
                  </div>
                  <div>
                    <label htmlFor="login-password" className="block text-xs font-semibold text-text-sub mb-1">Password</label>
                    <div className="relative">
                      <input id="login-password" type={showPass ? "text" : "password"} autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errorMsg} aria-describedby={errorMsg ? "login-error" : undefined} className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-2 text-sm text-text-main placeholder-text-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 transition-all pr-12" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-text-sub cursor-pointer" aria-label={showPass ? "Hide password" : "Show password"}>
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} aria-busy={loading} className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
                    {loading ? (
                      <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Signing in…</span>
                    ) : "Sign In →"}
                  </button>
                </form>

                {/* Footer */}
                <p className="text-center text-[11px] text-text-muted">
                  Don&apos;t have an account?{" "}
                  <Link href="/signup" className="text-indigo-500 hover:text-indigo-400 font-semibold transition-colors">Create one free</Link>
                </p>
              </div>
            </TiltCard>
          </div>
        </div>
      </main>

      {/* Trust badges pinned at bottom */}
      <div className="relative z-10 flex-shrink-0 flex items-center justify-center gap-5 py-3 text-[10px] text-text-muted font-mono uppercase tracking-wider">
        <span>AES-256 Encrypted</span>
        <span aria-hidden="true" className="w-1 h-1 rounded-full bg-border-glow" />
        <span>SOC 2 Mapped</span>
        <span aria-hidden="true" className="w-1 h-1 rounded-full bg-border-glow" />
        <span>Ephemeral Scans</span>
      </div>
    </div>
  );
}
