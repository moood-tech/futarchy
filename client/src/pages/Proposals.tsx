import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type GroupSummary, type ProposalSummary } from "../lib/api";
import { Card, Eyebrow, Icon, InfoTip, Modal, Pill, SearchInput } from "../components/ui";
import { cx } from "../lib/util";

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
      <span className={cx("font-mono text-[11px]", active ? "text-white/70" : "text-quiet")}>{count}</span>
    </button>
  );
}

export function Proposals() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [groupQuery, setGroupQuery] = useState("");
  const [query, setQuery] = useState("");
  const [syncModal, setSyncModal] = useState(false);
  const [syncPlatform, setSyncPlatform] = useState("Snapshot");
  const [syncSpace, setSyncSpace] = useState("");
  // Wireframe: permanent DAO sync connections (not wired up yet).
  const [syncs, setSyncs] = useState([
    { id: "sync_snapshot", platform: "Snapshot", space: "moood.eth" },
    { id: "sync_tally", platform: "Tally", space: "moood" },
  ]);
  const [refreshed, setRefreshed] = useState<string | null>(null);

  function addSync() {
    if (!syncSpace.trim()) return;
    setSyncs((s) => [...s, { id: `sync_${s.length + 1}`, platform: syncPlatform, space: syncSpace.trim() }]);
    setSyncSpace("");
  }

  function load() {
    api.proposals().then(setProposals);
  }

  useEffect(() => {
    api.groups().then(setGroups);
    load();
  }, []);

  const builtIn = proposals.filter((p) => p.source.kind === "builtin");
  const countFor = (gid: string) => builtIn.filter((p) => p.groupId === gid).length;
  const groupName = (gid: string) => groups.find((g) => g.id === gid)?.name;

  const visibleGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupQuery.trim().toLowerCase()),
  );

  const list = builtIn
    .filter((p) => groupFilter === "all" || p.groupId === groupFilter)
    .filter((p) => {
      const q = query.trim().toLowerCase();
      return !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    });

  // "Create proposal" opens a draft in the edit page (like a new pull request).
  async function createDraft() {
    // Default to the sidebar group if it has a repository, else the first org
    // that does (never the derived Global group).
    const selected = groups.find((g) => g.id === groupFilter);
    const gid =
      selected && selected.documents.length
        ? selected.id
        : groups.find((g) => g.documents.length)?.id;
    if (!gid) return;
    const created = await api.createProposal(gid, "Untitled proposal", "");
    navigate(`/proposals/${created.id}?new=1`);
  }

  return (
    <div className="mx-[calc(50%-50vw)] px-8">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left — group list + search */}
        <aside>
          <div className="flex items-center h-9">
            <Eyebrow>groups</Eyebrow>
          </div>
          <div className="mt-4">
            <SearchInput value={groupQuery} onChange={setGroupQuery} placeholder="Search groups" />
          </div>
          <div className="mt-3 space-y-1">
            <GroupItem
              name="All groups"
              count={builtIn.length}
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

        {/* Main — proposals list */}
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Eyebrow>proposals</Eyebrow>
              <InfoTip text="Built-in governance. Filter proposals by group on the left, search them, create a new one, or open a proposal to edit it with a git-style diff." />
            </div>
            <div className="flex items-center gap-2">
              <SearchInput value={query} onChange={setQuery} placeholder="Search" className="w-56" />
              <button className="btn btn-secondary btn-sm" onClick={() => setSyncModal(true)}>
                <Icon name="sync" size={16} /> Sync
              </button>
              <button className="btn btn-primary btn-sm" onClick={createDraft}>
                <Icon name="add" size={16} /> Create
              </button>
            </div>
          </div>

          <Card className="mt-4 p-0 overflow-hidden divide-y divide-hairline">
            {list.length === 0 && (
              <div className="p-5 text-[13px] text-muted">No proposals match.</div>
            )}
            {list.map((p) => (
              <Link
                key={p.id}
                to={`/proposals/${p.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-cream transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-heading text-[15px] font-semibold truncate">
                      {p.title}
                    </span>
                    <Pill tone={p.status === "open" ? "green" : p.status === "draft" ? "yellow" : "grey"}>
                      {p.status}
                    </Pill>
                    {p.isDoc && (p.additions > 0 || p.deletions > 0) && (
                      <span className="font-mono text-[11px] shrink-0">
                        <span style={{ color: "var(--color-status-success)" }}>+{p.additions}</span>{" "}
                        <span style={{ color: "var(--color-status-error)" }}>−{p.deletions}</span>
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-0.5 text-[13px] text-muted line-clamp-2">{p.description}</p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-3 pt-0.5">
                  {groupName(p.groupId) && <Pill tone="grey">{groupName(p.groupId)}</Pill>}
                  <Icon name="chevron_right" size={18} className="text-quiet" />
                </div>
              </Link>
            ))}
          </Card>
        </div>
      </div>

      {/* DAO sync connections — wireframe only, not wired up yet. */}
      <Modal open={syncModal} onClose={() => setSyncModal(false)} title="connected daos">
        <div className="space-y-4">
          <div>
            <div className="space-y-2">
              {syncs.length === 0 && (
                <div className="text-[13px] text-muted">No syncs configured yet.</div>
              )}
              {syncs.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-xs px-3 h-11"
                  style={{ border: "1px solid var(--color-border-hairline)" }}
                >
                  <Icon name="hub" size={16} className="text-muted" />
                  <span className="font-body text-[14px] font-semibold">{s.platform}</span>
                  <span className="font-mono text-[12px] text-muted truncate">{s.space}</span>
                  <button
                    onClick={() => setRefreshed(s.id)}
                    className="ml-auto font-mono text-[11px] text-ink flex items-center gap-1 hover:underline"
                  >
                    <Icon name="refresh" size={13} /> {refreshed === s.id ? "refreshed" : "refresh now"}
                  </button>
                  <button
                    onClick={() => setSyncs((list) => list.filter((x) => x.id !== s.id))}
                    className="text-quiet hover:text-ink"
                    title="Remove sync"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow>add a sync</Eyebrow>
            <div className="mt-2 flex items-center gap-2">
              <select
                value={syncPlatform}
                onChange={(e) => setSyncPlatform(e.target.value)}
                className="rounded-xs px-3 h-11 font-body text-[14px]"
              >
                {["Snapshot", "Tally", "Aragon", "DAOhaus"].map((pf) => (
                  <option key={pf} value={pf}>
                    {pf}
                  </option>
                ))}
              </select>
              <input
                value={syncSpace}
                onChange={(e) => setSyncSpace(e.target.value)}
                placeholder="space / workspace"
                className="flex-1 min-w-0 rounded-xs px-3 h-11 font-body text-[14px]"
              />
              <button className="btn btn-secondary btn-sm" disabled={!syncSpace.trim()} onClick={addSync}>
                <Icon name="add" size={16} /> Add
              </button>
            </div>
          </div>

          <div
            className="flex items-center gap-2 rounded-xs px-3 py-2 text-[12px]"
            style={{ background: "var(--color-status-warning-bg)", color: "var(--color-status-warning-glyph)" }}
          >
            <Icon name="construction" size={15} />
            <span>Wireframe. DAO connections are not wired up yet.</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
