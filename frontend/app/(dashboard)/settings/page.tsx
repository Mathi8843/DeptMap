"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useData } from "@/lib/contexts/DataContext";
import { useToast } from "@/lib/contexts/ToastContext";
import { Check, X, Shield, CreditCard, Bell, HelpCircle, AlertCircle, Zap, Loader2 } from "lucide-react";
import clsx from "clsx";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { apiFetch } from "@/lib/api";

const plans = [
  {
    key: "free" as const,
    name: "Free",
    price: "₹0",
    per: "/month",
    description: "Indie hackers and student builders",
    features: [
      { label: "1 repository limit", included: true },
      { label: "Weekly automated scan", included: true },
      { label: "Health score indexing", included: true },
      { label: "AI fix suggestions", included: false },
      { label: "Slopsquatting detection", included: false },
      { label: "One-click GitHub PR", included: false },
      { label: "SOC 2 readiness mapping", included: false },
    ],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "₹4,000",
    per: "/month",
    description: "Solo founders with active paying users",
    featured: true,
    features: [
      { label: "Unlimited repositories", included: true },
      { label: "Real-time scanning on push", included: true },
      { label: "AI explanation descriptions", included: true },
      { label: "AI-generated fix patches", included: true },
      { label: "One-click GitHub PR fix", included: true },
      { label: "Slopsquatting audit", included: true },
      { label: "SOC 2 readiness mapping", included: false },
    ],
  },
  {
    key: "team" as const,
    name: "Team",
    price: "₹16,000",
    per: "/month",
    description: "Pre-Series A teams chasing compliance",
    features: [
      { label: "Everything in Pro plan", included: true },
      { label: "PR-level automated scanning", included: true },
      { label: "Team sharing dashboards", included: true },
      { label: "SOC 2 compliance report", included: true },
      { label: "Shareable security report links", included: true },
      { label: "Slack alert channels", included: true },
    ],
  },
  {
    key: "enterprise" as const,
    name: "Enterprise",
    price: "₹1.6L+",
    per: "/year",
    description: "Agencies and compliance-heavy companies",
    features: [
      { label: "Everything in Team plan", included: true },
      { label: "White-label reports mapping", included: true },
      { label: "Custom scanning parameters", included: true },
      { label: "Dedicated support engineer", included: true },
      { label: "SSO / SAML authentication", included: true },
      { label: "Annual compliance audits", included: true },
    ],
  },
];

