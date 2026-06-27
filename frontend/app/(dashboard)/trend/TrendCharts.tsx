"use client";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

const Patterns = () => (
  <defs>
    <pattern id="hatchDiagonal" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#f43f5e" fillOpacity={0.2} />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#f43f5e" strokeWidth={2.5} strokeOpacity={0.85} />
    </pattern>
    <pattern id="hatchHorizontal" width="8" height="8" patternTransform="rotate(0)" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#10b981" fillOpacity={0.2} />
      <rect x="0" y="3" width="8" height="2" fill="#10b981" fillOpacity={0.85} />
    </pattern>
    <pattern id="dotGrid" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#f43f5e" fillOpacity={0.08} />
      <circle cx="4" cy="4" r="1.5" fill="#f43f5e" fillOpacity={0.6} />
    </pattern>
  </defs>
);

const C = {
  border: "var(--border-subtle)",
  text3: "var(--text-muted)",
  rose: "#f43f5e",
  emerald: "#10b981",
  indigo: "#6366f1",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-panel/95 border border-border-glow rounded-xl p-3.5 shadow-2xl backdrop-blur-md font-mono text-[11px] space-y-1.5 text-text-sub">
        <div className="text-text-muted font-bold mb-1">{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color }} className="flex items-center justify-between gap-4">
            <span className="text-text-sub">{p.name}:</span>
            <span className="font-bold">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const CustomLegend = () => {
  const items = [
    { name: "Introduced", fill: "rgba(244,63,94,0.12)", stroke: C.rose },
    { name: "Remediated", fill: "rgba(16,185,129,0.12)", stroke: C.emerald },
  ];
  return (
    <div className="flex justify-center gap-6 pt-4" style={{ fontFamily: "JetBrains Mono" }}>
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded border"
            style={{ 
              backgroundColor: item.fill, 
              borderColor: item.stroke,
              borderWidth: "1.5px"
            }}
          />
          <span className="text-[10px] text-text-sub uppercase tracking-[0.5px]">{item.name}</span>
        </div>
      ))}
    </div>
  );
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
                  <stop offset="5%" stopColor={C.indigo} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.indigo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Patterns />
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: C.text3, fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: C.text3, fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke={C.indigo}
                strokeWidth={2.5}
                fill="url(#glowScore)"
                dot={{ fill: C.indigo, r: 4, stroke: "transparent", strokeWidth: 0 }}
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
            <BarChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={4}>
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
                content={<CustomLegend />}
              />
              <Bar
                dataKey="introduced"
                name="Introduced"
                fill="rgba(244,63,94,0.12)"
                stroke={C.rose}
                strokeWidth={1.5}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="fixed"
                name="Remediated"
                fill="rgba(16,185,129,0.12)"
                stroke={C.emerald}
                strokeWidth={1.5}
                radius={[4, 4, 0, 0]}
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
