"use client";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface Props {
  data: { v: number }[];
  stroke: string;
  height?: number;
}

export default function Sparkline({ data, stroke }: Props) {
  return (
    <div className="h-6 w-full opacity-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} fill="transparent" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