export default function SettingsPage() {
  const { user, login } = useAuth();
  const { upgradePlan } = useData();
  const { showToast } = useToast();
  const [selectedPlanKey, setSelectedPlanKey] = useState<typeof user.plan | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [activePaymentTab, setActivePaymentTab] = useState<"razorpay" | "coupon">("razorpay");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const upgradePlanParam = params.get("upgrade");
      if (upgradePlanParam === "pro" || upgradePlanParam === "team" || upgradePlanParam === "enterprise") {
        setSelectedPlanKey(upgradePlanParam);
        setIsCheckoutOpen(true);
      }
    }
  }, []);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayPayment = async () => {
    setPaying(true);
    const plan = plans.find((p) => p.key === selectedPlanKey);
    if (!plan) {
      showToast("No plan selected", "error");
      setPaying(false);
      return;
    }

    const isLoaded = await loadRazorpay();
    if (!isLoaded) {
      showToast("Razorpay SDK failed to load. Are you connected to the internet?", "error");
      setPaying(false);
      return;
    }

    try {
      const orderData = await apiFetch("/auth/razorpay/order", { method: "POST" });
      
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: `DebtMap ${plan.name}`,
        description: `Upgrade workspace to ${plan.name} tier`,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          setPaying(true);
          try {
            const verifyRes = await apiFetch("/auth/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
             });
              if (verifyRes.success) {
                login({
                  ...user,
                  plan: plan.key,
                });
                showToast(`Subscription upgraded to ${plan.name} successfully!`, "success");
                setIsCheckoutOpen(false);
              }
          } catch (err: any) {
            showToast(err.message || "Payment verification failed", "error");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: function() {
            setPaying(false);
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: "#6366f1",
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (err: any) {
      showToast(err.message || "Failed to initiate Razorpay checkout", "error");
      setPaying(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      showToast("Please enter a coupon code", "warning");
      return;
    }
    setApplyingCoupon(true);
    try {
      const result = await apiFetch("/auth/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      if (result.success) {
        login({
          ...user,
          plan: "pro"
        });
        showToast(result.message, "success");
        setIsCheckoutOpen(false);
        setCouponCode("");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to apply coupon code", "error");
    } finally {
      setApplyingCoupon(false);
    }
  };
  
  const defaultNotifs = { emailCritical: true, emailHigh: true, weeklyReport: true, slackCritical: false };
  type NotifState = typeof defaultNotifs;

  const [notifications, setNotifications] = useState<NotifState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("debtmap_notifications");
        if (saved) return JSON.parse(saved) as NotifState;
      } catch {}
    }
    return defaultNotifs;
  });

  useEffect(() => {
    localStorage.setItem("debtmap_notifications", JSON.stringify(notifications));
  }, [notifications]);

  const handleToggle = (key: keyof typeof notifications) => {
    if (key === "emailHigh" && !PLAN_LIMITS[user.plan].email_alerts) {
      showToast("Upgrade to Pro or Team to enable High severity alerts", "warning");
      return;
    }
    if (key === "slackCritical" && !PLAN_LIMITS[user.plan].slack_alerts) {
      showToast("Upgrade to Team plan to enable Slack alert channels", "warning");
      return;
    }

    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    showToast("Notification settings updated successfully.", "success");
  };

  const openCheckout = (planKey: typeof user.plan) => {
    setSelectedPlanKey(planKey);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutComplete = () => {
    if (selectedPlanKey) {
      upgradePlan(selectedPlanKey);
      setIsCheckoutOpen(false);
    }
  };

  const activePlanDetails = plans.find((p) => p.key === selectedPlanKey);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
          Settings & Billing
        </h1>
        <p className="text-sm text-text-sub">
          Manage workspace plan limits, audit notifications, and accounts
        </p>
      </div>

      {/* Account Info and Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="glass-card rounded-2xl p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">
              Account Workspace
            </h3>
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-display font-extrabold text-base text-indigo-500 dark:text-indigo-400">
                {user.name ? user.name[0] : "?"}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-bold text-text-main truncate">{user.name}</div>
                <div className="text-xs text-text-muted truncate">{user.email}</div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-3 border-t border-border-subtle">
            <span className="text-xs text-text-sub font-mono">Current Tier</span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[1.5px] px-3 py-1 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              {user.plan} Active
            </span>
          </div>
        </div>

        {/* Notifications Config Toggles */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 space-y-5">
          <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold flex items-center gap-1.5">
            <Bell size={12} className="text-indigo-500" /> Alert Notifications
          </h3>
          
          <div className="space-y-4">
            {/* Email Critical */}
            <div className="flex items-center justify-between gap-5">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text-main">Email alerts on Critical vulnerabilities</div>
                <div className="text-xs text-text-muted">Instant notification when a zero-day route is detected</div>
              </div>
              <button
                onClick={() => handleToggle("emailCritical")}
                role="switch"
                aria-checked={notifications.emailCritical}
                aria-label="Toggle email alerts on Critical vulnerabilities"
                className={`w-10 h-[1.375rem] rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  notifications.emailCritical ? "bg-indigo-500" : "bg-bg-deep border border-border-subtle"
                }`}
              >
                <div className={`w-[1.125rem] h-[1.125rem] rounded-full bg-white transition-transform ${notifications.emailCritical ? "translate-x-[1.125rem]" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Email High */}
            <div className="flex items-center justify-between gap-5">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text-main flex items-center gap-1.5">
                  Email alerts on High issues
                  {!PLAN_LIMITS[user.plan].email_alerts && <Zap size={11} className="text-indigo-400" />}
                </div>
                <div className="text-xs text-text-muted">Weekly resolution timeline reminders (requires Pro)</div>
              </div>
              <button
                onClick={() => handleToggle("emailHigh")}
                role="switch"
                aria-checked={notifications.emailHigh}
                aria-label="Toggle email alerts on High vulnerabilities"
                className={`w-10 h-[1.375rem] rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  notifications.emailHigh && PLAN_LIMITS[user.plan].email_alerts ? "bg-indigo-500" : "bg-bg-deep border border-border-subtle"
                }`}
              >
                <div className={`w-[1.125rem] h-[1.125rem] rounded-full bg-white transition-transform ${notifications.emailHigh && PLAN_LIMITS[user.plan].email_alerts ? "translate-x-[1.125rem]" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Weekly report */}
            <div className="flex items-center justify-between gap-5">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text-main">Weekly code health report card</div>
                <div className="text-xs text-text-muted">Summary metrics of connected workspaces and packages</div>
              </div>
              <button
                onClick={() => handleToggle("weeklyReport")}
                role="switch"
                aria-checked={notifications.weeklyReport}
                aria-label="Toggle weekly code health report card"
                className={`w-10 h-[1.375rem] rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  notifications.weeklyReport ? "bg-indigo-500" : "bg-bg-deep border border-border-subtle"
                }`}
              >
                <div className={`w-[1.125rem] h-[1.125rem] rounded-full bg-white transition-transform ${notifications.weeklyReport ? "translate-x-[1.125rem]" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Slack alerts */}
            <div className="flex items-center justify-between gap-5">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text-main flex items-center gap-1.5">
                  Slack Alert Channel Integration
                  {!PLAN_LIMITS[user.plan].slack_alerts && <Zap size={11} className="text-purple-500" />}
                </div>
                <div className="text-xs text-text-muted">Webhooks to project group feeds on scanners alerts (requires Team)</div>
              </div>
              <button
                onClick={() => handleToggle("slackCritical")}
                role="switch"
                aria-checked={notifications.slackCritical}
                aria-label="Toggle Slack alert channel integration"
                className={`w-10 h-[1.375rem] rounded-full p-0.5 transition-all duration-200 cursor-pointer ${
                  notifications.slackCritical && PLAN_LIMITS[user.plan].slack_alerts ? "bg-indigo-500" : "bg-bg-deep border border-border-subtle"
                }`}
              >
                <div className={`w-[1.125rem] h-[1.125rem] rounded-full bg-white transition-transform ${notifications.slackCritical && PLAN_LIMITS[user.plan].slack_alerts ? "translate-x-[1.125rem]" : "translate-x-0"}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Plans Pricing Selection Section */}
      <div className="space-y-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[2px] text-text-muted font-bold">
          Billing Workspace Plans
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const isCurrent = user.plan === plan.key;
            return (
              <div
                key={plan.key}
                className={clsx(
                  "glass-card rounded-2xl p-6 border flex flex-col justify-between space-y-5 hover:scale-[1.01]",
                  plan.featured ? "border-indigo-500/20 bg-indigo-500/[0.01]" : "border-border-subtle",
                  isCurrent && "border-indigo-500/40 ring-1 ring-indigo-500/20"
                )}
              >
                <div className="space-y-3.5">
                  {/* Plan title */}
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted font-bold">{plan.name}</span>
                    {isCurrent && (
                      <span className="font-mono text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase">CURRENT</span>
                    )}
                  </div>
                  
                  {/* Price */}
                  <div>
                    <span className="font-display font-extrabold text-3xl text-text-main">{plan.price}</span>
                    <span className="text-xs text-text-muted">{plan.per}</span>
                  </div>

                  <p className="text-xs text-text-sub leading-normal">{plan.description}</p>
                  
                  {/* Features */}
                  <ul className="space-y-2.5 pt-2">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs">
                        {feat.included ? (
                          <Check size={13} className="text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                        ) : (
                          <X size={13} className="text-text-muted mt-0.5 flex-shrink-0" />
                        )}
                        <span className={feat.included ? "text-text-sub font-semibold" : "text-text-muted"}>{feat.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sub Action */}
                <div>
                  {isCurrent ? (
                    <div className="w-full text-center font-mono text-[10px] uppercase tracking-[1px] font-bold py-3 rounded-xl border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 bg-indigo-500/5 select-none">
                      Active Account
                    </div>
                  ) : (
                    <button
                      onClick={() => openCheckout(plan.key)}
                      className={clsx(
                        "w-full py-3 rounded-xl font-mono text-[10px] uppercase tracking-[1px] font-bold transition-all cursor-pointer",
                        plan.featured
                          ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/10"
                          : "border border-border-subtle hover:border-border-glow text-text-sub hover:text-text-main bg-bg-deep/40"
                      )}
                    >
                      Switch to {plan.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real Billing Checkout Modal Popup */}
      {isCheckoutOpen && activePlanDetails && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)} />
          <div className="relative w-full max-w-sm glass-card rounded-2xl p-6 border border-white/10 shadow-2xl z-10 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-indigo-400" />
                <span className="text-xs font-mono font-bold text-white">UPGRADE ACCOUNT</span>
              </div>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Payment Options Tabs */}
            <div className="flex bg-white/5 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActivePaymentTab("razorpay")}
                className={clsx(
                  "flex-1 py-2 rounded-lg font-mono text-[9px] uppercase tracking-[1px] font-bold transition-all cursor-pointer",
                  activePaymentTab === "razorpay" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Razorpay
              </button>
              <button
                onClick={() => setActivePaymentTab("coupon")}
                className={clsx(
                  "flex-1 py-2 rounded-lg font-mono text-[9px] uppercase tracking-[1px] font-bold transition-all cursor-pointer",
                  activePaymentTab === "coupon" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Coupon Code
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 uppercase font-mono">Plan Selected</div>
                <div className="text-xs font-bold text-white">DebtMap {activePlanDetails.name} Plan</div>
                <div className="text-[11px] text-indigo-400 font-mono">
                  {activePlanDetails.price} {activePlanDetails.per}
                </div>
              </div>

              {activePaymentTab === "razorpay" ? (
                <div className="space-y-3.5">
                  <div className="text-xs text-slate-400 leading-relaxed">
                    Pay securely using Razorpay. Supports Cards, Netbanking, UPI, and Wallets.
                  </div>
                  <button
                    onClick={handleRazorpayPayment}
                    disabled={paying}
                    className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white font-mono text-[9px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/10 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {paying && <Loader2 className="animate-spin" size={12} />}
                    {paying ? "Processing Order..." : `Pay ${activePlanDetails.price} via Razorpay`}
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[9px] uppercase tracking-[1px] text-slate-500">
                      Enter Promo Code
                    </label>
                    <input
                      type="text"
                      placeholder=""
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/50 uppercase"
                    />
                  </div>
                  <button
                    onClick={handleApplyCoupon}
                    disabled={applyingCoupon}
                    className="w-full py-3.5 bg-[#b8ff57] hover:bg-[#d4ff8a] text-black font-mono text-[9px] uppercase tracking-[1.5px] font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-[#b8ff57]/10 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {applyingCoupon && <Loader2 className="animate-spin text-black" size={12} />}
                    {applyingCoupon ? "Applying Coupon..." : "Apply Coupon"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
