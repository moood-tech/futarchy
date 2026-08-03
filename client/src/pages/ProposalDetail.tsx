import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api, type Portfolio, type ProposalDetail as Detail } from "../lib/api";
import { MarketCard } from "../components/MarketCard";
import { SentimentFeeds } from "../components/SentimentFeeds";
import { Card, Eyebrow, Icon, InfoTip, Pill, SourceBadge } from "../components/ui";
import { getPlayer, pct, pct1 } from "../lib/util";

const marketLabel = (years: number) => `${years} year${years > 1 ? "s" : ""}`;

/**
 * Current-sentiment readout. Responses are collected through the moood app (or
 * any partner client), never here — the dashboard only shows the AGGREGATE
 * count. No individual response is ever stored (see PRIVACY.md).
 */
function SentimentPulse({ proposal }: { proposal: Detail }) {
  const total = proposal.pulse.positive + proposal.pulse.negative;
  const posShare = total > 0 ? proposal.pulse.positive / total : 0.5;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div className="font-heading text-[42px] font-semibold leading-none">{pct(posShare)}</div>
        <div className="font-mono text-[11px] text-muted text-right">
          {total.toLocaleString()} anonymous
          <br />
          responses
        </div>
      </div>

      <div className="h-3 w-full rounded-pill overflow-hidden flex" style={{ background: "var(--color-magenta-soft)" }}>
        <div style={{ width: `${Math.round(posShare * 100)}%`, background: "var(--color-status-success)" }} />
        <div style={{ flex: 1, background: "var(--color-magenta-60)", opacity: 0.85 }} />
      </div>
      <div className="flex justify-between font-mono text-[11px]">
        <span style={{ color: "var(--color-status-success)" }}>
          ▲ {proposal.pulse.positive} positive
        </span>
        <span style={{ color: "var(--color-magenta-70)" }}>
          {proposal.pulse.negative} negative ▼
        </span>
      </div>

      <div
        className="flex items-center gap-2 rounded-xs px-3 py-2 font-mono text-[11px]"
        style={{ background: "var(--color-surface-cream)", color: "var(--color-text-muted)" }}
      >
        <Icon name="qr_code_2" size={15} />
        <span>Responses are collected through the moood app.</span>
      </div>
    </div>
  );
}

/**
 * Deep-links the signal into the moood app. Scanning it opens the signal so a
 * person can contribute sentiment there, keeping responses off this dashboard.
 */
function SignalQR({ id }: { id: string }) {
  const url = `https://app.moood.tech/s/${id}`;
  return (
    <div
      className="shrink-0 hidden sm:flex flex-col items-center gap-2 rounded-lg p-3"
      style={{ background: "var(--color-surface-cream)" }}
    >
      <div className="rounded-xs bg-white p-2">
        <QRCodeSVG value={url} size={88} bgColor="#ffffff" fgColor="#161616" level="M" />
      </div>
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-ink text-center">
        Respond in moood
      </div>
    </div>
  );
}

