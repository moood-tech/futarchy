import type { CSSProperties, ReactNode } from "react";
import { cx } from "../lib/util";

export function Icon({ name, className, size }: { name: string; className?: string; size?: number }) {
  return (
    <span
      className={cx("material-symbols-outlined", className)}
      style={size ? { fontSize: size } : undefined}
    >
      {name}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("eyebrow", className)}>{children}</div>;
}

/** A circle-"i" that reveals `text` in a small tooltip on hover/focus. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle" tabIndex={0}>
      <Icon name="info" size={15} className="text-quiet cursor-help hover:text-muted" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-xs px-2.5 py-1.5 text-[11px] leading-snug opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
        style={{ background: "var(--color-gray-100)", color: "#fff" }}
      >
        {text}
      </span>
    </span>
  );
}

type PillTone = "cyan" | "magenta" | "purple" | "green" | "grey" | "yellow";
const PILL_TONES: Record<PillTone, { bg: string; fg: string }> = {
  cyan: { bg: "var(--color-brand-blue-soft)", fg: "var(--color-cyan-60)" },
  magenta: { bg: "var(--color-brand-magenta-pill-soft)", fg: "var(--color-magenta-60)" },
  purple: { bg: "var(--color-purple-20)", fg: "var(--color-purple-70)" },
  green: { bg: "var(--color-green-10)", fg: "var(--color-green-50)" },
  grey: { bg: "var(--color-brand-hairline)", fg: "var(--color-gray-70)" },
  yellow: { bg: "var(--color-yellow-10)", fg: "var(--color-yellow-50)" },
};

export function Pill({ tone = "grey", children }: { tone?: PillTone; children: ReactNode }) {
  const t = PILL_TONES[tone];
  return (
    <span className="pill" style={{ background: t.bg, color: t.fg }}>
      {children}
    </span>
  );
}

/** A horizontal proportion bar (e.g. positive vs negative). */
export function SplitBar({
  left,
  leftColor,
  rightColor,
}: {
  left: number; // 0..1 share for the left segment
  leftColor: string;
  rightColor: string;
}) {
  return (
    <div className="h-2.5 w-full rounded-pill overflow-hidden flex" style={{ background: rightColor }}>
      <div style={{ width: `${Math.round(left * 100)}%`, background: leftColor }} />
    </div>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx("card", className)} style={style}>
      {children}
    </div>
  );
}

type Source =
  | { kind: "builtin" }
  | { kind: "import"; system: string; url: string; ref: string };

/** Provenance chip: "via Snapshot / Tally / Aragon" for imports, else built-in. */
export function SourceBadge({ source }: { source: Source }) {
  if (source.kind === "builtin") {
    return (
      <span className="pill" style={{ background: "var(--color-surface-mid)", color: "var(--color-text-strong)" }}>
        <Icon name="edit_note" size={13} /> built-in
      </span>
    );
  }
  return (
    <span
      className="pill"
      style={{ background: "var(--color-emphasis-bg-light)", color: "var(--color-emphasis-text)" }}
    >
      <Icon name="sync" size={13} /> via {source.system}
    </span>
  );
}

/** Centered modal dialog over a dimmed backdrop. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(22,22,22,0.45)" }} />
      <div
        className="relative w-full max-w-[460px] rounded-2xl bg-surface shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <Eyebrow>{title}</Eyebrow>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A compact search input with a leading magnifier. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={cx("flex items-center gap-2 rounded-xs bg-surface px-2.5 h-9", className)}
      style={{ border: "1px solid var(--color-border-hairline)" }}
    >
      <Icon name="search" size={16} className="text-quiet" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none font-body text-[13px]"
      />
    </div>
  );
}

