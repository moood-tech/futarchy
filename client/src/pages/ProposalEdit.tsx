import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, type DocChange, type GroupSummary, type ProposalDetail as Detail } from "../lib/api";
import { Card, Eyebrow, Icon, Modal, Pill, SourceBadge } from "../components/ui";
import { DatePicker, TimePicker } from "../components/DateTimePicker";
import { Markdown, MarkdownEditor } from "../components/markdown";
import { type DiffHunkLine, type DiffLine, lineDiff, toHunks } from "../lib/diff";
import { cx, pct } from "../lib/util";

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

function DiffRow({
  line,
  id,
  active,
  highlighted,
  onPick,
}: {
  line: DiffHunkLine;
  id: string;
  active: boolean;
  highlighted: boolean;
  onPick: (rect: DOMRect) => void;
}) {
  const bg = highlighted
    ? "var(--color-purple-20)"
    : line.type === "add"
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
    <div id={id} className="flex items-stretch scroll-mt-24" style={{ background: bg }}>
      <button
        type="button"
        onClick={(e) => onPick(e.currentTarget.getBoundingClientRect())}
        className="shrink-0 flex select-none text-[11px] text-quiet hover:text-ink transition-colors"
        style={{ background: active ? "var(--color-surface-mid)" : "transparent" }}
        title="Comment or copy link"
      >
        <span className="w-9 text-right pr-1">{line.oldNo ?? ""}</span>
        <span className="w-9 text-right pr-2">{line.newNo ?? ""}</span>
      </button>
      <div className="px-2 whitespace-pre" style={{ color: fg }}>
        {sign} {line.text}
      </div>
    </div>
  );
}

/** The line a comment is anchored to (absent for a general comment). */
export interface CommentTarget {
  documentId: string;
  documentName: string;
  lineId: string;
  lineNo: string;
  lineText: string;
}

interface Reply {
  id: string;
  author: string;
  body: string;
  createdAt: number;
}

interface LineComment {
  id: string;
  author: string;
  body: string;
  createdAt: number;
  replies: Reply[];
  target?: CommentTarget; // absent → a general comment (not tied to a line)
}

const ME = "you";
const uid = () => `${Date.now()}_${Math.round(Math.random() * 1e6)}`;

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

