"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield, Zap, Package, TrendingUp,
  Check, Lock, ShieldCheck, Server, BadgeCheck,
  Users, Award, Sun, Moon, Wifi, GitBranch, ArrowRight,
  ChevronDown, RotateCcw,
} from "lucide-react";
import { useTheme } from "@/lib/contexts/ThemeContext";
import ThreeDGrid from "@/components/ui/ThreeDGrid";
import TiltCard from "@/components/ui/TiltCard";

// ─── Data ──────────────────────────────────────────────────────────────────
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
    glow: "rgba(239,68,68,0.15)",
    title: "OWASP Vulnerability Scanner",
    desc: "Semgrep scans your code against 3,000+ security rules. Every issue explained in plain English — no jargon.",
  },
  {
    icon: Package,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    glow: "rgba(245,158,11,0.15)",
    title: "Slopsquatting Detector",
    desc: "AI tools hallucinate package names. We check every dependency against npm & PyPI registries to catch fake packages before attackers do.",
  },
  {
    icon: Zap,
    color: "text-lime-400",
    bg: "bg-lime-500/10 border-lime-500/20",
    glow: "rgba(132,204,22,0.15)",
    title: "One-Click GitHub PR Fix",
    desc: "Every issue has a Fix button. AI generates the patch. We open the GitHub PR automatically. You just merge.",
  },
  {
    icon: TrendingUp,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    glow: "rgba(99,102,241,0.15)",
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

// ─── Animated Scan Terminal ─────────────────────────────────────────────────
const SCAN_LINES = [
  { delay: 0,    color: "text-text-muted",   text: "$ debtmap scan ./my-app" },
  { delay: 600,  color: "text-indigo-400",   text: "↳ Cloning repository…  ✓" },
  { delay: 1100, color: "text-text-muted",   text: "↳ Running Semgrep (3,284 rules)…" },
  { delay: 2000, color: "text-rose-400",     text: "  CRITICAL  Broken Object-Level Auth   ×2" },
  { delay: 2400, color: "text-rose-400",     text: "  CRITICAL  Hardcoded Secrets Exposed   ×1" },
  { delay: 2800, color: "text-amber-400",    text: "  HIGH      npm Dependency Squatting    ×3" },
  { delay: 3300, color: "text-amber-400",    text: "  HIGH      SQL Injection Risk          ×1" },
  { delay: 3700, color: "text-yellow-400",   text: "  MEDIUM    Missing Auth Middleware     ×4" },
  { delay: 4100, color: "text-text-muted",   text: "↳ Checking PyPI/npm registries…  ✓" },
  { delay: 4700, color: "text-lime-400",     text: "↳ Health Score:  73 / 100  ▰▰▰▰▰▰▰▱▱▱" },
  { delay: 5300, color: "text-indigo-400",   text: "↳ Generating PR fixes with AI…   ✓" },
  { delay: 5900, color: "text-lime-400",     text: "✓ Done in 1m 47s — 3 PRs ready to merge" },
];

function ScanTerminal() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (visibleCount >= SCAN_LINES.length) return;
    const delay = SCAN_LINES[visibleCount].delay - (visibleCount > 0 ? SCAN_LINES[visibleCount - 1].delay : 0);
    const t = setTimeout(() => setVisibleCount((c) => c + 1), visibleCount === 0 ? SCAN_LINES[0].delay + 300 : delay);
    return () => clearTimeout(t);
  }, [visibleCount]);

  useEffect(() => {
    const t = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-border-subtle" style={{ background: "#080810" }}>
      {/* Terminal title bar */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-white/5">
        <span className="w-3 h-3 rounded-full bg-rose-500/80" />
        <span className="w-3 h-3 rounded-full bg-amber-400/80" />
        <span className="w-3 h-3 rounded-full bg-lime-400/80" />
        <span className="ml-2 font-mono text-[10px] text-white/25 uppercase tracking-widest">Risk Guard AI · Scan Terminal</span>
        {visibleCount >= SCAN_LINES.length ? (
          <button
            onClick={() => setVisibleCount(0)}
            className="ml-auto font-mono text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 border border-indigo-500/20 bg-indigo-500/5 px-2 py-0.5 rounded cursor-pointer"
            aria-label="Restart scan simulation"
          >
            <RotateCcw size={8} /> Run Again
          </button>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-lime-400/70">
            <Wifi size={10} className="animate-pulse" /> LIVE
          </span>
        )}
      </div>
      {/* Output */}
      <div className="p-5 space-y-1.5 font-mono text-xs min-h-[280px]">
        {SCAN_LINES.slice(0, visibleCount).map((line, i) => (
          <div key={i} className={`${line.color} leading-relaxed`}>
            {line.text}
          </div>
        ))}
        {visibleCount < SCAN_LINES.length && (
          <span className="inline-block w-2 h-4 bg-indigo-400 opacity-80" style={{ opacity: cursor ? 0.8 : 0 }} />
        )}
      </div>
      {/* Health score bar (shows when done) */}
      {visibleCount >= SCAN_LINES.length && (
        <div className="px-5 pb-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">Health Score</span>
            <span className="text-xl font-extrabold text-lime-400">73</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: "73%",
                background: "linear-gradient(90deg, #22c55e, #84cc16)",
                boxShadow: "0 0 10px rgba(132,204,22,0.4)",
              }}
            />
          </div>
          <div className="flex gap-2 pt-1">
            {["2 Critical", "1 High", "3 Packages"].map((badge) => (
              <span
                key={badge}
                className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-white/10 text-white/50 uppercase tracking-wider"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const isDark = theme === "dark";

  return (
    <div
      className="min-h-screen text-text-main font-sans"
      style={{
        background: isDark
          ? "radial-gradient(ellipse at 50% 0%, #15102a 0%, #06060c 60%)"
          : "radial-gradient(ellipse at 50% 0%, #c7d2fe 0%, #e2e8f0 35%, #f1f5f9 100%)",
      }}
    >
      {/* ─── Navbar ─────────────────────────────────────────── */}
      <nav className="border-b border-border-subtle px-4 sm:px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Risk Guard AI Logo" className="w-7 h-7 object-contain" />
          <span className="font-bold text-base tracking-wide text-text-main">Risk Guard AI</span>
          <span className="font-mono text-[9px] px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-full uppercase tracking-widest">
            Beta
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-text-muted">
          <a href="#features" className="hover:text-text-main transition-colors">Security Features</a>
          <a href="#how-it-works" className="hover:text-text-main transition-colors">How It Works</a>
          <a href="#trust" className="hover:text-text-main transition-colors">Trust &amp; Security</a>
          <a href="#pricing" className="hover:text-text-main transition-colors">Plans &amp; Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border-subtle hover:bg-border-subtle text-text-sub hover:text-text-main transition-all cursor-pointer"
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link
            href="/login"
            className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold px-4 py-2.5 border border-border-subtle text-text-sub hover:text-text-main hover:border-border-glow rounded-xl transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
          >
            Get Started <ArrowRight size={11} />
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* ─── Hero ───────────────────────────────────────────── */}
        <section className="relative pt-12 sm:pt-20 pb-12 sm:pb-16">
          {/* 3D grid behind the hero content */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-full pointer-events-none overflow-hidden rounded-3xl"
            style={{ zIndex: 0 }}
          >
            <ThreeDGrid
              className="w-full h-full pointer-events-auto"
              lineColor={isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.05)"}
              dotColor={isDark ? "rgba(184,255,87,0.5)" : "rgba(99,102,241,0.4)"}
              cols={28}
              rows={18}
              warpRadius={240}
              warpStrength={0.35}
            />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center">
            {/* Left copy */}
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-px bg-indigo-500/50 dark:bg-[#b8ff57]/50" />
                <span className="font-mono text-[10px] uppercase tracking-[3px] text-indigo-600 dark:text-[#b8ff57] font-bold">
                  AI Code Security · Updated June 2026
                </span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none text-text-main">
                Your AI app
                <span className="block text-indigo-600 dark:text-indigo-400">has vulnerabilities.</span>
                <span className="block text-text-muted">We fix them.</span>
              </h1>
              <p className="text-lg text-text-sub leading-relaxed max-w-xl">
                Scan Lovable, Bolt &amp; Cursor apps for OWASP vulnerabilities and slopsquatted packages. AI-powered explanations with 1-click GitHub PR fixes. Free for 1 repo.
              </p>
              <div className="flex flex-row items-center gap-3 flex-wrap">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-6 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  <ShieldCheck size={15} /> Scan My Repository — Free
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-6 py-3.5 border border-border-subtle text-text-sub rounded-xl hover:text-text-main hover:border-border-glow transition-all"
                >
                  Learn More
                </a>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                {STATS.map((s) => (
                  <TiltCard
                    key={s.val}
                    className="glass-card rounded-xl px-4 py-4 text-center border border-border-subtle"
                    maxTilt={10}
                    perspective={600}
                    scale={1.04}
                  >
                    <div className="text-lg sm:text-2xl font-extrabold text-indigo-600 dark:text-[#b8ff57] leading-none mb-1">
                      {s.val}
                    </div>
                    <div className="text-[10px] text-text-muted leading-snug uppercase tracking-wider font-semibold">
                      {s.label}
                    </div>
                  </TiltCard>
                ))}
              </div>
            </div>

            {/* Right — Animated scan terminal */}
            <div className="space-y-5">
              <ScanTerminal />
              <TiltCard
                className="glass-card rounded-2xl p-4 border border-indigo-500/20"
                maxTilt={6}
                perspective={800}
              >
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <GitBranch size={15} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-text-sub font-medium">Ready to fix 3 issues with open PRs</p>
                    <p className="text-xs text-text-muted">Pull requests are waiting to be merged on GitHub</p>
                  </div>
                  <Link href="/signup" className="ml-auto flex-shrink-0 font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border border-indigo-500/20 rounded-lg transition-all">
                    Fix Now →
                  </Link>
                </div>
              </TiltCard>
            </div>
          </div>
        </section>

        {/* ─── Features ───────────────────────────────────────── */}
        <section id="features" className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">What Risk Guard AI Does</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Security built for <span className="text-indigo-600 dark:text-[#b8ff57]">non-developers</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <TiltCard
                key={f.title}
                className="glass-card rounded-2xl p-6 space-y-4 border border-border-subtle"
                maxTilt={9}
                perspective={800}
                shineColor={`${f.glow}`}
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${f.bg}`}>
                  <f.icon size={18} className={f.color} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-main mb-1.5">{f.title}</h3>
                  <p className="text-sm text-text-sub leading-relaxed">{f.desc}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ─── How It Works ───────────────────────────────────── */}
        <section id="how-it-works" className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">How Risk Guard AI Works</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              From repo to fix in <span className="text-indigo-600 dark:text-[#b8ff57]">2 minutes</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { step: "01", title: "Link Repository", desc: "Select any public or private GitHub repository. It takes only two clicks to link via read-only OAuth." },
              { step: "02", title: "Automated Audit", desc: "Our engine scans your code for BOLA, SSRF, broken auth, SQLi, secrets, and slopsquatted packages." },
              { step: "03", title: "One-Click Patch", desc: "Risk Guard AI translates vulnerabilities into plain English and generates a pull request with the fix. You just merge." },
            ].map((s) => (
              <TiltCard
                key={s.step}
                className="glass-card rounded-2xl p-6 space-y-3 border border-border-subtle"
                maxTilt={8}
                perspective={700}
              >
                <div className="font-mono text-[9px] text-indigo-600 dark:text-[#b8ff57] uppercase tracking-[3px] font-bold">{s.step}</div>
                <h3 className="font-bold text-base text-text-main">{s.title}</h3>
                <p className="text-sm text-text-sub leading-relaxed">{s.desc}</p>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ─── Plain English Example ──────────────────────────── */}
        <section className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">Example — What You See</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Plain English. <span className="text-indigo-600 dark:text-[#b8ff57]">Not jargon.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* CLI output mock */}
            <div className="bg-[#030308] border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between font-mono text-zinc-400">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-zinc-500 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5757]" />
                  <span className="text-[10px] uppercase tracking-[2px] font-bold">Standard CLI scanner output</span>
                </div>
                <div className="font-mono text-xs text-zinc-500 bg-black/40 rounded-xl p-4 leading-relaxed space-y-1">
                  <div className="text-rose-500">CRITICAL · javascript.express.security.audit.express-missing-auth</div>
                  <div>BOLA · CWE-639 · OWASP A01:2021</div>
                  <div>Broken Object Level Authorization vulnerability detected</div>
                  <div>in endpoint /api/users/:id at line 47</div>
                  <div className="text-zinc-650 pt-1">CVSS Score: 9.1 · AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N</div>
                </div>
              </div>
              <p className="text-xs text-zinc-600">Meaningless to a non-developer founder.</p>
            </div>

            {/* Risk Guard AI output */}
            <TiltCard
              className="glass-card border border-indigo-500/20 rounded-2xl p-6 space-y-4 flex flex-col justify-between"
              maxTilt={7}
              perspective={900}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#ef4444]" />
                  <span className="font-mono text-[10px] uppercase tracking-[2px] text-indigo-600 dark:text-[#b8ff57] font-bold">What Risk Guard AI shows you</span>
                </div>
                <div className="space-y-3">
                  <div className="text-base font-bold text-text-main">Anyone can read any user&apos;s data</div>
                  <p className="text-sm text-text-sub leading-relaxed">
                    Your user profile endpoint doesn&apos;t check if the person asking is actually the account owner. Any logged-in user can change the ID in the URL and read someone else&apos;s profile, messages, or payment info.
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
              <Link href="/signup" className="w-full block text-center py-3 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:hover:bg-[#d4ff8a] dark:text-black font-mono text-[10px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer">
                Fix it — Open GitHub PR →
              </Link>
            </TiltCard>
          </div>
        </section>

        {/* ─── Trust ──────────────────────────────────────────── */}
        <section id="trust" className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">Your Data Is Safe</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Built with <span className="text-indigo-600 dark:text-[#b8ff57]">trust</span> at every layer
            </h2>
            <p className="text-text-sub mt-3 max-w-xl">
              Security is not a feature — it&apos;s the foundation. Every layer of Risk Guard AI is designed to protect your code and your privacy.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: ShieldCheck, color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", title: "Encrypted by Default", desc: "All traffic encrypted with TLS 1.3. Data at rest encrypted with AES-256. Your secrets stay yours." },
              { icon: Lock, color: "text-indigo-500 dark:text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", title: "Read-Only, Always", desc: "Risk Guard AI requests read-only GitHub access. We never push code, never store source, and never modify your repositories." },
              { icon: Server, color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", title: "Ephemeral Scanning", desc: "Source code is scanned in real-time and discarded. Scan results persist — your code doesn't." },
              { icon: BadgeCheck, color: "text-lime-500 dark:text-lime-400", bg: "bg-lime-500/10 border-lime-500/20", title: "SOC 2 Methodology", desc: "Every vulnerability is mapped to SOC 2 Trust Services Criteria. Generate a live compliance report for enterprise reviews." },
            ].map((t) => (
              <TiltCard
                key={t.title}
                className="glass-card rounded-2xl p-6 space-y-4 border border-border-subtle"
                maxTilt={8}
                perspective={700}
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${t.bg}`}>
                  <t.icon size={18} className={t.color} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-main mb-1.5">{t.title}</h3>
                  <p className="text-sm text-text-sub leading-relaxed">{t.desc}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ─── Pricing ────────────────────────────────────────── */}
        <section id="pricing" className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">Pricing</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Priced per <span className="text-indigo-600 dark:text-[#b8ff57]">repository.</span>
            </h2>
            <p className="text-text-sub mt-3 max-w-xl">Not per developer seat. &ldquo;How many apps do I have?&rdquo; is a question any founder can answer.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <TiltCard
                key={plan.name}
                className={`glass-card rounded-2xl p-6 flex flex-col relative ${
                  plan.highlight ? "border border-indigo-500/40 dark:border-[#b8ff57]/30" : "border border-border-subtle"
                }`}
                contentClassName="flex flex-col flex-1 h-full"
                maxTilt={7}
                perspective={800}
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
                <Link
                  href="/signup"
                  className={`w-full text-center py-3 rounded-xl font-mono text-[10px] uppercase tracking-[1.5px] font-bold transition-all ${
                    plan.highlight
                      ? "bg-indigo-500 text-white hover:bg-indigo-600 dark:bg-[#b8ff57] dark:text-black dark:hover:bg-[#d4ff8a]"
                      : "border border-border-subtle text-text-sub hover:text-text-main hover:border-border-glow"
                  }`}
                >
                  {plan.cta}
                </Link>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ─── Team / Social Proof ────────────────────────────── */}
        <section className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">Who Built This</div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
              Built by engineers who <span className="text-indigo-600 dark:text-[#b8ff57]">ship security</span>
            </h2>
            <p className="text-text-sub mt-3 max-w-2xl mx-auto">
              Risk Guard AI was created by a team of security engineers and developer-tool builders who experienced the chaos of AI-generated code first-hand.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Award, stat: "25+", label: "Years combined security experience" },
              { icon: ShieldCheck, stat: "3,000+", label: "OWASP rules mapped to plain English" },
              { icon: Users, stat: "5,000+", label: "GitHub repositories audited in beta" },
            ].map((m) => (
              <TiltCard
                key={m.label}
                className="glass-card rounded-2xl p-6 text-center space-y-3 border border-border-subtle"
                maxTilt={9}
                perspective={700}
              >
                <div className="w-10 h-10 rounded-xl border border-border-subtle bg-bg-card flex items-center justify-center mx-auto">
                  <m.icon size={18} className="text-indigo-600 dark:text-[#b8ff57]" />
                </div>
                <div className="font-display font-extrabold text-3xl text-text-main">{m.stat}</div>
                <div className="text-sm text-text-sub leading-snug">{m.label}</div>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ─── CTA Banner ─────────────────────────────────────── */}
        <section className="py-10 sm:py-16 border-t border-border-subtle text-center">
          <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[2px] text-rose-600 dark:text-rose-400 font-bold">
              91.5% of vibe-coded apps are vulnerable right now
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-4 text-text-main">Is yours one of them?</h2>
          <p className="text-text-sub mb-8 max-w-lg mx-auto">
            Connect your GitHub repo and find out in 2 minutes. Free forever for 1 repository.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[1.5px] font-bold px-8 py-4 bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-[#b8ff57] dark:hover:bg-[#d4ff8a] dark:text-black rounded-xl transition-all shadow-lg shadow-indigo-500/10 dark:shadow-[#b8ff57]/10"
          >
            <GitBranch size={16} /> Scan My Repository — Free <ArrowRight size={14} />
          </Link>
        </section>

        {/* ─── FAQ ────────────────────────────────────────────── */}
        <section className="py-10 sm:py-16 border-t border-border-subtle">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <div className="font-mono text-[9px] uppercase tracking-[3px] text-text-muted mb-3">FAQ</div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-text-main">
                Common questions <span className="text-indigo-600 dark:text-[#b8ff57]">answered</span>
              </h2>
            </div>
            <div className="space-y-3">
              {[
                { q: "What is Risk Guard AI?", a: "Risk Guard AI is an AI-powered security scanner built for apps generated with AI coding tools like Lovable, Bolt, Cursor, and Replit. It finds OWASP vulnerabilities, detects slopsquatted packages, and generates one-click GitHub PR fixes — all explained in plain English." },
                { q: "Do I need to be a developer to use Risk Guard AI?", a: "No. Risk Guard AI was built specifically for non-developer founders who shipped their app with AI. Every vulnerability is explained in plain English with clear instructions on what it means and how to fix it." },
                { q: "What tools does Risk Guard AI work with?", a: "Risk Guard AI works with any GitHub repository, regardless of how it was built. Whether you used Lovable, Bolt, Cursor, Replit, or wrote the code yourself, we scan and protect it." },
                { q: "Is my code stored on your servers?", a: "Your source code is scanned in real-time and is not permanently stored. Scan results — vulnerability data and health scores — are saved so you can track progress over time. Your actual code stays on GitHub." },
                { q: "Can I cancel my subscription?", a: "Yes. There are no lock-in contracts. The Free plan is free forever, and paid plans can be cancelled at any time. You keep access to your dashboard until the billing period ends." },
              ].map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <TiltCard
                    key={faq.q}
                    className="glass-card rounded-2xl border border-border-subtle overflow-hidden transition-all duration-200"
                    maxTilt={1}
                    perspective={1200}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                      aria-expanded={isOpen}
                    >
                      <h3 className="font-bold text-sm text-text-main">{faq.q}</h3>
                      <ChevronDown
                        size={16}
                        className={`text-text-muted transition-transform duration-300 ${
                          isOpen ? "transform rotate-180 text-indigo-500" : ""
                        }`}
                      />
                    </button>
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isOpen ? "max-h-[200px] border-t border-border-subtle/30 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                      }`}
                    >
                      <p className="p-5 text-sm text-text-sub leading-relaxed bg-indigo-500/[0.02]">
                        {faq.a}
                      </p>
                    </div>
                  </TiltCard>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border-subtle bg-bg-card/30">
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 pb-12 border-b border-border-subtle">
            {/* Column 1: Branding & Status */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="Risk Guard AI Logo" className="w-8 h-8 object-contain" />
                <span className="font-bold text-base text-text-main tracking-wide">Risk Guard AI</span>
                <span className="font-mono text-[8px] px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-full uppercase tracking-widest">Beta</span>
              </div>
              <p className="text-xs text-text-sub leading-relaxed max-w-[220px]">
                Securing AI-generated applications with automated scans, plain-English explanations, and instant fixes.
              </p>
              {/* System Status Badge */}
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">All Systems Operational</span>
              </div>
            </div>

            {/* Column 2: Product */}
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-[2.5px] text-text-main font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-xs text-text-sub">
                <li><a href="#features" className="hover:text-indigo-500 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-indigo-500 transition-colors">Pricing</a></li>
                <li><Link href="/signup" className="hover:text-indigo-500 transition-colors">Scan History</Link></li>
                <li><a href="#pricing" className="hover:text-indigo-500 transition-colors">Enterprise Plans</a></li>
              </ul>
            </div>

            {/* Column 3: Resources */}
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-[2.5px] text-text-main font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-xs text-text-sub">
                <li><a href="#" className="hover:text-indigo-500 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-indigo-500 transition-colors">AI Security Guide</a></li>
                <li><a href="#" className="hover:text-indigo-500 transition-colors">OWASP Top 10</a></li>
                <li><a href="mailto:support@riskguardai.com" className="hover:text-indigo-500 transition-colors">Contact Support</a></li>
              </ul>
            </div>

            {/* Column 4: Trust & Compliance */}
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-[2.5px] text-text-main font-bold mb-4">Security & Compliance</h4>
              <ul className="space-y-2.5 text-xs text-text-sub">
                <li className="flex items-center gap-2"><Lock size={12} className="text-text-muted flex-shrink-0" /> AES-256 Encryption</li>
                <li className="flex items-center gap-2"><ShieldCheck size={12} className="text-text-muted flex-shrink-0" /> SOC 2 Mapped Scans</li>
                <li className="flex items-center gap-2"><Server size={12} className="text-text-muted flex-shrink-0" /> Ephemeral Sandbox</li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
            <div className="font-mono text-[10px] tracking-wider">
              &copy; {new Date().getFullYear()} Risk Guard AI Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-text-main transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-text-main transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
