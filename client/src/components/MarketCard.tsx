import { useEffect, useState } from "react";
import { api, type MarketView, type Side } from "../lib/api";
import { cx, money, pct1 } from "../lib/util";
import { Sparkline } from "./Sparkline";
import { Icon } from "./ui";

const SIDE_LABEL: Record<Side, string> = { yes: "positive", no: "negative" };

/** Per-scope market palette. Internal (the collective's own index) keeps the
 *  brand purple; external (the wider public) is a cool blue so the two markets
 *  read as two distinct objectives. Tweak the external values to reshade. */
export const MARKET_THEME: Record<
  "internal" | "external",
  { bgLight: string; bgDeep: string; text: string; border: string; line: string }
> = {
  internal: {
    bgLight: "var(--color-emphasis-bg-light)",
    bgDeep: "var(--color-emphasis-bg-deep)",
    text: "var(--color-emphasis-text)",
    border: "#e5defc",
    line: "#5a2dbf",
  },
  external: {
    bgLight: "#e9f3fc",
    bgDeep: "#d1e6f9",
    text: "#00539a",
    border: "#d3e6f7",
    line: "#1192e8",
  },
};

const HORIZON_LABEL: Record<string, string> = {
  "1y": "1 year",
  "2y": "2 years",
  "3y": "3 years",
  "5y": "5 years",
  "10y": "10 years",
  "20y": "20 years",
  "30y": "30 years",
};

export function MarketCard({
  market,
  player,
  balance,
  onUpdate,
}: {
  market: MarketView;
  player: { id: string; handle: string };
  balance: number;
  onUpdate: () => void;
}) {
  const [side, setSide] = useState<Side>("yes");
  const [shares, setShares] = useState(10);
  const [quote, setQuote] = useState<{ cost: number; impliedYesAfter: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!(shares > 0)) {
      setQuote(null);
      return;
    }
    let live = true;
    api
      .quote(market.id, side, shares)
      .then((q) => live && setQuote(q))
      .catch(() => live && setQuote(null));
    return () => {
      live = false;
    };
  }, [market.id, side, shares, market.impliedYes]);

  async function buy() {
    setBusy(true);
    setErr(null);
    try {
      await api.buy(market.id, side, shares, player.id, player.handle);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canAfford = quote ? quote.cost <= balance + 1e-9 : true;
  const t = MARKET_THEME[market.scope];

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: t.bgLight, border: `1px solid ${t.border}` }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: t.text }}>
          {HORIZON_LABEL[market.horizon]}
        </span>
        <span
          className="font-mono text-[10px] font-semibold rounded-pill px-2 py-0.5"
          style={{ background: t.bgDeep, color: t.text }}
          title={`payout multiplier: ${(market.baselineRate * 100).toFixed(0)}%/yr baseline compounded over ${market.years}y`}
        >
          ×{market.payoutMultiplier.toFixed(2)} payout
        </span>
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <div className="font-heading text-[30px] font-semibold leading-none" style={{ color: t.text }}>
            {pct1(market.impliedYes)}
          </div>
          <div className="font-mono text-[10px] text-muted mt-1">implied P(index up)</div>
        </div>
        <div className="w-28">
          <Sparkline history={market.history} stroke={t.line} />
        </div>
      </div>

      {/* Yes / No buy interface */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["yes", "no"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cx(
              "rounded-xs py-2 font-mono text-[13px] font-bold transition-colors",
              side === s ? "text-white" : "text-ink bg-surface",
            )}
            style={side === s ? { background: s === "yes" ? "var(--color-status-success)" : "var(--color-magenta-60)" } : { border: `1px solid ${t.border}` }}
          >
            {SIDE_LABEL[s].toUpperCase()} · {pct1(s === "yes" ? market.impliedYes : market.impliedNo)}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center rounded-xs bg-surface" style={{ border: `1px solid ${t.border}` }}>
          <button className="px-2.5 py-1.5 text-muted" onClick={() => setShares((n) => Math.max(1, n - 5))}>
            <Icon name="remove" size={16} />
          </button>
          <input
            value={shares}
            onChange={(e) => setShares(Math.max(1, Number(e.target.value) || 1))}
            className="w-12 text-center font-mono text-[13px] bg-transparent outline-none"
          />
          <button className="px-2.5 py-1.5 text-muted" onClick={() => setShares((n) => n + 5)}>
            <Icon name="add" size={16} />
          </button>
        </div>
        <span className="font-mono text-[10px] text-muted">tokens</span>
        <div className="ml-auto text-right">
          <div className="font-mono text-[13px] font-semibold text-ink">
            {quote ? money(quote.cost) : "—"}
          </div>
          <div className="font-mono text-[9px] text-quiet">
            → {quote ? pct1(quote.impliedYesAfter) : "—"} positive
          </div>
        </div>
      </div>

      <div
        className="mt-2 flex items-center justify-between rounded-xs px-2.5 py-1.5 font-mono text-[10px]"
        style={{ background: "var(--color-surface)", border: `1px solid ${t.border}` }}
      >
        <span style={{ color: "var(--color-status-success)" }}>
          win → {money(shares * market.payoutMultiplier)}
        </span>
        <span style={{ color: "var(--color-magenta-70)" }} title="your stake is lost if this side is wrong">
          lose → {quote ? money(quote.cost) : "—"}
        </span>
      </div>

      <button className="btn btn-primary btn-sm w-full mt-2" disabled={busy || !canAfford} onClick={buy}>
        {canAfford ? `Buy ${shares} ${SIDE_LABEL[side].toUpperCase()}` : "Insufficient balance"}
      </button>

      {err && <div className="mt-2 font-mono text-[11px]" style={{ color: "var(--color-status-error)" }}>{err}</div>}
    </div>
  );
}
