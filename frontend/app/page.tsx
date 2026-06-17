"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { Shield, Zap, Package, TrendingUp, ArrowRight, GitBranch, Check, AlertTriangle, Lock, Eye, EyeOff } from "lucide-react";

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
  const { login, showToast } = useApp();

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
        // Auto-signin right after signup
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
          has_github_token: false
        });
        const isAdminSignup = loginData.email === "mathi@debtmap.io" || loginData.email === "admin@debtmap.io" || loginData.email?.endsWith("@debtmap.io");
        router.push(isAdminSignup ? "/admin" : "/onboarding");
      } else {
        login({
          id: data.user_id,
          name: data.name,
          email: data.email,
          avatar_url: null,
          plan: data.plan,
          session_token: data.session_token,
          has_github_token: false
        });
        const isAdminSignin = data.email === "mathi@debtmap.io" || data.email === "admin@debtmap.io" || data.email?.endsWith("@debtmap.io");
        router.push(isAdminSignin ? "/admin" : "/dashboard");
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
      style={{ background: "radial-gradient(circle at 50% -10%, #15102a 0%, #06060c 60%)" }}
      className="min-h-screen text-[#eeeeff] font-sans"
    >
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#b8ff57] flex items-center justify-center font-bold text-black text-sm">D</div>
          <span className="font-bold text-base tracking-wide text-white">DebtMap</span>
          <span className="font-mono text-[9px] px-2 py-0.5 bg-[#b8ff57]/10 text-[#b8ff57] border border-[#b8ff57]/20 rounded-full uppercase tracking-widest">Beta</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-[#8888bb]">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#crisis" className="hover:text-white transition-colors">Why Now</a>
        </div>
        <Link
          href="/dashboard"
          className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold px-4 py-2 bg-[#b8ff57] text-black rounded-lg hover:bg-[#d4ff8a] transition-colors"
        >
          Open Dashboard →
        </Link>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        {/* Hero */}
        <section className="pt-20 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-px bg-[#b8ff57]/50" />
              <span className="font-mono text-[10px] uppercase tracking-[3px] text-[#b8ff57]">AI Code Security · June 2026</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Your vibe-coded app<br />
              <span className="text-[#b8ff57]">has vulnerabilities.</span><br />
              <span className="text-[#44446a]">We fix them.</span>
            </h1>
            <p className="text-lg text-[#8888bb] leading-relaxed max-w-xl">
              DebtMap scans every repository you built with Lovable, Bolt, or Cursor and explains every security issue in plain English — then fixes it with one click.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGithubLogin}
                disabled={loading}
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-6 py-3.5 bg-[#b8ff57] text-black rounded-xl hover:bg-[#d4ff8a] transition-all shadow-lg shadow-[#b8ff57]/10 disabled:opacity-50 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> Connect GitHub Free
              </button>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-6 py-3.5 border border-white/10 text-[#8888bb] rounded-xl hover:text-white hover:border-white/20 transition-all"
              >
                View Demo Dashboard <ArrowRight size={14} />
              </Link>
            </div>

            {/* Crisis stats */}
            <div id="crisis" className="grid grid-cols-2 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden">
              {STATS.map((s) => (
                <div key={s.val} className="bg-[#0d0d1a] px-4 py-4">
                  <div className="text-2xl font-extrabold text-[#b8ff57] leading-none mb-1">{s.val}</div>
                  <div className="text-[11px] text-[#44446a] leading-snug">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Auth Card */}
          <div className="bg-[#0d0d1a] border border-white/8 rounded-2xl p-8 space-y-6 shadow-2xl">
            <div>
              <div className="flex bg-white/5 rounded-xl p-1 gap-1 mb-6">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-[1.5px] font-bold transition-all cursor-pointer ${
                      mode === m ? "bg-white/10 text-white" : "text-[#44446a] hover:text-[#8888bb]"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              {/* GitHub SSO */}
              <button
                onClick={handleGithubLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 border border-white/10 rounded-xl text-sm font-semibold text-white hover:bg-white/5 transition-all mb-5 disabled:opacity-50 cursor-pointer"
              >
                <GitBranch size={18} /> Continue with GitHub
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-white/5" />
                <span className="font-mono text-[9px] text-[#44446a] uppercase tracking-widest">or email</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                {mode === "signup" && (
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-[#44446a] focus:outline-none focus:border-[#b8ff57]/30 transition-colors"
                  />
                )}
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-[#44446a] focus:outline-none focus:border-[#b8ff57]/30 transition-colors"
                />
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-[#44446a] focus:outline-none focus:border-[#b8ff57]/30 transition-colors pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#44446a] hover:text-[#8888bb] cursor-pointer"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {errorMsg && (
                  <div className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 text-center">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-center py-3.5 bg-[#b8ff57] hover:bg-[#d4ff8a] text-black font-mono text-[11px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                  {mode === "signin" ? "Sign In to Dashboard" : "Create Free Account"}
                </button>
              </form>
            </div>

            <p className="text-[11px] text-[#44446a] text-center leading-relaxed">
              By continuing, you agree to our Terms of Service and Privacy Policy.<br />
              No credit card required for Free plan.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 border-t border-white/5">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-[#44446a] mb-3">What DebtMap Does</div>
            <h2 className="text-4xl font-extrabold">
              Security built for <span className="text-[#b8ff57]">non-developers</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[#0d0d1a] border border-white/5 rounded-2xl p-6 space-y-4 hover:border-white/10 transition-all">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${f.bg}`}>
                  <f.icon size={18} className={f.color} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-[#8888bb] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Example Issue — what it actually looks like */}
        <section className="py-16 border-t border-white/5">
          <div className="mb-10">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-[#44446a] mb-3">Example — What You See</div>
            <h2 className="text-4xl font-extrabold">
              Plain English. <span className="text-[#b8ff57]">Not jargon.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* What tools show you */}
            <div className="bg-[#0d0d1a] border border-white/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-[#ff5757]" />
                <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#44446a]">What other tools show you</span>
              </div>
              <div className="font-mono text-xs text-[#44446a] bg-black/40 rounded-xl p-4 leading-relaxed space-y-1">
                <div className="text-[#ff5757]">CRITICAL · javascript.express.security.audit.express-missing-auth</div>
                <div>BOLA · CWE-639 · OWASP A01:2021</div>
                <div>Broken Object Level Authorization vulnerability detected</div>
                <div>in endpoint /api/users/:id at line 47</div>
                <div className="text-[#44446a] pt-1">CVSS Score: 9.1 · AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N</div>
              </div>
              <p className="text-xs text-[#44446a]">Meaningless to a non-developer founder.</p>
            </div>

            {/* What DebtMap shows */}
            <div className="bg-[#0d0d1a] border border-[#b8ff57]/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#ff5757] shadow-[0_0_6px_#ff5757]" />
                <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#b8ff57]">What DebtMap shows you</span>
              </div>
              <div className="space-y-3">
                <div className="text-base font-bold text-white">Anyone can read any user's data</div>
                <p className="text-sm text-[#8888bb] leading-relaxed">
                  Your user profile endpoint doesn't check if the person asking is actually the account owner. Any logged-in user can change the ID in the URL and read someone else's profile, messages, or payment info.
                </p>
                <div className="space-y-2">
                  {["Users' emails and payment info are exposed to anyone", "GDPR violation — potential legal liability"].map((b) => (
                    <div key={b} className="flex items-start gap-2 text-xs text-[#8888bb] bg-[#ff5757]/5 border border-[#ff5757]/10 rounded-lg p-2.5">
                      <Lock size={12} className="text-[#ff5757] mt-0.5 flex-shrink-0" />
                      {b}
                    </div>
                  ))}
                </div>
                <button className="w-full py-3 bg-[#b8ff57] hover:bg-[#d4ff8a] text-black font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all">
                  Fix it — Open GitHub PR →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-16 border-t border-white/5">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-[#44446a] mb-3">Pricing</div>
            <h2 className="text-4xl font-extrabold">
              Priced per <span className="text-[#b8ff57]">repository.</span>
            </h2>
            <p className="text-[#8888bb] mt-3 max-w-xl">Not per developer seat. "How many apps do I have?" is a question any founder can answer.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`bg-[#0d0d1a] rounded-2xl p-6 flex flex-col relative ${
                  plan.highlight ? "border border-[#b8ff57]/30" : "border border-white/5"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[8px] uppercase tracking-[2px] bg-[#b8ff57] text-black px-4 py-1 rounded-full font-bold">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-5">
                  <div className="font-mono text-[10px] uppercase tracking-[2px] text-[#44446a] mb-2">{plan.name}</div>
                  <div>
                    <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                    <span className="text-sm text-[#44446a]">{plan.per}</span>
                  </div>
                  <p className="text-xs text-[#8888bb] mt-2">{plan.who}</p>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[#8888bb]">
                      <Check size={12} className="text-[#b8ff57] flex-shrink-0" /> {f}
                    </li>
                  ))}
                  {plan.locked.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[#44446a]">
                      <Lock size={12} className="flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGithubLogin}
                  disabled={loading}
                  className={`w-full text-center py-3 rounded-xl font-mono text-[10px] uppercase tracking-[1.5px] font-bold transition-all disabled:opacity-50 cursor-pointer ${
                    plan.highlight
                      ? "bg-[#b8ff57] text-black hover:bg-[#d4ff8a]"
                      : "border border-white/10 text-[#8888bb] hover:text-white hover:border-white/20"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 border-t border-white/5 text-center">
          <div className="inline-flex items-center gap-2 bg-[#ff5757]/10 border border-[#ff5757]/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ff5757] animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#ff5757]">91.5% of vibe-coded apps are vulnerable right now</span>
          </div>
          <h2 className="text-4xl font-extrabold mb-4">
            Is yours one of them?
          </h2>
          <p className="text-[#8888bb] mb-8 max-w-lg mx-auto">
            Connect your GitHub repo and find out in 2 minutes. Free forever for 1 repository.
          </p>
          <button
            onClick={handleGithubLogin}
            disabled={loading}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-8 py-4 bg-[#b8ff57] text-black rounded-xl hover:bg-[#d4ff8a] transition-all shadow-lg shadow-[#b8ff57]/10 disabled:opacity-50 cursor-pointer"
          >
            <GitBranch size={16} /> Scan My Repository — Free <ArrowRight size={14} />
          </button>
        </section>
      </main>

      <footer className="border-t border-white/5 py-6 text-center font-mono text-[9px] text-[#44446a] tracking-widest uppercase">
        DEBTMAP · AI CODE SECURITY FOR THE VIBE CODING ERA · JUNE 2026
      </footer>
    </div>
  );
}
