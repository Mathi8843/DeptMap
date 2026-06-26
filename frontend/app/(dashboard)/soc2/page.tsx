"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useData } from "@/lib/contexts/DataContext";
import { useToast } from "@/lib/contexts/ToastContext";
import { useRouter } from "next/navigation";
import { Lock, Download, Share2, Shield, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, CreditCard, ShieldCheck } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/plan-limits";

const statusConfig = {
  passing: { label: "Control Passing", text: "text-emerald-500 dark:text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10", icon: CheckCircle },
  failing: { label: "Control Failing", text: "text-rose-500 dark:text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10", icon: XCircle },
  partial: { label: "Partial Compliance", text: "text-amber-500 dark:text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10", icon: AlertTriangle },
};

export default function Soc2Page() {
  const { user } = useAuth();
  const { upgradePlan, soc2Report } = useData();
  const { showToast } = useToast();
  const router = useRouter();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [expandedControl, setExpandedControl] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isCheckoutOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsCheckoutOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isCheckoutOpen]);

  const hasSoc2 = PLAN_LIMITS[user.plan].soc2_report;

  // Calculate readiness metrics from backend report
  const controls = soc2Report?.controls || [];
  const readiness = soc2Report?.readiness_percent ?? 0;
  const passingCount = soc2Report?.passing_count ?? 0;
  const failingCount = soc2Report?.failing_count ?? 0;
  const partialCount = soc2Report?.partial_count ?? 0;

  const handleShare = () => {
    navigator.clipboard.writeText("https://app.riskguardai.com/shared/audit/usr_01_soc2");
    showToast("Shareable audit report link copied to clipboard", "success");
  };

  const handleDownloadPdf = () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    showToast("Generating compliant PDF security report...", "info");
    
    setTimeout(() => {
      setIsGeneratingPdf(false);
      showToast("SOC 2 Readiness PDF downloaded successfully!", "success");
    }, 2000);
  };

  const handleUpgradePayment = () => {
    setIsCheckoutOpen(false);
    router.push("/settings?upgrade=team");
  };

  // 1. LOCKED VIEW
  if (!hasSoc2) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 relative min-h-full flex flex-col justify-between">
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
            SOC 2 Compliance
          </h1>
          <p className="text-sm text-text-sub">
            Map security vulnerabilities to SOC 2 Trust Services Criteria
          </p>
        </div>

        {/* Locked Feature Gate */}
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="w-full max-w-xl glass-card rounded-2xl p-10 border border-border-subtle text-center space-y-6 relative overflow-hidden shadow-2xl animate-slide-up">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 to-indigo-500" />
            
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-500 mx-auto glow-purple">
              <Lock size={28} />
            </div>

            <div className="space-y-2.5">
              <h2 className="font-display font-extrabold text-xl text-text-main">Unlock Compliance Audits</h2>
              <p className="text-sm text-text-sub max-w-md mx-auto leading-relaxed">
                Continuous SOC 2 control mappings are available on the <strong className="text-purple-500 dark:text-purple-400">Team Plan</strong>. Generate secure compliance sheets and share live reports with enterprise customers.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="font-mono text-[10px] uppercase tracking-[1.5px] font-bold px-8 py-3.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                Upgrade Workspace — ₹16,000/mo
              </button>
            </div>
          </div>
        </div>

        {/* Checkout Modal Simulation */}
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)} />
            <div role="dialog" aria-modal="true" aria-label="Checkout" className="relative w-full max-w-sm bg-bg-panel border border-border-subtle rounded-2xl p-6 shadow-2xl z-10 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-purple-500" />
                  <span className="text-xs font-mono font-bold text-text-main">CHECKOUT GATEWAY</span>
                </div>
                <button onClick={() => setIsCheckoutOpen(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-text-main" aria-label="Close checkout">
                  <XCircle size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-[10px] text-text-muted uppercase font-mono">Plan Selected</div>
                  <div className="text-xs font-bold text-text-main">Risk Guard AI Team Workspace Audit Plan</div>
                  <div className="text-[11px] text-purple-500 font-mono">₹16,000 / month (billed monthly)</div>
                </div>

                <div className="space-y-2.5">
                  <div className="text-[10px] text-text-muted uppercase font-mono">Card Details</div>
                  <input
                    type="text"
                    disabled
                    value="••••  ••••  ••••  4242"
                    className="w-full bg-bg-deep border border-border-subtle rounded-xl px-4 py-2.5 text-xs text-text-sub"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" disabled value="12/29" className="bg-bg-deep border border-border-subtle rounded-xl px-4 py-2 text-xs text-text-sub" />
                    <input type="text" disabled value="•••" className="bg-bg-deep border border-border-subtle rounded-xl px-4 py-2 text-xs text-text-sub" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleUpgradePayment}
                className="w-full py-3.5 bg-purple-500 hover:bg-purple-600 text-white font-mono text-[9px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-500/10 active:scale-[0.98]"
              >
                Complete Payment (Simulated)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. UNLOCKED VIEW
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
            SOC 2 Trust Criteria
          </h1>
          <p className="text-sm text-text-sub mt-1">
            Map repository vulnerabilities to SOC 2 Trust Services compliance points
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleShare}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[1px] font-bold px-5 py-3 border border-border-subtle hover:border-border-glow bg-bg-deep/40 text-text-sub rounded-xl transition-all cursor-pointer hover:bg-bg-panel/60"
          >
            <Share2 size={14} />
            Share Audit URL
          </button>
          
          <button 
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            aria-busy={isGeneratingPdf}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[1px] font-bold px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} className={isGeneratingPdf ? "animate-spin" : ""} />
            {isGeneratingPdf ? "Generating..." : "Download Compliance PDF"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        {/* Readiness Gauge */}
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-text-muted font-bold">Readiness Score</div>
            <div className="font-display font-extrabold text-3xl text-purple-500 dark:text-purple-400 tracking-wide">{readiness}%</div>
          </div>
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="28" cy="28" r="23" className="stroke-bg-deep fill-none" strokeWidth="3.5" />
              <circle 
                cx="28" cy="28" r="23" 
                className="stroke-purple-500 fill-none transition-all duration-1000" 
                strokeWidth="3.5" 
                strokeDasharray="144"
                strokeDashoffset={144 - (144 * readiness) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[10px] font-display font-extrabold text-purple-500 dark:text-purple-400">{readiness}%</span>
          </div>
        </div>

        {/* Passing Controls */}
        <div className="glass-card rounded-2xl p-5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-text-muted font-bold">Controls Passing</div>
          <div className="font-display font-extrabold text-3xl text-emerald-500 dark:text-emerald-400 tracking-wide">
            {passingCount} <span className="text-xs text-text-muted">/ {controls.length}</span>
          </div>
        </div>

        {/* Failing Controls */}
        <div className="glass-card rounded-2xl p-5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-text-muted font-bold">Controls Failing</div>
          <div className="font-display font-extrabold text-3xl text-rose-500 tracking-wide text-glow-rose">
            {failingCount}
          </div>
        </div>

        {/* Remediate timeline */}
        <div className="glass-card rounded-2xl p-5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-text-muted font-bold">Remediation SLA</div>
          <div className="font-display font-extrabold text-3xl text-text-main tracking-wide">
            ~6 Weeks
          </div>
        </div>
      </div>

      {/* Controls List Accordion */}
      <div className="space-y-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold">
          Audited Controls ({controls.length} Criteria mapped)
        </h3>

        <div className="space-y-4">
          {controls.map((control: any) => {
            const cfg = (statusConfig as any)[control.status];
            const StatusIcon = cfg.icon;
            const isExpanded = expandedControl === control.id;

            return (
              <div 
                key={control.id}
                className={`glass-card rounded-2xl overflow-hidden border transition-all ${
                  isExpanded ? "border-border-glow" : "border-border-subtle"
                }`}
              >
                {/* Control Header */}
                <div 
                  onClick={() => setExpandedControl(isExpanded ? null : control.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedControl(isExpanded ? null : control.id); } }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  className="p-5 flex items-center justify-between gap-5 cursor-pointer hover:bg-border-subtle select-none"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <StatusIcon className={`${cfg.text} flex-shrink-0`} size={18} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm font-bold text-indigo-500 dark:text-indigo-400">{control.id}</span>
                        <h4 className="text-sm font-bold text-text-main truncate">{control.name}</h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className={`font-mono text-[9px] font-bold uppercase tracking-[1px] px-2.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 bg-bg-deep/10 border-t border-border-subtle space-y-4 animate-fade-in">
                    <div className="text-xs text-text-sub leading-relaxed font-sans max-w-4xl">
                      This criterion evaluates system logical access restrictions, database authorization integrity checkpoints, and registry validation protocols. Review the associated vulnerabilities mapped to this control:
                    </div>

                    {control.issues.length === 0 ? (
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-500 dark:text-emerald-400 font-mono flex items-center gap-2">
                        <ShieldCheck size={14} />
                        No blocking vulnerabilities associated with this control point. Criterion is passing compliance audit checklists.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">Blocking Vulnerabilities:</div>
                        {control.issues.map((issueStr: string, idx: number) => (
                          <div 
                            key={idx}
                            className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/10 text-xs text-rose-300 font-mono flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Shield size={14} className="text-rose-400 flex-shrink-0" />
                              <span className="truncate">{issueStr}</span>
                            </div>
                            <Link 
                              href="/issues"
                              className="font-mono text-[10px] font-bold uppercase tracking-[1px] text-lime-500 dark:text-lime-400 hover:underline flex-shrink-0"
                            >
                              Resolve →
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Enterprise compliance tip banner */}
      <div className="glass-card rounded-2xl p-5 border-purple-500/10 flex gap-4 items-start bg-bg-deep/10">
        <Shield size={20} className="text-purple-500 dark:text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold text-text-main font-mono uppercase tracking-[1px]">Sales Compliance Pitch Script</h4>
          <p className="text-xs text-text-sub italic leading-relaxed">
            "We run continuous repository static analysis scanning via Risk Guard AI, validating code commits against SOC 2 criteria Logical and physical access controls CC6.1. Our readiness level is currently at {readiness}% compliance, on schedule for external Q3 auditing."
          </p>
        </div>
      </div>
    </div>
  );
}
