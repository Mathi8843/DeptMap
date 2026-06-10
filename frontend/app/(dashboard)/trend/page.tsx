"use client";
import React from "react";
import { mockHealthHistory } from "@/lib/mock-data";
import { useApp } from "@/lib/AppContext";
import { Lock, TrendingUp, TrendingDown, HelpCircle, ShieldCheck } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const C = {
  border: "var(--border-subtle)", 
  text3: "var(--text-muted)", 
  rose: "#f43f5e",  // rose-500
  emerald: "#10b981", // emerald-500
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-panel/95 border border-border-glow rounded-xl p-3.5 shadow-2xl backdrop-blur-md font-mono text-[11px] space-y-1 text-text-sub">
        <div className="text-text-muted font-bold mb-1">{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrendPage() {
  const { overallScore, issues } = useApp();

  const currentScore = overallScore;
  const firstScore = mockHealthHistory[0].score;
  const drop = firstScore - currentScore;

  const openIssues = issues.filter(i => i.status === "open").length;
  const fixedIssues = issues.filter(i => i.status === "fixed").length;

  const stats = [
    { label: "Current Score", value: currentScore, color: currentScore >= 70 ? "text-emerald-500 dark:text-emerald-400" : currentScore >= 40 ? "text-amber-500 dark:text-amber-400" : "text-rose-500", delta: `Drop of ${drop}pts since April` },
    { label: "Trend Status", value: drop > 0 ? "Down" : "Up", color: drop > 0 ? "text-rose-500" : "text-emerald-500 dark:text-emerald-400", delta: "Last 9 weeks scan history" },
    { label: "Active Exposures", value: openIssues, color: "text-amber-500 dark:text-amber-400", delta: "Unresolved alerts" },
    { label: "Fixed via PRs", value: fixedIssues, color: "text-emerald-500 dark:text-emerald-400", delta: "Total resolved issues" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-3xl text-text-main tracking-wide">
          Code Health Trend
        </h1>
        <p className="text-sm text-text-sub">
          Historical analysis of security health and technical debt accumulation
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-5 space-y-1 border border-border-subtle">
            <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-text-muted font-bold">{s.label}</div>
            <div className={`font-display font-extrabold text-3xl tracking-wide ${s.color}`}>
              {s.value}
            </div>
            <div className="text-[10px] text-text-muted">{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Chart grid layouts - scaled height */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Area score chart */}
        <div className="glass-panel border border-border-subtle rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-text-main">Security Score Timeline</h3>
            <span className={`flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[1px] ${drop > 0 ? "text-rose-500" : "text-emerald-500"}`}>
              {drop > 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
              {drop > 0 ? `-${drop}pts` : `+${Math.abs(drop)}pts`}
            </span>
          </div>
          
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockHealthHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="glowScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.rose} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.rose} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: C.text3, fontSize: 11, fontFamily: "JetBrains Mono" }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fill: C.text3, fontSize: 11, fontFamily: "JetBrains Mono" }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke={C.rose} 
                  strokeWidth={2.5} 
                  fill="url(#glowScore)" 
                  dot={{ fill: C.rose, r: 4 }} 
                  activeDot={{ r: 6 }} 
                  name="Health Score" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-text-sub leading-relaxed font-sans">
            Your workspace score dropped <strong className="text-rose-500 font-bold">{drop} points</strong>. Active deploy commits added new dependencies without security scanning parameters.
          </p>
        </div>

        {/* Bar Chart: Introduced vs Fixed */}
        <div className="glass-panel border border-border-subtle rounded-2xl p-6 space-y-5">
          <h3 className="font-display font-bold text-sm text-text-main">Vulnerability Lifecycle</h3>
          
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockHealthHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: C.text3, fontSize: 11, fontFamily: "JetBrains Mono" }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  tick={{ fill: C.text3, fontSize: 11, fontFamily: "JetBrains Mono" }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono", color: C.text3, paddingTop: 12 }} 
                />
                <Bar 
                  dataKey="introduced" 
                  name="Introduced" 
                  fill={C.rose} 
                  fillOpacity={0.7} 
                  radius={[3, 3, 0, 0]} 
                />
                <Bar 
                  dataKey="fixed" 
                  name="Remediated" 
                  fill={C.emerald} 
                  fillOpacity={0.8} 
                  radius={[3, 3, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-text-sub leading-relaxed font-sans">
            More issues were introduced than fixed per deploy cycle. This creates a compounding <strong className="text-text-main font-bold">technical debt deficit</strong>.
          </p>
        </div>
      </div>

      {/* Mitigation Action card */}
      <div className="glass-card rounded-2xl p-6 flex gap-4.5 items-start border border-border-subtle bg-bg-deep/10">
        <ShieldCheck size={20} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <h4 className="text-xs font-bold text-text-main font-mono uppercase tracking-[1px]">Debt Deficit Remediation Plan</h4>
          <p className="text-xs text-text-sub leading-relaxed">
            Close 3+ vulnerabilities weekly to clear debt accrual before the code health index declines below 50. Use DebtMap's PR automated pipeline to fix vulnerabilities quickly.
          </p>
        </div>
      </div>
    </div>
  );
}
