import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IndexPoint, Threshold } from "../lib/api";

const INK = "#161616";
const PURPLE = "#5a2dbf";
const PURPLE_LIGHT = "#f0eeff";
const GRID = "#e8e8e8";

/** The group's aggregate wellbeing index over ~2 years. Aggregate-only data. */
export function WellbeingChart({
  series,
  threshold,
}: {
  series: IndexPoint[];
  threshold: Threshold;
}) {
  const key = threshold === "verified" ? "indexVerified" : "indexNone";
  const data = series.map((p) => ({
    date: p.date,
    value: p[key],
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="wellbeing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PURPLE} stopOpacity={0.22} />
            <stop offset="100%" stopColor={PURPLE_LIGHT} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fontFamily: "IBM Plex Mono", fill: "#8d8d8d" }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={48}
          tickFormatter={(d: string) => d.slice(0, 7)}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fontFamily: "IBM Plex Mono", fill: "#8d8d8d" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e8e8e8",
            fontFamily: "Inter",
            fontSize: 13,
            boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
          }}
          labelStyle={{ fontFamily: "IBM Plex Mono", fontSize: 11, color: "#8d8d8d" }}
          formatter={(v: number) => [v.toFixed(1), "index"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={PURPLE}
          strokeWidth={2}
          fill="url(#wellbeing)"
          activeDot={{ r: 4, fill: INK }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
