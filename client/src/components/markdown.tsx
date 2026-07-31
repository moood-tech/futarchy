import { type ReactNode, useRef } from "react";
import { Icon } from "./ui";

/**
 * A minimal, dependency-free markdown renderer + toolbar editor. Covers the
 * subset the proposal documents use: headings, bold, italic, inline code,
 * links, and unordered / ordered lists. Matches the project's hand-rolled
 * approach (see lib/diff.ts).
 */

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)]+\))/g;

function inline(text: string): ReactNode[] {
  return text
    .split(INLINE_RE)
    .filter((p) => p !== "")
    .map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("`") && p.endsWith("`"))
        return (
          <code
            key={i}
            className="rounded-xs px-1 font-mono text-[0.9em]"
            style={{ background: "var(--color-surface-mid)" }}
          >
            {p.slice(1, -1)}
          </code>
        );
      if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
      if (p.startsWith("_") && p.endsWith("_")) return <em key={i}>{p.slice(1, -1)}</em>;
      const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link)
        return (
          <a key={i} href={link[2]} target="_blank" rel="noreferrer noopener" className="underline">
            {link[1]}
          </a>
        );
      return <span key={i}>{p}</span>;
    });
}

const H_CLASS = [
  "font-heading text-[18px] font-semibold",
  "font-heading text-[16px] font-semibold",
  "font-heading text-[14px] font-semibold",
  "font-heading text-[13px] font-semibold",
];

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(h[1].length, 4);
      const Tag = (`h${lvl}` as unknown) as keyof JSX.IntrinsicElements;
      blocks.push(
        <Tag key={key++} className={H_CLASS[lvl - 1]}>
          {inline(h[2])}
        </Tag>,
      );
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 text-[13px] text-ink-2 space-y-0.5">
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 text-[13px] text-ink-2 space-y-0.5">
          {items.map((it, k) => (
            <li key={k}>{inline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para: string[] = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="text-[13px] text-ink-2 leading-relaxed">
        {inline(para.join(" "))}
      </p>,
    );
  }

  if (blocks.length === 0) {
    return <p className="text-[13px] text-quiet italic">Nothing to preview.</p>;
  }
  return <div className="space-y-2">{blocks}</div>;
}

// ── Editor ──────────────────────────────────────────────────────────────────

interface Tool {
  icon: string;
  title: string;
  wrap?: [string, string];
  linePrefix?: "bullet" | "number" | "quote" | string;
}

const TOOLS: Tool[] = [
  { icon: "format_bold", title: "Bold", wrap: ["**", "**"] },
  { icon: "format_italic", title: "Italic", wrap: ["*", "*"] },
  { icon: "title", title: "Heading", linePrefix: "## " },
  { icon: "format_list_bulleted", title: "Bulleted list", linePrefix: "bullet" },
  { icon: "format_list_numbered", title: "Numbered list", linePrefix: "number" },
  { icon: "code", title: "Inline code", wrap: ["`", "`"] },
  { icon: "link", title: "Link", wrap: ["[", "](url)"] },
];

export function MarkdownEditor({
  value,
  onChange,
  readOnly,
  path,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  path?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function restore(start: number, end: number) {
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start, end);
    });
  }

  function wrap(before: string, after: string) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value: v } = ta;
    const sel = v.slice(s, e);
    onChange(v.slice(0, s) + before + sel + after + v.slice(e));
    restore(s + before.length, e + before.length);
  }

  function prefixLines(kind: string) {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value: v } = ta;
    const from = v.lastIndexOf("\n", s - 1) + 1;
    const nl = v.indexOf("\n", e);
    const to = nl === -1 ? v.length : nl;
    const block = v.slice(from, to);
    const out = block
      .split("\n")
      .map((l, i) => (kind === "bullet" ? `- ${l}` : kind === "number" ? `${i + 1}. ${l}` : `${kind}${l}`))
      .join("\n");
    onChange(v.slice(0, from) + out + v.slice(to));
    restore(from, from + out.length);
  }

  function run(t: Tool) {
    if (t.wrap) wrap(t.wrap[0], t.wrap[1]);
    else if (t.linePrefix) prefixLines(t.linePrefix);
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border-hairline)" }}>
      {path && (
        <div
          className="flex items-center gap-2 px-4 py-2 font-mono text-[11px] text-quiet"
          style={{ background: "var(--color-surface-mid)", borderBottom: "1px solid var(--color-border-hairline)" }}
        >
          <Icon name="description" size={13} /> {path}
        </div>
      )}
      {!readOnly && (
        <div
          className="flex items-center gap-0.5 px-2 py-1.5"
          style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border-hairline)" }}
        >
          {TOOLS.map((t) => (
            <button
              key={t.icon}
              type="button"
              title={t.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(t)}
              className="grid place-items-center w-7 h-7 rounded-xs text-muted hover:text-ink hover:bg-cream transition-colors"
            >
              <Icon name={t.icon} size={16} />
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        rows={16}
        className="w-full px-4 py-3 font-mono text-[12.5px] leading-relaxed resize-y block"
        style={{
          borderRadius: 0,
          boxShadow: "none",
          background: readOnly ? "var(--color-surface-mid)" : "var(--color-surface)",
        }}
      />
    </div>
  );
}
