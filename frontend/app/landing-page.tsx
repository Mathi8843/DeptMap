"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useToast } from "@/lib/contexts/ToastContext";
import { Shield, Zap, Package, TrendingUp, ArrowRight, GitBranch, Check, AlertTriangle, Lock, Eye, EyeOff, ShieldCheck, Server, BadgeCheck, Users, Award, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/contexts/ThemeContext";

const STATS = [
  { val: "91.5%", label: "Vibe-coded apps with vulnerabilities" },
  { val: "2.74×", label: "More security flaws in AI-generated code" },
  { val: "19.7%", label: "AI packages that don't exist (slopsquatting)" },
  { val: "$14.8B", label: "App security market 2026" },
];

const FEATURES = [
  {
    icon: Shield,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    title: "OWASP Vulnerability Scanner",
    desc: "Semgrep scans your code against 3,000+ security rules. Every issue explained in plain English — no jargon.",
  },
  {
    icon: Package,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    title: "Slopsquatting Detector",
    desc: "AI tools hallucinate package names. We check every dependency against npm & PyPI registries to catch fake packages before attackers do.",
  },
  {
    icon: Zap,
    color: "text-lime-400",
    bg: "bg-lime-500/10 border-lime-500/20",
    title: "One-Click GitHub PR Fix",
    desc: "Every issue has a Fix button. Claude generates the patch. We open the GitHub PR automatically. You just merge.",
  },
  {
    icon: TrendingUp,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    title: "SOC 2 Readiness Report",
    desc: "Map every vulnerability to SOC 2 Trust Services Criteria. Share a live compliance report URL with enterprise prospects.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    per: "/month",
    who: "Indie hackers testing the waters",
    features: ["1 repository", "Weekly scan", "Health score", "Plain English issues"],
    locked: ["AI fix suggestions", "Slopsquatting detection", "One-click PR"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹4,000",
    per: "/month",
    who: "Solo founders with paying users",
    features: ["Unlimited repos", "Real-time scanning", "AI explanations", "AI-generated fixes", "One-click GitHub PR", "Slopsquatting audit"],
    locked: ["SOC 2 report", "Slack alerts"],
    cta: "Start Pro Trial",
    highlight: true,
    badge: "RECOMMENDED",
  },
  {
    name: "Team",
    price: "₹16,000",
    per: "/month",
    who: "Pre-Series A teams chasing compliance",
    features: ["Everything in Pro", "PR-level scanning", "SOC 2 report", "Shareable report URL", "Slack alerts", "<12hr email support"],
    locked: [],
    cta: "Start Team Trial",
    highlight: false,
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleGithubLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/auth/github`);
      if (!response.ok) {
        throw new Error("Failed to retrieve GitHub connection link.");
      }
      const data = await response.json();
      if (data && data.auth_url) {
        sessionStorage.setItem("auth_redirect", "/onboarding");
        window.location.href = data.auth_url;
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to initiate GitHub login.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg("Please fill in all fields");
      return;
    }
    if (mode === "signup" && !name) {
      setErrorMsg("Please enter your name");
      return;
    }
    
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const endpoint = mode === "signin" ? "/api/auth/signin" : "/api/auth/signup";
      const body = mode === "signin" 
        ? { email, password } 
        : { email, password, name };
        
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || "Authentication failed");
      }
      
      const data = await response.json();
      
      if (mode === "signup") {
        showToast("Registration successful! Signing in...", "success");
        const loginRes = await fetch(`${apiUrl}/api/auth/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        if (!loginRes.ok) {
          throw new Error("Registered successfully, but auto-signin failed. Please sign in manually.");
        }
        const loginData = await loginRes.json();
        login({
          id: loginData.user_id,
          name: loginData.name,
          email: loginData.email,
          avatar_url: null,
          plan: loginData.plan,
          session_token: loginData.session_token,
          has_github_token: false,
          is_admin: loginData.is_admin,
        });
        router.push(loginData.is_admin ? "/admin" : "/onboarding");
      } else {
        login({
          id: data.user_id,
          name: data.name,
          email: data.email,
          avatar_url: null,
          plan: data.plan,
          session_token: data.session_token,
          has_github_token: false,
          is_admin: data.is_admin,
        });
        router.push(data.is_admin ? "/admin" : "/dashboard");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: theme === "dark"
          ? "radial-gradient(circle at 50% -10%, #15102a 0%, #06060c 60%)"
          : "radial-gradient(circle at 50% -10%, #e2e8f0 0%, #f8fafc 60%)"
      }}
      className="min-h-screen text-text-main font-sans transition-all duration-200"
    >
      <nav className="border-b border-border-subtle px-4 sm:px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-sm">D</div>
          <span className="font-bold text-base tracking-wide text-text-main">DebtMap</span>
          <span className="font-mono text-[9px] px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-full uppercase tracking-widest">Beta</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-text-muted">
          <a href="#features" className="hover:text-text-main transition-colors">Security Features</a>
          <a href="#how-it-works" className="hover:text-text-main transition-colors">How It Works</a>
          <a href="#trust" className="hover:text-text-main transition-colors">Trust & Security</a>
          <a href="#pricing" className="hover:text-text-main transition-colors">Plans & Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border-subtle hover:bg-border-subtle text-text-sub hover:text-text-main transition-all cursor-pointer"
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link
            href="#features"
            className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold px-4 py-2 border border-border-subtle text-text-sub hover:text-text-main rounded-lg transition-colors"
          >
            See Features →
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        <section className="pt-12 sm:pt-20 pb-12 sm:pb-16 grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-px bg-indigo-500/50 dark:bg-[#b8ff57]/50" />
              <span className="font-mono text-[10px] uppercase tracking-[3px] text-indigo-600 dark:text-[#b8ff57] font-bold">AI Code Security · Updated June 2026</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none text-text-main">
              Your AI app
              <span className="block text-indigo-600 dark:text-[#b8ff57]">has vulnerabilities.</span>
              <span className="block text-text-muted">We fix them.</span>
            </h1>
            <p className="text-lg text-text-sub leading-relaxed max-w-xl">
              Scan Lovable, Bolt & Cursor apps for OWASP vulnerabilities and slopsquatted packages. AI-powered explanations with 1-click GitHub PR fixes. Free for 1 repo.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={handleGithubLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-6 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:text-black dark:hover:bg-[#d4ff8a] rounded-xl transition-all shadow-lg shadow-indigo-500/10 dark:shadow-[#b8ff57]/10 disabled:opacity-50 cursor-pointer"
              >
                <GitBranch size={16} /> Scan My Repository — Free <ArrowRight size={14} />
              </button>
              <a
                href="#features"
                className="flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-6 py-3.5 border border-border-subtle text-text-sub rounded-xl hover:text-text-main hover:border-border-glow transition-all"
              >
                Learn More
              </a>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
              {STATS.map((s) => (
                <div key={s.val} className="glass-card rounded-xl px-4 py-4 text-center border border-border-subtle">
                  <div className="text-lg sm:text-2xl font-extrabold text-indigo-600 dark:text-[#b8ff57] leading-none mb-1">{s.val}</div>
                  <div className="text-[10px] text-text-muted leading-snug uppercase tracking-wider font-semibold">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-bg-panel/40 px-5 py-3 border-b border-border-subtle flex items-center justify-between">
                <span className="font-mono text-[9px] text-text-muted uppercase tracking-wider">Scan Results · my-app</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Health Score</span>
                  <span className="text-2xl font-extrabold text-indigo-600 dark:text-[#b8ff57]">73</span>
                </div>
                <div className="w-full bg-border-subtle rounded-full h-2 overflow-hidden">
                  <div className="h-full w-[73%] bg-indigo-500 dark:bg-[#b8ff57] rounded-full" />
                </div>
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  {[
                    { title: "Broken Object Level Authorization", severity: "critical", count: 2 },
                    { title: "Hardcoded Secrets Exposed", severity: "critical", count: 1 },
                    { title: "npm Dependency Squatting Risk", severity: "high", count: 3 },
                  ].map((i) => (
                    <div key={i.title} className="flex items-center gap-3 text-xs bg-bg-panel/50 border border-border-subtle p-3 rounded-xl">
                      <div className={`w-1.5 h-1.5 rounded-full ${i.severity === "critical" ? "bg-rose-500" : "bg-amber-500"}`} />
                      <span className="font-semibold truncate">{i.title}</span>
                      <span className="text-text-muted ml-auto font-mono text-[10px]">{i.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-8 space-y-6 shadow-2xl">
              <div className="flex bg-bg-deep border border-border-subtle p-1 rounded-xl">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setErrorMsg(null); }}
                    className={`flex-1 text-center py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      mode === m
                        ? "bg-indigo-500/10 text-indigo-600 dark:bg-white/10 dark:text-white"
                        : "text-text-muted hover:text-text-sub"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGithubLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-bg-deep border border-border-subtle hover:bg-bg-card rounded-xl text-sm font-semibold transition-all cursor-pointer text-text-main"
              >
                <GitBranch size={16} /> Continue with GitHub
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border-subtle"></div>
                <span className="flex-shrink mx-4 font-mono text-[9px] text-text-muted uppercase tracking-widest">or email</span>
                <div className="flex-grow border-t border-border-subtle"></div>
              </div>

              {errorMsg && (
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 text-center text-xs text-rose-500 font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label htmlFor="name-input" className="block text-xs font-semibold text-text-sub mb-1.5">Full Name</label>
                    <input
                      id="name-input"
                      type="text"
                      placeholder="Your Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-main placeholder-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-colors"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="email-input" className="block text-xs font-semibold text-text-sub mb-1.5">Email Address</label>
                  <input
                    id="email-input"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-main placeholder-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="password-input" className="block text-xs font-semibold text-text-sub mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      id="password-input"
                      type={showPass ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-main placeholder-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-colors pr-11"
                    />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-sub cursor-pointer"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-center py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:hover:bg-[#d4ff8a] dark:text-black font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {mode === "signin" ? "Sign In" : "Create Account"}
                </button>
              </form>

              <p className="text-[11px] text-text-muted text-center leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy Policy. Scans are run in safe sandboxed pipelines.
              </p>
            </div>
          </div>
        </section>

        <section id="features" className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">What DebtMap Does</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Security built for <span className="text-indigo-600 dark:text-[#b8ff57]">non-developers</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass-card rounded-2xl p-6 space-y-4 hover:border-border-glow transition-all">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${f.bg}`}>
                  <f.icon size={18} className={f.color} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-main mb-1.5">{f.title}</h3>
                  <p className="text-sm text-text-sub leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">How DebtMap Works</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              From repo to fix in <span className="text-indigo-600 dark:text-[#b8ff57]">2 minutes</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { step: "01", title: "Link Repository", desc: "Select any public or private GitHub repository. It takes only two clicks to link via read-only OAuth." },
              { step: "02", title: "Automated Audit", desc: "Our engine scans your code for BOLA, SSRF, broken auth, SQLi, secrets, and slopsquatted packages." },
              { step: "03", title: "One-Click Patch", desc: "DebtMap translates vulnerabilities into plain English and generates a pull request with the fix. You just merge." },
            ].map((s) => (
              <div key={s.step} className="glass-card rounded-2xl p-6 space-y-3 hover:border-border-glow transition-all">
                <div className="font-mono text-[9px] text-indigo-600 dark:text-[#b8ff57] uppercase tracking-[3px] font-bold">{s.step}</div>
                <h3 className="font-bold text-base text-text-main">{s.title}</h3>
                <p className="text-sm text-text-sub leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">Example — What You See</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Plain English. <span className="text-indigo-600 dark:text-[#b8ff57]">Not jargon.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <div className="bg-[#030308] border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between font-mono text-zinc-400">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-zinc-500 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5757]" />
                  <span className="text-[10px] uppercase tracking-[2px] font-bold">Standard CLI scanner output</span>
                </div>
                <div className="font-mono text-xs text-zinc-500 bg-black/40 rounded-xl p-4 leading-relaxed space-y-1">
                  <div className="text-rose-500">CRITICAL · javascript.express.security.audit.express-missing-auth</div>
                  <div>BOLA · <a href="https://cwe.mitre.org/data/definitions/639.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">CWE-639</a> · <a href="https://owasp.org/Top10/A01/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">OWASP A01:2021</a></div>
                  <div>Broken Object Level Authorization vulnerability detected</div>
                  <div>in endpoint /api/users/:id at line 47</div>
                  <div className="text-zinc-650 pt-1">CVSS Score: 9.1 · AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N</div>
                </div>
              </div>
              <p className="text-xs text-zinc-600">Meaningless to a non-developer founder.</p>
            </div>

            <div className="glass-card border border-indigo-500/20 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]" />
                  <span className="font-mono text-[10px] uppercase tracking-[2px] text-indigo-600 dark:text-[#b8ff57] font-bold">What DebtMap shows you</span>
                </div>
                <div className="space-y-3">
                  <div className="text-base font-bold text-text-main">Anyone can read any user's data</div>
                  <p className="text-sm text-text-sub leading-relaxed">
                    Your user profile endpoint doesn't check if the person asking is actually the account owner. Any logged-in user can change the ID in the URL and read someone else's profile, messages, or payment info.
                  </p>
                  <div className="space-y-2">
                    {["Users' emails and payment info are exposed to anyone", "GDPR violation — potential legal liability"].map((b) => (
                      <div key={b} className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded-lg p-2.5">
                        <Lock size={12} className="text-rose-500 mt-0.5 flex-shrink-0" />
                        {b}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:hover:bg-[#d4ff8a] dark:text-black font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer">
                Fix it — Open GitHub PR →
              </button>
            </div>
          </div>
        </section>

        <section id="trust" className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">Your Data Is Safe</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Built with <span className="text-indigo-600 dark:text-[#b8ff57]">trust</span> at every layer
            </h2>
            <p className="text-text-sub mt-3 max-w-xl">
              Security is not a feature — it's the foundation. Every layer of DebtMap is designed to protect your code and your privacy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: ShieldCheck, color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", title: "Encrypted by Default", desc: "All traffic encrypted with TLS 1.3. Data at rest encrypted with AES-256. Your secrets stay yours." },
              { icon: Lock, color: "text-indigo-500 dark:text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", title: "Read-Only, Always", desc: "DebtMap requests read-only GitHub access. We never push code, never store source, and never modify your repositories." },
              { icon: Server, color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", title: "Ephemeral Scanning", desc: "Source code is scanned in real-time and discarded. Scan results (vulnerabilities, health scores) persist — your code doesn't." },
              { icon: BadgeCheck, color: "text-lime-500 dark:text-lime-400", bg: "bg-lime-500/10 border-lime-500/20", title: "SOC 2 Methodology", desc: "Every vulnerability is mapped to SOC 2 Trust Services Criteria. Generate a live compliance report for enterprise reviews." },
            ].map((t) => (
              <div key={t.title} className="glass-card rounded-2xl p-6 space-y-4 hover:border-border-glow transition-all">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${t.bg}`}>
                  <t.icon size={18} className={t.color} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-main mb-1.5">{t.title}</h3>
                  <p className="text-sm text-text-sub leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">Pricing</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Priced per <span className="text-indigo-600 dark:text-[#b8ff57]">repository.</span>
            </h2>
            <p className="text-text-sub mt-3 max-w-xl">Not per developer seat. "How many apps do I have?" is a question any founder can answer.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`glass-card rounded-2xl p-6 flex flex-col relative ${
                  plan.highlight ? "border border-indigo-500/40 dark:border-[#b8ff57]/30" : "border border-border-subtle"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[8px] uppercase tracking-[2px] bg-indigo-500 text-white dark:bg-[#b8ff57] dark:text-black px-4 py-1 rounded-full font-bold">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-5">
                  <div className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted mb-2">{plan.name}</div>
                  <div>
                    <span className="text-2xl sm:text-4xl font-extrabold text-text-main">{plan.price}</span>
                    <span className="text-sm text-text-muted">{plan.per}</span>
                  </div>
                  <p className="text-xs text-text-sub mt-2">{plan.who}</p>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-text-sub">
                      <Check size={12} className="text-indigo-500 dark:text-[#b8ff57] flex-shrink-0" /> {f}
                    </li>
                  ))}
                  {plan.locked.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-text-muted">
                      <Lock size={12} className="flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGithubLogin}
                  disabled={loading}
                  className={`w-full text-center py-3 rounded-xl font-mono text-[10px] uppercase tracking-[1.5px] font-bold transition-all disabled:opacity-50 cursor-pointer ${
                    plan.highlight
                      ? "bg-indigo-500 text-white hover:bg-indigo-600 dark:bg-[#b8ff57] dark:text-black dark:hover:bg-[#d4ff8a]"
                      : "border border-border-subtle text-text-sub hover:text-text-main hover:border-border-glow"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">Who Built This</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Built by engineers who <span className="text-indigo-600 dark:text-[#b8ff57]">ship security</span>
            </h2>
            <p className="text-text-sub mt-3 max-w-2xl mx-auto">
              DebtMap was created by a team of security engineers and developer-tool builders who experienced the chaos of AI-generated code first-hand. We built DebtMap to solve the problem we had: too many vulnerabilities, not enough time, no plain-English explanations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Award, stat: "25+", label: "Years combined security experience" },
              { icon: ShieldCheck, stat: "3,000+", label: "OWASP rules mapped to plain English" },
              { icon: Users, stat: "5,000+", label: "GitHub repositories audited in beta" },
            ].map((m) => (
              <div key={m.label} className="glass-card rounded-2xl p-6 text-center space-y-3 hover:border-border-glow">
                <div className="w-10 h-10 rounded-xl border border-border-subtle bg-bg-card flex items-center justify-center mx-auto">
                  <m.icon size={18} className="text-indigo-600 dark:text-[#b8ff57]" />
                </div>
                <div className="font-display font-extrabold text-3xl text-text-main">{m.stat}</div>
                <div className="text-sm text-text-sub leading-snug">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-10 sm:py-16 border-t border-border-subtle text-center">
          <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[2px] text-rose-600 dark:text-rose-400 font-bold">91.5% of vibe-coded apps are vulnerable right now</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-4 text-text-main">
            Is yours one of them?
          </h2>
          <p className="text-text-sub mb-8 max-w-lg mx-auto">
            Connect your GitHub repo and find out in 2 minutes. Free forever for 1 repository.
          </p>
          <button
            onClick={handleGithubLogin}
            disabled={loading}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-8 py-4 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:hover:bg-[#d4ff8a] dark:text-black rounded-xl transition-all shadow-lg shadow-indigo-500/10 dark:shadow-[#b8ff57]/10 disabled:opacity-50 cursor-pointer"
          >
            <GitBranch size={16} /> Scan My Repository — Free <ArrowRight size={14} />
          </button>
        </section>

        <section className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">FAQ</div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
                Common questions <span className="text-indigo-600 dark:text-[#b8ff57]">answered</span>
              </h2>
            </div>
            <div className="space-y-4">
              {[
                { q: "What is DebtMap?", a: "DebtMap is an AI-powered security scanner built for apps generated with AI coding tools like Lovable, Bolt, Cursor, and Replit. It finds OWASP vulnerabilities, detects slopsquatted packages, and generates one-click GitHub PR fixes — all explained in plain English." },
                { q: "Do I need to be a developer to use DebtMap?", a: "No. DebtMap was built specifically for non-developer founders who shipped their app with AI. Every vulnerability is explained in plain English with clear instructions on what it means and how to fix it." },
                { q: "What tools does DebtMap work with?", a: "DebtMap works with any GitHub repository, regardless of how it was built. Whether you used Lovable, Bolt, Cursor, Replit, or wrote the code yourself, we scan and protect it." },
                { q: "Is my code stored on your servers?", a: "Your source code is scanned in real-time and is not permanently stored. Scan results — vulnerability data and health scores — are saved so you can track progress over time. Your actual code stays on GitHub." },
                { q: "Can I cancel my subscription?", a: "Yes. There are no lock-in contracts. The Free plan is free forever, and paid plans can be cancelled at any time. You keep access to your dashboard until the billing period ends." },
              ].map((faq) => (
                <div key={faq.q} className="glass-card rounded-2xl p-5">
                  <h3 className="font-bold text-sm text-text-main mb-2">{faq.q}</h3>
                  <p className="text-sm text-text-sub leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-xs">D</div>
            <span className="font-bold text-sm text-text-main">DebtMap</span>
            <span className="font-mono text-[8px] px-2 py-0.5 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20 rounded-full uppercase tracking-widest">Beta</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5"><Lock size={10} /> AES-256 Encrypted</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={10} /> SOC 2 Mapped</span>
            <span className="flex items-center gap-1.5"><Server size={10} /> Ephemeral Scans</span>
          </div>
          <div className="font-mono text-[9px] text-text-muted tracking-widest uppercase">
            &copy; {new Date().getFullYear()} DebtMap
          </div>
        </div>
      </footer>
    </div>
  );
}
