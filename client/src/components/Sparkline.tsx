import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

/** Tiny implied-probability history line for a market. */
export function Sparkline({ history }: { history: { t: number; yes: number }[] }) {
  const data = history.map((h, i) => ({ i, yes: h.yes * 100 }));
  return (
    <ResponsiveContainer width="100%" height={44}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <YAxis domain={[0, 100]} hide />
        <Line
          type="monotone"
          dataKey="yes"
          stroke="#5a2dbf"
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