export function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Detail | null>(null);
  const [player] = useState(getPlayer);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  // Accordion: exactly one horizon's market card is open at a time.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Which of the two markets is shown: the collective's own index (internal) or
  // the wider public's (external). See the externality note in How It Works.
  const [marketTab, setMarketTab] = useState<"internal" | "external">("internal");

  const refresh = useCallback(() => {
    if (!id) return;
    api.proposal(id).then(setProposal);
    api.ensurePlayer(player.id, player.handle).then(setPortfolio);
  }, [id, player]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Default the accordion to the first (shortest) horizon of the selected
  // market, and re-open it when switching between internal and external.
  useEffect(() => {
    if (!proposal) return;
    const visible = proposal.markets.filter((m) => m.scope === marketTab);
    if (visible.length && !visible.some((m) => m.id === expandedId)) {
      setExpandedId(visible[0].id);
    }
  }, [proposal, marketTab, expandedId]);

  if (!proposal) return <div className="text-muted">Loading…</div>;

  const visibleMarkets = proposal.markets.filter((m) => m.scope === marketTab);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Link to="/signals" className="font-mono text-[12px] text-muted flex items-center gap-1 mb-3">
            <Icon name="arrow_back" size={14} /> signals
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {proposal.naked && (
              <span className="inline-flex" style={{ color: "var(--color-text-quiet)" }}><Icon name="star" size={16} className="is-filled" /></span>
            )}
            <Pill tone={proposal.status === "open" ? "green" : "grey"}>{proposal.status}</Pill>
            <SourceBadge source={proposal.source} />
            {proposal.owner && (
              <span className="font-mono text-[11px] text-quiet">owned by: {proposal.owner}</span>
            )}
          </div>
          <h1 className="mt-2 font-heading text-[30px] font-semibold leading-tight max-w-3xl">
            {proposal.title}
          </h1>
          <p className="mt-2 max-w-3xl text-muted">{proposal.description}</p>

          {!proposal.naked && (
            <Link
              to={`/motions/${proposal.id}`}
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[12px] text-ink hover:underline"
            >
              <Icon name="description" size={14} /> view motion →
            </Link>
          )}
        </div>

        <SignalQR id={proposal.id} />
      </div>

      {/* Forecast market (only when trading is enabled) + current sentiment. */}
      <div className={proposal.tradingEnabled ? "grid gap-5 lg:grid-cols-2" : "grid gap-5"}>
        {/* LEFT — predicted wellbeing (futarchy-style forecast market) */}
        {proposal.tradingEnabled && (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Eyebrow>markets</Eyebrow>
              <InfoTip text="Prices are LMSR-implied probabilities." />
            </div>
            <div className="segmented">
              {(["internal", "external"] as const).map((t) => (
                <button key={t} className="seg" data-active={marketTab === t} onClick={() => setMarketTab(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 mb-4 text-[13px] text-muted">
            {marketTab === "internal" ? (
              <>
                Forecasts whether <strong className="text-ink font-semibold">this collective's</strong>{" "}
                wellbeing index will be higher under this motion than the status quo, at each horizon.
              </>
            ) : (
              <>
                Forecasts the motion's effect on the{" "}
                <strong className="text-ink font-semibold">wider public's</strong> wellbeing index, at each
                horizon.
              </>
            )}
          </p>
          <div className="space-y-2">
            {visibleMarkets.map((m) =>
              m.id === expandedId ? (
                <MarketCard
                  key={m.id}
                  market={m}
                  player={player}
                  balance={portfolio?.balance ?? 0}
                  onUpdate={refresh}
                />
              ) : (
                <button
                  key={m.id}
                  onClick={() => setExpandedId(m.id)}
                  className="w-full flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:brightness-[0.97]"
                  style={{ background: "var(--color-emphasis-bg-light)", border: "1px solid #e5defc" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em]"
                      style={{ color: "var(--color-emphasis-text)" }}
                    >
                      {marketLabel(m.years)}
                    </span>
                    <span
                      className="font-mono text-[10px] font-semibold rounded-pill px-2 py-0.5"
                      style={{ background: "var(--color-emphasis-bg-deep)", color: "var(--color-emphasis-text)" }}
                    >
                      ×{m.payoutMultiplier.toFixed(2)} payout
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-heading text-[18px] font-semibold leading-none"
                      style={{ color: "var(--color-emphasis-text)" }}
                    >
                      {pct1(m.impliedYes)}
                    </span>
                    <Icon name="expand_more" size={18} className="text-muted" />
                  </div>
                </button>
              ),
            )}
          </div>
        </Card>
        )}

        {/* RIGHT — current sentiment (aggregate pulse) + sentiment feeds */}
        <div className="space-y-5">
          <Card className="p-5">
            <Eyebrow>current sentiment</Eyebrow>
            <p className="mt-1 mb-4 text-[13px] text-muted">
              How the collective feels about this motion{" "}
              <strong className="text-ink font-semibold">right now</strong>.
            </p>
            <SentimentPulse proposal={proposal} />
          </Card>

          <Card className="p-5">
            <SentimentFeeds />
          </Card>
        </div>
      </div>

    </div>
  );
}
