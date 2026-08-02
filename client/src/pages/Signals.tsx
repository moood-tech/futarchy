import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type GroupSummary, type ProposalSummary } from "../lib/api";
import { Card, Eyebrow, Icon, InfoTip, Pill, SearchInput, SourceBadge, SplitBar } from "../components/ui";
import { cx, pct } from "../lib/util";

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

function GroupItem({
  name,
  count,
  active,
  onClick,
}: {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full flex items-center justify-between rounded-xs px-3 h-9 font-body text-[14px] transition-colors",
        active ? "bg-ink text-white" : "text-ink hover:bg-cream",
      )}
    >
      <span className="truncate">{name}</span>
      <span className={cx("font-mono text-[11px]", active ? "text-white/70" : "text-quiet")}>
        {count}
      </span>
    </button>
  );
}

export function Signals() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [groupQuery, setGroupQuery] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.groups().then(setGroups);
    api.proposals().then(setProposals);
  }, []);

  // Signals are open proposals (drafts are not signals yet).
  const signals = proposals.filter((p) => p.status !== "draft");
  const countFor = (gid: string) => signals.filter((s) => s.groupId === gid).length;
  const groupName = (gid: string) => groups.find((g) => g.id === gid)?.name;

  const visibleGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupQuery.trim().toLowerCase()),
  );

  const list = signals
    .filter((p) => groupFilter === "all" || p.groupId === groupFilter)
    .filter((p) => {
      const q = query.trim().toLowerCase();
      return !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    });

  return (
    <div className="mx-[calc(50%-50vw)] px-8">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left — group list + search */}
        <aside>
          <Eyebrow>collectives</Eyebrow>
          <div className="mt-3">
            <SearchInput value={groupQuery} onChange={setGroupQuery} placeholder="Search collectives" />
          </div>
          <div className="mt-3 space-y-1">
            <GroupItem
              name="All collectives"
              count={signals.length}
              active={groupFilter === "all"}
              onClick={() => setGroupFilter("all")}
            />
            {visibleGroups.map((g) => (
              <GroupItem
                key={g.id}
                name={g.name}
                count={countFor(g.id)}
                active={groupFilter === g.id}
                onClick={() => setGroupFilter(g.id)}
              />
            ))}
          </div>
        </aside>

        {/* Main — signals */}
        <div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Eyebrow>signals</Eyebrow>
              <InfoTip text="Signals are the feedback on a motion: current sentiment and a forecast market. Anyone can propose a motion, and anyone can contribute anonymous sentiment through the open API. Advisory by default; a signal can also be set to execute its outcome automatically." />
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Search" className="w-56" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {list.length === 0 && (
              <Card className="p-5 text-[13px] text-muted">No signals match.</Card>
            )}
            {list.map((p) => (
              <Link key={p.id} to={`/signals/${p.id}`} title={`description: ${p.description}`}>
                <Card
                  className="p-5 h-full hover:shadow-lg transition-shadow"
                  style={p.naked ? { background: "var(--color-surface-soft)" } : undefined}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {p.naked && (
                      <span className="inline-flex" style={{ color: "var(--color-text-quiet)" }}><Icon name="star" size={16} className="is-filled" /></span>
                    )}
                    <Pill tone={p.status === "open" ? "green" : "grey"}>{p.status}</Pill>
                    <SourceBadge source={p.source} />
                    {groupName(p.groupId) && (
                      <Pill tone={groupName(p.groupId) === "Public" ? "yellow" : "grey"}>
                        {groupName(p.groupId)}
                      </Pill>
                    )}
                    {p.owner && <Pill tone="grey">owned by {p.owner}</Pill>}
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading text-[18px] font-semibold leading-snug">
                      {p.title}
                    </h3>
                    {p.naked && <Pill tone="red">Baseline Signal</Pill>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    {p.tradingEnabled ? (
                      <SignalRow label="predicted (1y)" value={p.marketLean} hint="P(wellbeing up)" />
                    ) : (
                      <div className="opacity-40">
                        <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                          <span>predicted (1y)</span>
                          <span>00%</span>
                        </div>
                        <div className="mt-1">
                          <SplitBar left={0} leftColor="var(--color-text-quiet)" rightColor="var(--color-brand-hairline)" />
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-quiet">P(wellbeing up)</div>
                      </div>
                    )}
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
      </div>
    </div>
  );
}
