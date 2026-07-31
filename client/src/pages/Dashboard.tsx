import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type GroupSummary,
  type IndexResponse,
  type ProposalSummary,
  type Threshold,
} from "../lib/api";
import { WellbeingChart } from "../components/WellbeingChart";
import { Card, Eyebrow, Icon, InfoTip, Pill, SourceBadge } from "../components/ui";
import { pct, signed } from "../lib/util";

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 font-heading text-[34px] font-semibold leading-none">{value}</div>
      {sub && <div className="mt-2">{sub}</div>}
    </Card>
  );
}

export function Dashboard() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [threshold, setThreshold] = useState<Threshold>("none");
  const [index, setIndex] = useState<IndexResponse | null>(null);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);

  useEffect(() => {
    api.groups().then((g) => {
      setGroups(g);
      if (g.length) setGroupId(g[0].id);
    });
  }, []);

  useEffect(() => {
    if (!groupId) return;
    api.index(groupId, threshold).then(setIndex);
    api.proposals(groupId).then(setProposals);
  }, [groupId, threshold]);

  const group = groups.find((g) => g.id === groupId);
  const openCount = proposals.filter((p) => p.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <Eyebrow>group overview</Eyebrow>
            <InfoTip text="A group's wellbeing index over time, with its current index, 30-day trend, and open signals. The selector holds the organizations you belong to, plus Public for signals not owned by an organization." />
          </div>
          <h1 className="mt-1 font-heading text-[32px] font-semibold">{group?.name ?? "…"}</h1>
          <p className="mt-1 max-w-2xl text-muted">{group?.description}</p>
        </div>
        {groups.length > 1 && (
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-xs bg-surface px-3 h-11 font-mono text-[13px] border"
            style={{ borderColor: "var(--color-border-hairline)" }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="current index"
          value={
            threshold === "verified"
              ? String(group?.currentIndexVerified ?? "—")
              : String(group?.currentIndexNone ?? "—")
          }
          sub={
            group ? (
              <span className="font-mono text-[12px] text-muted">
                {group.totalResponses.toLocaleString()} responses · {Math.round(group.verifiedShare * 100)}% verified
              </span>
            ) : null
          }
        />
        <Tile
          label="30-day trend"
          value={signed(group?.trend30d ?? 0)}
          sub={
            group ? (
              <Pill tone={group.trend30d >= 0 ? "green" : "magenta"}>
                {group.trend30d >= 0 ? "improving" : "declining"}
              </Pill>
            ) : null
          }
        />
        <Tile
          label="open proposals"
          value={String(openCount)}
          sub={<Pill tone="grey">awaiting signal</Pill>}
        />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Eyebrow>wellbeing index</Eyebrow>
            <InfoTip text="An anonymous score of the group's wellbeing from 0 to 100, aggregated from open sentiment contributions. Proposals are judged against it by two signals: a forecast market and current sentiment." />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-quiet">trust threshold</span>
            <div className="segmented">
              {(["none", "verified"] as Threshold[]).map((t) => (
                <button
                  key={t}
                  className="seg"
                  data-active={threshold === t}
                  onClick={() => setThreshold(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3">
          {index && <WellbeingChart series={index.series} threshold={threshold} />}
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between">
          <Eyebrow>open signals</Eyebrow>
          <Link to="/signals" className="font-mono text-[12px] text-ink flex items-center gap-1">
            view all <Icon name="arrow_forward" size={14} />
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {proposals.slice(0, 4).map((p) => (
            <Link key={p.id} to={`/signals/${p.id}`}>
              <Card className="p-4 hover:shadow-lg transition-shadow h-full">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={p.status === "open" ? "green" : "grey"}>{p.status}</Pill>
                  <SourceBadge source={p.source} />
                  {p.owner && (
                    <span className="font-mono text-[11px] text-quiet">owned by {p.owner}</span>
                  )}
                </div>
                <h3 className="mt-2 font-heading text-[17px] font-semibold">{p.title}</h3>
                <div className="mt-2 font-mono text-[12px] text-muted">
                  market {pct(p.marketLean)} · sentiment {pct(p.sentimentPositive)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
