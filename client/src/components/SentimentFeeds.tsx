import { Eyebrow, InfoTip } from "./ui";

/**
 * "Sentiment feeds" — the open protocol's contributing clients as a bubble
 * ecosystem. moood is the dominant reference client (purple / our-side bubble);
 * competing clients are neutral satellites. Bubble AREA is proportional to each
 * feed's share of contributions. Illustrative mock mix.
 */

interface Feed {
  name: string; // short label shown inside the bubble
  full: string; // full name (tooltip)
  share: number;
  angle?: number; // satellite placement, degrees (0 = right, clockwise)
}

const MOOOD: Feed = { name: "moood", full: "moood app", share: 0.85 };
const SATELLITES: Feed[] = [
  { name: "Comp X", full: "Competitor X", share: 0.09, angle: -45 },
  { name: "Comp B", full: "Competitor B", share: 0.06, angle: 160 },
];

const NEUTRALS = ["#e8e4df", "#eef0f2"];

// Bubble radius from share, area-proportional (area ∝ share).
const K = 103;
const radius = (share: number) => K * Math.sqrt(share);

function Bubble({
  x,
  y,
  r,
  name,
  full,
  share,
  primary,
  color,
}: {
  x: number;
  y: number;
  r: number;
  name: string;
  full: string;
  share: number;
  primary?: boolean;
  color?: string;
}) {
  return (
    <div
      className="absolute rounded-full flex flex-col items-center justify-center text-center overflow-hidden"
      title={`${full} · ${Math.round(share * 100)}% of contributions`}
      style={{
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        background: primary ? "var(--color-emphasis-bg-deep)" : color,
        color: primary ? "var(--color-emphasis-text)" : "var(--color-text-strong)",
        border: primary ? "1px solid #d3c2ff" : "1px solid rgba(0,0,0,0.04)",
        boxShadow: primary ? "0 8px 30px rgba(61,31,153,0.12)" : "0 2px 6px rgba(0,0,0,0.05)",
      }}
    >
      <span
        className={primary ? "lowercase" : "font-mono font-semibold"}
        style={{
          fontSize: primary ? 34 : Math.max(9, r / 3.2),
          lineHeight: 1.05,
          ...(primary ? { fontFamily: "'Magical Night', Geist, sans-serif" } : {}),
        }}
      >
        {name}
      </span>
      <span
        className="font-mono"
        style={{ fontSize: primary ? 14 : Math.max(8, r / 4.5), opacity: 0.7 }}
      >
        {Math.round(share * 100)}%
      </span>
    </div>
  );
}

export function SentimentFeeds() {
  const W = 320;
  const H = 310;
  const cx = 160;
  const cy = 155;
  const moodR = radius(MOOOD.share);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Eyebrow>sentiment feeds</Eyebrow>
        <InfoTip text="Any app can feed sentiment." />
      </div>
      <p className="mt-1 mb-3 text-[13px] text-muted">The open protocol's contributing clients.</p>
      <div className="relative mx-auto" style={{ width: W, height: H, maxWidth: "100%" }}>
        <Bubble x={cx} y={cy} r={moodR} name={MOOOD.name} full={MOOOD.full} share={MOOOD.share} primary />
        {SATELLITES.map((f) => {
          const r = radius(f.share);
          const angle = ((f.angle ?? 0) * Math.PI) / 180;
          const dist = moodR + r + 8;
          return (
            <Bubble
              key={f.name}
              x={cx + dist * Math.cos(angle)}
              y={cy + dist * Math.sin(angle)}
              r={r}
              name={f.name}
              full={f.full}
              share={f.share}
              color={NEUTRALS[SATELLITES.indexOf(f) % NEUTRALS.length]}
            />
          );
        })}
      </div>
      <p className="mt-1 font-mono text-[10px] text-quiet">
        // illustrative feed mix · sized by share of contributions
      </p>
    </div>
  );
}
