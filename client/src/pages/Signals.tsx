import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ProposalSummary } from "../lib/api";
import { Card, InfoTip, Pill, SourceBadge, SplitBar } from "../components/ui";
import { pct } from "../lib/util";

function SignalRow({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[11px] text-muted">
        <span>{label}</span>
        <span className="text-ink font-semibold">{pct(value)}</span>
      </div>
      <div className="mt-1">
        <SplitBar
          left={value}
          leftColor="var(--color-emphasis-text-alt)"
          rightColor="var(--color-brand-hairline)"
        />
      </div>
      <div className="mt-1 font-mono text-[10px] text-quiet">{hint}</div>
    </div>
  );
}

export function Signals() {
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);

  useEffect(() => {
    api.proposals().then(setProposals);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5">
        <span className="eyebrow">signals</span>
        <InfoTip text="Signals are the readings attached to a proposal: a play-money forecast market and current sentiment. Anyone can propose, and anyone can contribute anonymous sentiment through the open API. Advisory by default; a signal can also be set to execute its outcome automatically." />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {proposals
          .filter((p) => p.status !== "draft")
          .map((p) => (
          <Link key={p.id} to={`/signals/${p.id}`}>
            <Card className="p-5 h-full hover:shadow-lg transition-shadow flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={p.status === "open" ? "green" : "grey"}>{p.status}</Pill>
                <SourceBadge source={p.source} />
                {p.owner && (
                  <span className="font-mono text-[11px] text-quiet">owned by {p.owner}</span>
                )}
              </div>
              <h3 className="mt-3 font-heading text-[19px] font-semibold leading-snug">
                {p.title}
              </h3>
              <p className="mt-1.5 text-[13px] text-muted line-clamp-3 flex-1">{p.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <SignalRow label="predicted (1y)" value={p.marketLean} hint="P(wellbeing up)" />
                <SignalRow
                  label="sentiment now"
                  value={p.sentimentPositive}
                  hint={`${p.pulse.positive + p.pulse.negative} responses`}
                />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
