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

  const refresh = useCallback(() => {
    if (!id) return;
    api.proposal(id).then(setProposal);
    api.ensurePlayer(player.id, player.handle).then(setPortfolio);
  }, [id, player]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Default the accordion to the first (shortest) horizon once loaded.
  useEffect(() => {
    if (proposal && expandedId === null && proposal.markets.length) {
      setExpandedId(proposal.markets[0].id);
    }
  }, [proposal, expandedId]);

  if (!proposal) return <div className="text-muted">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Link to="/signals" className="font-mono text-[12px] text-muted flex items-center gap-1 mb-3">
            <Icon name="arrow_back" size={14} /> signals
          </Link>
          <div className="flex flex-wrap items-center gap-2">
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

          <Link
            to={`/proposals/${proposal.id}`}
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[12px] text-ink hover:underline"
          >
            <Icon name="description" size={14} /> view proposal →
          </Link>
        </div>

        <SignalQR id={proposal.id} />
      </div>

      {/* The two signals, side by side. */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* LEFT — predicted wellbeing (futarchy-style play-money market) */}
        <Card className="p-5">
          <div className="flex items-center gap-1.5">
            <Eyebrow>predicted wellbeing</Eyebrow>
            <InfoTip text="Prices are LMSR-implied probabilities." />
          </div>
          <p className="mt-1 mb-4 text-[13px] text-muted">
            Forecasts whether the group's <strong className="text-ink font-semibold">wellbeing index</strong>{" "}
            will be higher <em>under this proposal</em> than the status quo, at each horizon.
          </p>
          <div className="space-y-2">
            {proposal.markets.map((m) =>
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

        {/* RIGHT — current sentiment (aggregate pulse) + sentiment feeds */}
        <div className="space-y-5">
          <Card className="p-5">
            <Eyebrow>current sentiment</Eyebrow>
            <p className="mt-1 mb-4 text-[13px] text-muted">
              How the group feels about this proposal{" "}
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
