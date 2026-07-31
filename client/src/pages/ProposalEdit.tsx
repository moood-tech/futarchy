import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type DocChange, type GroupSummary, type ProposalDetail as Detail } from "../lib/api";
import { Card, Eyebrow, Icon, Modal, Pill, SourceBadge } from "../components/ui";
import { type DiffLine, lineDiff, toHunks } from "../lib/diff";

type RepoDoc = { id: string; name: string; path: string };
interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  docId?: string;
}

function buildTree(docs: RepoDoc[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };
  for (const d of docs) {
    const parts = d.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      if (!node.children.has(part)) node.children.set(part, { name: part, children: new Map() });
      node = node.children.get(part)!;
      if (i === parts.length - 1) node.docId = d.id;
    });
  }
  return root;
}

function TreeView({
  node,
  depth,
  onPick,
  busy,
}: {
  node: TreeNode;
  depth: number;
  onPick: (docId: string) => void;
  busy: boolean;
}) {
  return (
    <>
      {[...node.children.values()].map((child) =>
        child.docId ? (
          <button
            key={child.name}
            disabled={busy}
            onClick={() => onPick(child.docId!)}
            className="w-full flex items-center gap-2 py-1.5 rounded-xs hover:bg-cream text-left font-mono text-[13px]"
            style={{ paddingLeft: depth * 16 + 8, paddingRight: 8 }}
          >
            <Icon name="description" size={15} className="text-muted" /> {child.name}
          </button>
        ) : (
          <div key={child.name}>
            <div
              className="flex items-center gap-2 py-1.5 font-mono text-[13px] text-muted"
              style={{ paddingLeft: depth * 16 + 8 }}
            >
              <Icon name="folder" size={15} /> {child.name}
            </div>
            <TreeView node={child} depth={depth + 1} onPick={onPick} busy={busy} />
          </div>
        ),
      )}
    </>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const bg =
    line.type === "add"
      ? "var(--color-status-success-bg)"
      : line.type === "del"
        ? "var(--color-status-error-bg)"
        : "transparent";
  const fg =
    line.type === "add"
      ? "var(--color-status-success)"
      : line.type === "del"
        ? "var(--color-status-error)"
        : "var(--color-text-strong)";
  const sign = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
  return (
    <div className="px-4 whitespace-pre" style={{ background: bg, color: fg }}>
      {sign} {line.text}
    </div>
  );
}

function countStat(diff: DiffLine[]) {
  let add = 0;
  let del = 0;
  for (const d of diff) {
    if (d.type === "add") add++;
    else if (d.type === "del") del++;
  }
  return { add, del };
}

// ms epoch <-> <input type="datetime-local"> value (local time, minute precision)
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (s: string) => new Date(s).getTime();

/** Left column: a document's editor (no diff). */
function DocEditor({
  change,
  readOnly,
  onEdit,
  onRemove,
}: {
  change: DocChange;
  readOnly: boolean;
  onEdit: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--color-border-hairline)" }}
      >
        <div className="flex items-center gap-2 font-mono text-[12px] min-w-0">
          <Icon name="description" size={14} className="text-muted shrink-0" />
          <span className="font-semibold truncate">{change.documentName}</span>
        </div>
        {!readOnly && (
          <button onClick={onRemove} className="text-quiet hover:text-ink shrink-0" title="Remove document">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      <textarea
        value={change.proposedDoc}
        onChange={(e) => onEdit(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        rows={14}
        className="w-full px-4 py-2 font-mono text-[12.5px] leading-relaxed resize-y block"
        style={{
          borderRadius: 0,
          boxShadow: "none",
          background: readOnly ? "var(--color-surface-mid)" : "var(--color-surface)",
        }}
      />
    </Card>
  );
}

/** Right column: a document's git-style diff, one card per change. */
function DocDiff({ change }: { change: DocChange }) {
  const diff = useMemo(() => lineDiff(change.baseDoc, change.proposedDoc), [change]);
  const hunks = useMemo(() => toHunks(diff), [diff]);
  const s = useMemo(() => countStat(diff), [diff]);
  const file = `governance/${change.documentName}.md`;

  return (
    <Card className="p-0 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2 font-mono text-[11px] text-quiet"
        style={{ background: "var(--color-surface-mid)", borderBottom: "1px solid var(--color-border-hairline)" }}
      >
        <span className="truncate">{file}</span>
        <span className="shrink-0">
          <span style={{ color: "var(--color-status-success)" }}>+{s.add}</span>{" "}
          <span style={{ color: "var(--color-status-error)" }}>−{s.del}</span>
        </span>
      </div>
      {hunks.length === 0 ? (
        <div className="px-4 py-2 font-mono text-[11px] text-quiet">No changes to this document.</div>
      ) : (
        hunks.map((h, idx) => (
          <div key={idx}>
            <div className="px-4 py-1.5 font-mono text-[11px] text-quiet">{h.header}</div>
            <div className="font-mono text-[12px] leading-relaxed overflow-x-auto pb-1">
              {h.lines.map((line, i) => (
                <DiffRow key={i} line={line} />
              ))}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

export function ProposalEdit() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [proposal, setProposal] = useState<Detail | null>(null);
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [changes, setChanges] = useState<DocChange[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tab, setTab] = useState<"details" | "documents">("details");
  const [addModal, setAddModal] = useState(false);
  const [allGroups, setAllGroups] = useState<GroupSummary[]>([]);

  const load = useCallback(() => {
    if (!id) return;
    api.proposal(id).then((p) => {
      setProposal(p);
      setTitle(p.title);
      setRationale(p.description);
      setStart(toLocalInput(p.signalStart));
      setEnd(toLocalInput(p.signalEnd));
      setChanges(p.changes.map((c) => ({ ...c })));
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("new")) setEditingTitle(true);
  }, [searchParams]);

  useEffect(() => {
    api.groups().then(setAllGroups);
  }, []);

  const totalStat = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const c of changes) {
      const s = countStat(lineDiff(c.baseDoc, c.proposedDoc));
      add += s.add;
      del += s.del;
    }
    return { add, del };
  }, [changes]);

  function applyLoaded(p: Detail) {
    setProposal(p);
    setTitle(p.title);
    setRationale(p.description);
    setStart(toLocalInput(p.signalStart));
    setEnd(toLocalInput(p.signalEnd));
    setChanges(p.changes.map((c) => ({ ...c })));
  }

  const dirty =
    !!proposal &&
    (title !== proposal.title ||
      rationale !== proposal.description ||
      start !== toLocalInput(proposal.signalStart) ||
      end !== toLocalInput(proposal.signalEnd) ||
      changes.some((c) => {
        const orig = proposal.changes.find((o) => o.documentId === c.documentId);
        return !orig || orig.proposedDoc !== c.proposedDoc;
      }));

  async function commit() {
    if (!id || !title.trim()) return;
    setBusy(true);
    try {
      applyLoaded(
        await api.updateProposal(id, {
          title,
          description: rationale,
          signalStart: fromLocalInput(start),
          signalEnd: fromLocalInput(end),
          changes: changes.map((c) => ({ documentId: c.documentId, proposedDoc: c.proposedDoc })),
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  function revert() {
    if (!proposal) return;
    applyLoaded(proposal);
  }

  async function addDoc(documentId: string) {
    if (!id || !documentId) return;
    setBusy(true);
    try {
      applyLoaded(await api.addDocument(id, documentId));
      setTab("documents");
    } finally {
      setBusy(false);
      setAddModal(false);
    }
  }

  async function removeDoc(documentId: string) {
    if (!id) return;
    setBusy(true);
    try {
      applyLoaded(await api.removeDocument(id, documentId));
    } finally {
      setBusy(false);
    }
  }

  async function changeGroup(groupId: string) {
    if (!id) return;
    setBusy(true);
    try {
      applyLoaded(await api.updateProposal(id, { groupId }));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!id || !title.trim()) return;
    setBusy(true);
    try {
      applyLoaded(
        await api.updateProposal(id, {
          title,
          description: rationale,
          signalStart: fromLocalInput(start),
          signalEnd: fromLocalInput(end),
          changes: changes.map((c) => ({ documentId: c.documentId, proposedDoc: c.proposedDoc })),
          status: "open",
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!proposal) return <div className="text-muted">Loading…</div>;

  const readOnly = proposal.source.kind === "import";
  const orgGroups = allGroups.filter((g) => g.documents.length);
  const repo = allGroups.find((g) => g.id === proposal.groupId);
  const repoDocs = (repo?.documents ?? []).filter((d) => !changes.some((c) => c.documentId === d.id));
  const tree = buildTree(repoDocs);
  const startMs = fromLocalInput(start);
  const endMs = fromLocalInput(end);
  const windowValid = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
  const durationLabel = windowValid
    ? `${Math.max(1, Math.round((endMs - startMs) / 86_400_000))} days`
    : "end must be after start";
  const closesLabel = Number.isFinite(endMs) ? new Date(endMs).toLocaleDateString() : "—";
  const roStyle = readOnly ? { background: "var(--color-surface-mid)" } : undefined;

  return (
    <div className="mx-[calc(50%-50vw)] px-8 space-y-5">
      <div>
        <Link to="/proposals" className="font-mono text-[12px] text-muted flex items-center gap-1 mb-3">
          <Icon name="arrow_back" size={14} /> proposals
        </Link>
        <div className="flex items-center gap-2.5 flex-wrap">
          {editingTitle && !readOnly ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              autoFocus
              className="font-heading text-[24px] font-semibold px-2 py-0.5"
            />
          ) : (
            <h1 className="font-heading text-[24px] font-semibold leading-tight">{title}</h1>
          )}
          {!readOnly && !editingTitle && (
            <button onClick={() => setEditingTitle(true)} className="text-quiet hover:text-ink" aria-label="Edit title">
              <Icon name="edit" size={16} />
            </button>
          )}
          <Pill tone={proposal.status === "open" ? "green" : proposal.status === "draft" ? "yellow" : "grey"}>
            {proposal.status}
          </Pill>
          <SourceBadge source={proposal.source} />
          {!readOnly && changes.length === 0 && orgGroups.length > 0 ? (
            <select
              value={proposal.groupId}
              onChange={(e) => changeGroup(e.target.value)}
              disabled={busy}
              className="rounded-xs px-2 h-7 font-mono text-[12px]"
              title="Organization"
            >
              {orgGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <Pill tone="grey">{repo?.name ?? "—"}</Pill>
          )}
          {changes.length > 0 && (
            <span className="font-mono text-[11px]">
              <span style={{ color: "var(--color-status-success)" }}>+{totalStat.add}</span>{" "}
              <span style={{ color: "var(--color-status-error)" }}>−{totalStat.del}</span>
            </span>
          )}
        </div>
      </div>

      {readOnly && proposal.source.kind === "import" && (
        <div
          className="flex items-center gap-2 rounded-xs px-3 py-2 text-[13px]"
          style={{ background: "var(--color-status-warning-bg)", color: "var(--color-status-warning-glyph)" }}
        >
          <Icon name="lock" size={16} />
          <span>
            Synced from <strong className="font-semibold">{proposal.source.system}</strong>. Read-only
            here. Edit it on {proposal.source.system}.
          </span>
          <a
            href={proposal.source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto font-mono text-[11px] font-semibold whitespace-nowrap"
          >
            view original →
          </a>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* LEFT — editor */}
        <div className="space-y-4">
          <div className="segmented">
            <button className="seg" data-active={tab === "details"} onClick={() => setTab("details")}>
              Details
            </button>
            <button className="seg" data-active={tab === "documents"} onClick={() => setTab("documents")}>
              Documents{changes.length ? ` (${changes.length})` : ""}
            </button>
          </div>

          {tab === "details" ? (
            <Card className="p-5 space-y-4">
              <label className="block">
                <Eyebrow>description (optional)</Eyebrow>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  readOnly={readOnly}
                  rows={4}
                  placeholder={readOnly ? "" : "Optional. A pulse can be just a title."}
                  className="mt-1 w-full rounded-xs px-3 py-2 font-body text-[14px] resize-none"
                  style={roStyle}
                />
              </label>
              <div>
                <Eyebrow>signal window</Eyebrow>
                <div className="mt-1 space-y-2">
                  <label className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-muted w-12 shrink-0">starts</span>
                    <input
                      type="datetime-local"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      readOnly={readOnly}
                      className="flex-1 min-w-0 rounded-xs px-3 h-11 font-body text-[14px]"
                      style={roStyle}
                    />
                  </label>
                  <label className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-muted w-12 shrink-0">ends</span>
                    <input
                      type="datetime-local"
                      value={end}
                      min={start}
                      onChange={(e) => setEnd(e.target.value)}
                      readOnly={readOnly}
                      className="flex-1 min-w-0 rounded-xs px-3 h-11 font-body text-[14px]"
                      style={roStyle}
                    />
                  </label>
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-quiet">
                  // {durationLabel} · closes {closesLabel} · dispatched to moood as a pulse on a linked org
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {changes.length === 0 && (
                <Card className="p-5 text-[13px] text-muted">No documents in this proposal yet.</Card>
              )}
              {changes.map((c) => (
                <DocEditor
                  key={c.documentId}
                  change={c}
                  readOnly={readOnly}
                  onEdit={(v) =>
                    setChanges((prev) =>
                      prev.map((x) => (x.documentId === c.documentId ? { ...x, proposedDoc: v } : x)),
                    )
                  }
                  onRemove={() => removeDoc(c.documentId)}
                />
              ))}
              {!readOnly && (
                <button className="btn btn-secondary btn-sm" onClick={() => setAddModal(true)}>
                  <Icon name="add" size={16} /> Add document
                </button>
              )}
            </div>
          )}

          {!readOnly && (
            <div className="flex items-center gap-2">
              {proposal.status === "draft" ? (
                <>
                  <button className="btn btn-primary btn-sm" disabled={busy || !title.trim() || !windowValid} onClick={publish}>
                    <Icon name="publish" size={16} /> Publish
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={busy || !dirty || !title.trim() || !windowValid} onClick={commit}>
                    <Icon name="commit" size={16} /> Save draft
                  </button>
                </>
              ) : (
                <button className="btn btn-primary btn-sm" disabled={busy || !dirty || !title.trim() || !windowValid} onClick={commit}>
                  <Icon name="commit" size={16} /> Commit
                </button>
              )}
              <button className="btn btn-secondary btn-sm" disabled={!dirty} onClick={revert}>
                Revert
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — diff */}
        <div className="space-y-3">
          <div className="flex items-center justify-between h-9">
            <Eyebrow>proposed change</Eyebrow>
            <span className="font-mono text-[11px] text-muted">
              <span style={{ color: "var(--color-status-success)" }}>+{totalStat.add}</span>{" "}
              <span style={{ color: "var(--color-status-error)" }}>−{totalStat.del}</span>
              {" · "}
              {changes.length} {changes.length === 1 ? "file" : "files"}
            </span>
          </div>
          {changes.length === 0 ? (
            <Card className="p-5 text-[13px] text-muted">
              No document changes. This proposal is title and details only.
            </Card>
          ) : (
            changes.map((c) => <DocDiff key={c.documentId} change={c} />)
          )}
        </div>
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="add a document">
        <div className="space-y-3">
          <div>
            <span className="font-mono text-[11px] text-muted">repository</span>
            <div
              className="mt-1 flex items-center gap-2 rounded-xs px-3 h-11 font-body text-[14px]"
              style={{ background: "var(--color-surface-mid)", border: "1px solid var(--color-border-hairline)" }}
              title="Locked to this proposal's group"
            >
              <Icon name="folder" size={16} className="text-muted" />
              {repo?.name ?? "—"}
              <Icon name="lock" size={13} className="text-quiet ml-auto" />
            </div>
          </div>
          <div
            className="rounded-xs overflow-auto py-1"
            style={{ border: "1px solid var(--color-border-hairline)", maxHeight: 288 }}
          >
            {repoDocs.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-muted">
                Every document in this repository is already in the proposal.
              </div>
            ) : (
              <TreeView node={tree} depth={0} onPick={addDoc} busy={busy} />
            )}
          </div>
          <p className="font-mono text-[10px] text-quiet">// pick a file to add it to the proposal</p>
        </div>
      </Modal>
    </div>
  );
}