/** Right column: a document's git-style diff, one card per change. */
function DocDiff({
  change,
  highlightLine,
  onStartComment,
}: {
  change: DocChange;
  highlightLine: string | null;
  onStartComment: (target: CommentTarget) => void;
}) {
  const diff = useMemo(() => lineDiff(change.baseDoc, change.proposedDoc), [change]);
  const hunks = useMemo(() => toHunks(diff), [diff]);
  const s = useMemo(() => countStat(diff), [diff]);
  const file = `governance/${change.documentName}.md`;

  // A single floating popover (not an inline expansion) anchored to the clicked
  // line number, so opening it never shifts the diff.
  const [menu, setMenu] = useState<{ line: DiffHunkLine; x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  const idFor = (line: DiffHunkLine) =>
    `line-${change.documentId}-${line.newNo ?? `d${line.oldNo}`}`;

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu, close]);

  function copyLink(line: DiffHunkLine) {
    const url = `${location.origin}${location.pathname}#${idFor(line)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function comment(line: DiffHunkLine) {
    onStartComment({
      documentId: change.documentId,
      documentName: change.documentName,
      lineId: idFor(line),
      lineNo: `L${line.newNo ?? line.oldNo}`,
      lineText: line.text,
    });
    close();
  }

  const activeId = menu ? idFor(menu.line) : null;

  return (
    <>
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
              <div
                className="px-4 py-1.5 font-mono text-[11px] text-quiet"
                style={{
                  background: "var(--color-surface-mid)",
                  borderTop: "1px solid var(--color-border-hairline)",
                  borderBottom: "1px solid var(--color-border-hairline)",
                }}
              >
                {h.header}
              </div>
              <div className="font-mono text-[12px] leading-relaxed overflow-x-auto pb-1">
                {h.lines.map((line, i) => {
                  const lid = idFor(line);
                  return (
                    <DiffRow
                      key={i}
                      line={line}
                      id={lid}
                      active={activeId === lid}
                      highlighted={highlightLine === lid}
                      onPick={(rect) => {
                        if (activeId === lid) close();
                        else setMenu({ line, x: rect.right + 6, y: rect.top });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </Card>

      {menu && (
        <div
          ref={popRef}
          className="fixed z-50 rounded-lg p-1.5"
          style={{
            left: menu.x,
            top: menu.y,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-hairline)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          }}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => copyLink(menu.line)}
              className="flex items-center gap-1 rounded-xs px-2 py-1 text-[12px] text-ink hover:bg-cream"
            >
              <Icon name="link" size={14} /> {copied ? "copied" : "copy link"}
            </button>
            <button
              onClick={() => comment(menu.line)}
              className="flex items-center gap-1 rounded-xs px-2 py-1 text-[12px] text-ink hover:bg-cream"
            >
              <Icon name="chat_bubble" size={14} /> comment
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** A comment thread: the comment, its line anchor (optional), and its replies. */
function CommentCard({
  comment,
  onJump,
  onReply,
}: {
  comment: LineComment;
  onJump: (lineId: string) => void;
  onReply: (commentId: string, body: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  return (
    <Card className="p-4">
      {comment.target ? (
        <>
          <button
            onClick={() => onJump(comment.target!.lineId)}
            className="flex items-center gap-1.5 font-mono text-[11px] text-muted hover:text-ink transition-colors"
          >
            <Icon name="my_location" size={13} /> {comment.target.documentName} · {comment.target.lineNo}
          </button>
          <div
            className="mt-1.5 rounded-md px-2 py-1 font-mono text-[11px] overflow-x-auto whitespace-pre"
            style={{ background: "var(--color-purple-20)", color: "var(--color-purple-70)" }}
          >
            {comment.target.lineText || "(blank line)"}
          </div>
        </>
      ) : (
        <span className="font-mono text-[11px] text-quiet">general</span>
      )}

      <div className="mt-2 font-mono text-[11px] text-muted">{comment.author}</div>
      <p className="mt-0.5 text-[13px]">{comment.body}</p>

      {comment.replies.length > 0 && (
        <div
          className="mt-3 space-y-2 pl-3"
          style={{ borderLeft: "2px solid var(--color-border-hairline)" }}
        >
          {comment.replies.map((r) => (
            <div key={r.id}>
              <div className="font-mono text-[11px] text-muted">{r.author}</div>
              <p className="mt-0.5 text-[13px]">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {replying ? (
        <div className="mt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            rows={2}
            placeholder="Reply"
            className="w-full rounded-xs px-2 py-1 font-body text-[12px] resize-none"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              disabled={!text.trim()}
              onClick={() => {
                onReply(comment.id, text.trim());
                setText("");
                setReplying(false);
              }}
            >
              Reply
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setReplying(false);
                setText("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setReplying(true)}
          className="mt-2 flex items-center gap-1 font-mono text-[11px] text-muted hover:text-ink transition-colors"
        >
          <Icon name="reply" size={13} /> reply
        </button>
      )}
    </Card>
  );
}

/** A small on/off switch used for the signal's feature toggles. */
function Toggle({
  label,
  hint,
  on,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="text-[11px] text-muted">{hint}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="relative w-10 h-6 rounded-pill shrink-0 transition-colors disabled:opacity-50"
        style={{ background: on ? "var(--color-cta-default)" : "var(--color-surface-mid)" }}
        aria-pressed={on}
        aria-label={label}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-pill bg-white transition-transform"
          style={{ transform: on ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

export function ProposalEdit() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<Detail | null>(null);
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [changes, setChanges] = useState<DocChange[]>([]);
  const [tradingEnabled, setTradingEnabled] = useState(true);
  // A signal is a motion when it has document changes, else a naked sentiment
  // signal. Derived from the documents rather than a manual toggle.
  const naked = changes.length === 0;
  const [busy, setBusy] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tab, setTab] = useState<"details" | "documents" | "comments">("details");
  const [addModal, setAddModal] = useState(false);
  const [delModal, setDelModal] = useState(false);
  const [removeDocId, setRemoveDocId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [allGroups, setAllGroups] = useState<GroupSummary[]>([]);
  const [comments, setComments] = useState<LineComment[]>([]);
  const [highlightLine, setHighlightLine] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftTarget, setDraftTarget] = useState<CommentTarget | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"diff" | "preview">("diff");

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
    // A freshly created draft opens straight in edit mode.
    if (searchParams.get("new")) {
      setEditMode(true);
      setEditingTitle(true);
    }
  }, [searchParams]);

  // A pasted "copy link to line" URL (#line-…) scrolls to + highlights that line.
  useEffect(() => {
    if (!proposal) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash.startsWith("line-")) return;
    const t = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) {
        setHighlightLine(hash);
        el.scrollIntoView({ block: "center" });
      }
    }, 120);
    return () => clearTimeout(t);
  }, [proposal]);

  useEffect(() => {
    api.groups().then(setAllGroups);
  }, []);

  // Keep the selected document valid as changes are added/removed.
  useEffect(() => {
    if (changes.length === 0) setSelectedDocId(null);
    else if (!changes.some((c) => c.documentId === selectedDocId)) {
      setSelectedDocId(changes[0].documentId);
    }
  }, [changes, selectedDocId]);

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
    setTradingEnabled(p.tradingEnabled);
  }

  const dirty =
    !!proposal &&
    (tradingEnabled !== proposal.tradingEnabled ||
      naked !== proposal.naked ||
      title !== proposal.title ||
      rationale !== proposal.description ||
      start !== toLocalInput(proposal.signalStart) ||
      end !== toLocalInput(proposal.signalEnd) ||
      changes.length !== proposal.changes.length ||
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
          tradingEnabled,
          naked,
        }),
      );
      setEditMode(false);
    } finally {
      setBusy(false);
    }
  }

  function revert() {
    if (!proposal) return;
    applyLoaded(proposal);
    setEditMode(false);
    setEditingTitle(false);
  }

  // Open the draft composer in the Comments tab. A line target highlights that
  // line (purple) while drafting; a null target is a general comment.
  function startDraft(target: CommentTarget | null) {
    setDraftTarget(target);
    setDraftBody("");
    setDrafting(true);
    setHighlightLine(target ? target.lineId : null);
    setTab("comments");
  }

  function cancelDraft() {
    setDrafting(false);
    setDraftTarget(null);
    setDraftBody("");
    setHighlightLine(null);
  }

  function submitDraft() {
    if (!draftBody.trim()) return;
    setComments((prev) => [
      ...prev,
      {
        id: uid(),
        author: ME,
        body: draftBody.trim(),
        createdAt: Date.now(),
        replies: [],
        target: draftTarget ?? undefined,
      },
    ]);
    cancelDraft();
  }

  function addReply(commentId: string, body: string) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, replies: [...c.replies, { id: uid(), author: ME, body, createdAt: Date.now() }] }
          : c,
      ),
    );
  }

  function jumpToLine(lineId: string) {
    setHighlightLine(lineId);
    const el = document.getElementById(lineId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightLine((h) => (h === lineId ? null : h)), 2500);
  }

  async function del() {
    if (!id) return;
    setBusy(true);
    try {
      await api.deleteProposal(id);
      navigate("/motions");
    } finally {
      setBusy(false);
      setDelModal(false);
    }
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

  // Removal is a pending change until Commit: the document stays until then, and
  // Revert restores it, so backing out of an uncommitted edit never loses a doc.
  function removeDoc(documentId: string) {
    setChanges((prev) => prev.filter((c) => c.documentId !== documentId));
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
          tradingEnabled,
          naked,
          status: "open",
        }),
      );
      setEditMode(false);
    } finally {
      setBusy(false);
    }
  }

  if (!proposal) return <div className="text-muted">Loading…</div>;

  const isSynced = proposal.source.kind === "import";
  const canEditMeta = !isSynced && editMode; // title, description, signal window, group
  const canEditDocs = editMode; // documents are editable even on a synced proposal
  const selectedChange = changes.find((c) => c.documentId === selectedDocId) ?? null;
  const isNew = searchParams.get("new") !== null;
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
  const roStyle = !canEditMeta ? { background: "var(--color-surface-mid)" } : undefined;

  return (
    <div className="mx-[calc(50%-50vw)] px-8 space-y-5">
      <div>
        <Link to="/motions" className="font-mono text-[12px] text-muted flex items-center gap-1 mb-3">
          <Icon name="arrow_back" size={14} /> motions
        </Link>
        <div className="flex items-center gap-2.5 flex-wrap">
          {editingTitle && canEditMeta ? (
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
          {canEditMeta && !editingTitle && (
            <button onClick={() => setEditingTitle(true)} className="text-quiet hover:text-ink" aria-label="Edit title">
              <Icon name="edit" size={16} />
            </button>
          )}
          <Pill tone={proposal.status === "open" ? "green" : proposal.status === "draft" ? "yellow" : "grey"}>
            {proposal.status}
          </Pill>
          <SourceBadge source={proposal.source} />
          {isNew && canEditMeta && changes.length === 0 && orgGroups.length > 0 ? (
            <select
              value={proposal.groupId}
              onChange={(e) => changeGroup(e.target.value)}
              disabled={busy}
              className="rounded-xs px-2 h-7 font-mono text-[12px]"
              title="Collective"
            >
              {orgGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ) : (
            <Pill tone="purple">{repo?.name ?? "—"}</Pill>
          )}
          {changes.length > 0 && (
            <span className="font-mono text-[11px]">
              <span style={{ color: "var(--color-status-success)" }}>+{totalStat.add}</span>{" "}
              <span style={{ color: "var(--color-status-error)" }}>−{totalStat.del}</span>
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!editMode && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>
                <Icon name="edit" size={16} /> Edit
              </button>
            )}
            {editMode && proposal.source.kind === "builtin" && (
              <button
                onClick={() => setDelModal(true)}
                disabled={busy}
                className="grid place-items-center w-8 h-8 rounded-sm text-muted hover:text-ink transition-colors"
                style={{ background: "var(--color-surface-mid)" }}
                title="Delete motion"
                aria-label="Delete motion"
              >
                <Icon name="delete" size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {proposal.source.kind === "import" && (
        <div
          className="flex items-center gap-2 rounded-xs px-3 py-2 text-[13px]"
          style={{ background: "var(--color-status-warning-bg)", color: "var(--color-status-warning-glyph)" }}
        >
          <Icon name="sync" size={16} />
          <span>
            Synced from <strong className="font-semibold">{proposal.source.system}</strong>
            <span className="font-mono text-[11px] opacity-70"> · {proposal.source.ref}</span>. Title
            and description are read-only. Documents and comments can be edited here.
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
        {/* LEFT — signal summary (view only) + editor */}
        <div className="space-y-4">
          {!editMode && (
            <Card className="p-4">
              <Eyebrow>signal</Eyebrow>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <div className="font-mono text-[11px] text-muted">predicted (1y)</div>
                  <div className="mt-0.5 font-heading text-[22px] font-semibold leading-none">
                    {pct(proposal.marketLean)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-quiet">P(wellbeing up)</div>
                </div>
                <div>
                  <div className="font-mono text-[11px] text-muted">sentiment</div>
                  <div className="mt-1 flex items-baseline gap-3 font-mono text-[14px] font-semibold">
                    <span style={{ color: "var(--color-status-success)" }}>
                      ▲ {proposal.pulse.positive}
                    </span>
                    <span style={{ color: "var(--color-magenta-70)" }}>
                      ▼ {proposal.pulse.negative}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-quiet">
                    {pct(proposal.sentimentPositive)} positive
                  </div>
                </div>
              </div>
            </Card>
          )}
          <div className="segmented">
            <button className="seg" data-active={tab === "details"} onClick={() => setTab("details")}>
              Details
            </button>
            {(changes.length > 0 || editMode) && (
              <button className="seg" data-active={tab === "documents"} onClick={() => setTab("documents")}>
                Documents{changes.length ? ` (${changes.length})` : ""}
              </button>
            )}
            <button className="seg" data-active={tab === "comments"} onClick={() => setTab("comments")}>
              Comments{comments.length ? ` (${comments.length})` : ""}
            </button>
          </div>

          {tab === "comments" && (
            <div className="space-y-3">
              {drafting && (
                <Card className="p-4">
                  {draftTarget ? (
                    <>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: "var(--color-purple-70)" }}>
                        <Icon name="my_location" size={13} /> {draftTarget.documentName} · {draftTarget.lineNo}
                      </div>
                      <div
                        className="mt-1.5 rounded-md px-2 py-1 font-mono text-[11px] overflow-x-auto whitespace-pre"
                        style={{ background: "var(--color-purple-20)", color: "var(--color-purple-70)" }}
                      >
                        {draftTarget.lineText || "(blank line)"}
                      </div>
                    </>
                  ) : (
                    <div className="font-mono text-[11px] text-muted">new comment</div>
                  )}
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    autoFocus
                    rows={3}
                    placeholder="Write a comment"
                    className="mt-2 w-full rounded-xs px-2 py-1 font-body text-[13px] resize-none"
                  />
                  <div className="mt-1.5 flex gap-2">
                    <button className="btn btn-primary btn-sm" disabled={!draftBody.trim()} onClick={submitDraft}>
                      Comment
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={cancelDraft}>
                      Cancel
                    </button>
                  </div>
                </Card>
              )}

              {comments.map((c) => (
                <CommentCard key={c.id} comment={c} onJump={jumpToLine} onReply={addReply} />
              ))}

              {comments.length === 0 && !drafting && (
                <Card className="p-5 text-[13px] text-muted">
                  No comments yet. Click a line number in the diff to comment on it, or add a comment
                  below.
                </Card>
              )}

              {!drafting && (
                <button
                  onClick={() => startDraft(null)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 font-mono text-[12px] text-quiet hover:text-ink transition-colors"
                  style={{ border: "1px dashed var(--color-border-hairline)" }}
                >
                  <Icon name="add" size={15} /> add comment
                </button>
              )}
            </div>
          )}

          {tab === "details" && (
            <Card className="p-5 space-y-4">
              <label className="block">
                <Eyebrow>description (optional)</Eyebrow>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  readOnly={!canEditMeta}
                  rows={4}
                  placeholder={!canEditMeta ? "" : "Optional. A pulse can be just a title."}
                  className="mt-1 w-full rounded-xs px-3 py-2 font-body text-[14px] resize-none"
                  style={roStyle}
                />
              </label>
              <div>
                <Eyebrow>signal window</Eyebrow>
                <div className="mt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted w-12 shrink-0">starts</span>
                    <DatePicker
                      value={fromLocalInput(start)}
                      onChange={(ms) => setStart(toLocalInput(ms))}
                      disabled={!canEditMeta}
                    />
                    <TimePicker
                      value={fromLocalInput(start)}
                      onChange={(ms) => setStart(toLocalInput(ms))}
                      disabled={!canEditMeta}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted w-12 shrink-0">ends</span>
                    <DatePicker
                      value={fromLocalInput(end)}
                      min={fromLocalInput(start)}
                      onChange={(ms) => setEnd(toLocalInput(ms))}
                      disabled={!canEditMeta}
                    />
                    <TimePicker
                      value={fromLocalInput(end)}
                      min={fromLocalInput(start)}
                      onChange={(ms) => setEnd(toLocalInput(ms))}
                      disabled={!canEditMeta}
                    />
                  </div>
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-quiet">
                  // {durationLabel} · closes {closesLabel} · dispatched to moood as a pulse on a linked collective
                </p>
              </div>

              <div>
                <Eyebrow>options</Eyebrow>
                <div className="mt-2 space-y-3">
                  <Toggle
                    label="Forecast market"
                    hint="Enable forecast trading on this signal."
                    on={tradingEnabled}
                    disabled={!canEditMeta}
                    onChange={setTradingEnabled}
                  />
                </div>
              </div>
            </Card>
          )}

          {tab === "documents" && (
            <div className="space-y-3">
              {/* Document list */}
              <Card className="p-0 overflow-hidden divide-y divide-hairline">
                {changes.length === 0 && (
                  <div className="p-4 text-[13px] text-muted">No documents in this motion yet.</div>
                )}
                {changes.map((c) => (
                  <div
                    key={c.documentId}
                    onClick={() => setSelectedDocId(c.documentId)}
                    className={cx(
                      "flex items-center gap-2 px-3 h-10 cursor-pointer transition-colors",
                      selectedDocId === c.documentId ? "bg-cream" : "hover:bg-cream",
                    )}
                  >
                    <Icon name="description" size={14} className="text-muted shrink-0" />
                    <span className="font-mono text-[12px] truncate flex-1">{c.documentName}</span>
                    {canEditDocs && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRemoveDocId(c.documentId);
                        }}
                        className="text-quiet hover:text-ink shrink-0"
                        title="Remove document"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </Card>

              {canEditDocs && (
                <button className="btn btn-secondary btn-sm" onClick={() => setAddModal(true)}>
                  <Icon name="add" size={16} /> Add document
                </button>
              )}

              {/* Editor for the selected document */}
              {selectedChange && (
                <MarkdownEditor
                  key={selectedChange.documentId}
                  value={selectedChange.proposedDoc}
                  path={`governance/${selectedChange.documentName}.md`}
                  readOnly={!canEditDocs}
                  onChange={(v) =>
                    setChanges((prev) =>
                      prev.map((x) =>
                        x.documentId === selectedChange.documentId ? { ...x, proposedDoc: v } : x,
                      ),
                    )
                  }
                />
              )}
            </div>
          )}

          {editMode && (
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
              <button className="btn btn-secondary btn-sm" onClick={revert}>
                {dirty ? "Revert" : "Cancel"}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — diff / preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between h-9 gap-3">
            {changes.length === 0 ? (
              <Eyebrow>proposed change</Eyebrow>
            ) : (
              <div className="segmented">
                <button className="seg" data-active={rightTab === "diff"} onClick={() => setRightTab("diff")}>
                  Diff
                </button>
                <button
                  className="seg"
                  data-active={rightTab === "preview"}
                  onClick={() => setRightTab("preview")}
                >
                  Preview
                </button>
              </div>
            )}
            <span className="font-mono text-[11px] text-muted shrink-0">
              <span style={{ color: "var(--color-status-success)" }}>+{totalStat.add}</span>{" "}
              <span style={{ color: "var(--color-status-error)" }}>−{totalStat.del}</span>
              {" · "}
              {changes.length} {changes.length === 1 ? "file" : "files"}
            </span>
          </div>
          {changes.length === 0 ? (
            <Card className="p-5 text-[13px] text-muted">
              No document changes. This motion is title and details only.
            </Card>
          ) : rightTab === "diff" ? (
            changes.map((c) => (
              <DocDiff
                key={c.documentId}
                change={c}
                highlightLine={highlightLine}
                onStartComment={startDraft}
              />
            ))
          ) : (
            <Card className="p-0 overflow-hidden">
              {selectedChange && (
                <div
                  className="px-4 py-2 font-mono text-[11px] text-quiet"
                  style={{ background: "var(--color-surface-mid)", borderBottom: "1px solid var(--color-border-hairline)" }}
                >
                  governance/{selectedChange.documentName}.md
                </div>
              )}
              <div className="p-4">
                <Markdown source={selectedChange?.proposedDoc ?? ""} />
              </div>
            </Card>
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
              title="Locked to this motion's collective"
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

      <Modal open={delModal} onClose={() => setDelModal(false)} title="delete motion">
        <div className="space-y-4">
          <p className="text-[14px] text-muted">
            Delete <span className="text-ink font-semibold">{title}</span>? This removes the motion
            and its signal for good. This cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setDelModal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-sm"
              style={{ background: "var(--color-status-error)", color: "#fff" }}
              disabled={busy}
              onClick={del}
            >
              <Icon name="delete" size={16} /> Delete
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={removeDocId !== null} onClose={() => setRemoveDocId(null)} title="remove document">
        <div className="space-y-4">
          <p className="text-[14px] text-muted">
            Remove{" "}
            <span className="text-ink font-semibold">
              {changes.find((c) => c.documentId === removeDocId)?.documentName}
            </span>{" "}
            from this motion? It stays until you commit the change, and Revert restores it.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setRemoveDocId(null)}>
              Cancel
            </button>
            <button
              className="btn btn-sm"
              style={{ background: "var(--color-status-error)", color: "#fff" }}
              onClick={() => {
                if (removeDocId) removeDoc(removeDocId);
                setRemoveDocId(null);
              }}
            >
              <Icon name="close" size={16} /> Remove
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
