"use client";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

const C = {
  border: "var(--border-subtle)",
  text3: "var(--text-muted)",
  rose: "#f43f5e",
  emerald: "#10b981",
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

interface Props {
  trendData: any[];
  drop: number;
}

export default function TrendCharts({ trendData, drop }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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

      <div className="glass-panel border border-border-subtle rounded-2xl p-6 space-y-5">
        <h3 className="font-display font-bold text-sm text-text-main">Vulnerability Lifecycle</h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={3}>
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
  );
}
