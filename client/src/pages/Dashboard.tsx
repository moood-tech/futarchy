import { type ReactNode, useEffect, useRef, useState } from "react";
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
import { cx, money, pct, signed } from "../lib/util";

/** Group name + caret that opens a hidden dropdown of groups. */
function GroupPicker({
  groups,
  groupId,
  onPick,
}: {
  groups: GroupSummary[];
  groupId: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = groups.find((g) => g.id === groupId);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const canPick = groups.length > 1;

  return (
    <div ref={ref} className="relative mt-1 inline-block">
      <button
        type="button"
        disabled={!canPick}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 -ml-2.5 transition-colors disabled:cursor-default"
        style={{ background: open ? "var(--color-surface-mid)" : "transparent" }}
        onMouseEnter={(e) => {
          if (canPick) e.currentTarget.style.background = "var(--color-surface-mid)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <span className="font-heading text-[24px] font-semibold leading-tight">
          {current?.name ?? "…"}
        </span>
        {canPick && <Icon name="expand_more" size={20} className="text-muted" />}
      </button>

      {open && canPick && (
        <div
          className="absolute z-40 mt-1 min-w-[220px] rounded-lg p-1"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-hairline)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
          }}
        >
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                onPick(g.id);
                setOpen(false);
              }}
              className={cx(
                "w-full flex items-center justify-between rounded-xs px-3 h-9 text-left font-body text-[14px] transition-colors",
                g.id === groupId ? "bg-cream" : "hover:bg-cream",
              )}
            >
              <span className="truncate">{g.name}</span>
              {g.id === groupId && <Icon name="check" size={16} className="text-muted shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  hint,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5">
        <Eyebrow>{label}</Eyebrow>
        {hint && <InfoTip text={hint} />}
      </div>
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
    <div className="mx-[calc(50%-50vw)] px-8">
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
        {/* LEFT — side dashboard */}
        <aside className="space-y-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Eyebrow>collective</Eyebrow>
              {group?.description && <InfoTip text={group.description} />}
            </div>
            <GroupPicker groups={groups} groupId={groupId} onPick={setGroupId} />
          </div>

          <Tile
            label="current index"
            hint="A collective's wellbeing index over time, with its current index, 30-day trend, and open signals. The selector holds the collectives you belong to, plus Public for signals not owned by a collective."
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
            label="open motions"
            value={String(openCount)}
            sub={<Pill tone="grey">awaiting signal</Pill>}
          />
          <Tile
            label="value locked (TVL)"
            value={group ? money(group.tvl) : "—"}
            sub={
              group ? (
                <Pill tone={group.tvlYoY >= 0 ? "green" : "magenta"}>
                  {signed(group.tvlYoY)}% YoY
                </Pill>
              ) : null
            }
          />
        </aside>

        {/* RIGHT — chart + open signals */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <Eyebrow>wellbeing index</Eyebrow>
                <InfoTip text="An anonymous score of the collective's wellbeing from 0 to 100, aggregated from open sentiment contributions. Motions are judged against it by two signals: a forecast market and current sentiment." />
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
                  <Card
                    className="p-4 hover:shadow-lg transition-shadow h-full"
                    style={p.naked ? { background: "var(--color-surface-soft)" } : undefined}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {p.naked && (
                        <span className="inline-flex" style={{ color: "var(--color-text-quiet)" }}><Icon name="star" size={15} className="is-filled" /></span>
                      )}
                      <Pill tone={p.status === "open" ? "green" : "grey"}>{p.status}</Pill>
                      <SourceBadge source={p.source} />
                      {p.owner && <Pill tone="grey">owned by {p.owner}</Pill>}
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading text-[17px] font-semibold">{p.title}</h3>
                      {p.naked && <Pill tone="red">Baseline Signal</Pill>}
                    </div>
                    <div className="mt-2 font-mono text-[12px] text-muted">
                      {p.tradingEnabled ? `market ${pct(p.marketLean)} · ` : ""}sentiment{" "}
                      {pct(p.sentimentPositive)}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
