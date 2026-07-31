import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./ui";

/**
 * moood-styled date + time fields. The date is a calendar popover (mirrors the
 * web-app: circular days, cream hover, cyan selected day, today = cream + cyan
 * dot). The time is a Material-style digital clock (hours / minutes / AM-PM
 * columns), mirroring the web-app's MUI time picker. Both are split into their
 * own fields and share one ms-epoch value.
 */

const MON_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MON_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Shared popover-dismiss (outside click + Escape) behaviour. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const fieldStyle = (disabled?: boolean) => ({
  background: disabled ? "var(--color-surface-mid)" : "var(--color-input-bg)",
  boxShadow: "inset 0 1px 3px rgba(60, 50, 30, 0.05)",
});

// ── Date field ────────────────────────────────────────────────────────────────

export function DatePicker({
  value,
  min,
  onChange,
  disabled,
}: {
  value: number;
  min?: number;
  onChange: (ms: number) => void;
  disabled?: boolean;
}) {
  const valid = Number.isFinite(value);
  const base = useMemo(() => (valid ? new Date(value) : new Date()), [valid, value]);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const ref = useDismiss(open, () => setOpen(false));

  useEffect(() => {
    if (open) {
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
  }, [open, base]);

  const minDay = min !== undefined ? startOfDay(min) : null;
  const todayDay = startOfDay(Date.now());

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= count; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewYear, viewMonth]);

  function pick(day: number) {
    const h = valid ? base.getHours() : 9;
    const m = valid ? base.getMinutes() : 0;
    const next = new Date(viewYear, viewMonth, day, h, m, 0, 0).getTime();
    onChange(min !== undefined && next < min ? min : next);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const m = viewMonth + delta;
    setViewYear(viewYear + Math.floor(m / 12));
    setViewMonth(((m % 12) + 12) % 12);
  }

  const label = valid
    ? `${pad(base.getDate())} ${MON_SHORT[base.getMonth()]} ${base.getFullYear()}`
    : "Select date";

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-sm px-3 h-11 text-left font-body text-[14px] disabled:opacity-70"
        style={fieldStyle(disabled)}
      >
        <span className={valid ? "text-ink" : "text-quiet"}>{label}</span>
        <Icon name="calendar_today" size={16} className="text-muted shrink-0" />
      </button>

      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 w-[280px] rounded-lg p-3"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-hairline)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
          }}
        >
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid place-items-center w-7 h-7 rounded-pill text-muted hover:bg-cream"
              aria-label="Previous month"
            >
              <Icon name="chevron_left" size={18} />
            </button>
            <span className="font-heading text-[14px] font-semibold">
              {MON_LONG[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid place-items-center w-7 h-7 rounded-pill text-muted hover:bg-cream"
              aria-label="Next month"
            >
              <Icon name="chevron_right" size={18} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center font-mono text-[10px] font-medium text-muted py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const dayMs = new Date(viewYear, viewMonth, d).getTime();
              const isDisabled = minDay !== null && dayMs < minDay;
              const isSelected =
                valid &&
                base.getFullYear() === viewYear &&
                base.getMonth() === viewMonth &&
                base.getDate() === d;
              const isToday = dayMs === todayDay;
              return (
                <div key={i} className="flex justify-center py-0.5">
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => pick(d)}
                    className="relative grid place-items-center w-8 h-8 rounded-pill text-[13px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: isSelected
                        ? "var(--color-cta-default)"
                        : isToday
                          ? "var(--color-surface-mid)"
                          : "transparent",
                      color: isSelected ? "#fff" : "var(--color-text-primary)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isDisabled)
                        e.currentTarget.style.background = "var(--color-surface-cream)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = isToday
                          ? "var(--color-surface-mid)"
                          : "transparent";
                    }}
                  >
                    {d}
                    {isToday && !isSelected && (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 bottom-1 w-1 h-1 rounded-pill"
                        style={{ background: "var(--color-cta-default)" }}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Time field (Material digital clock) ─────────────────────────────────────────

const ITEM_H = 34;

function Column({
  items,
  selected,
  format,
  onSelect,
}: {
  items: number[];
  selected: number;
  format: (n: number) => string;
  onSelect: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Centre the selected item in the column on mount.
    const idx = items.indexOf(selected);
    if (ref.current && idx >= 0) ref.current.scrollTop = idx * ITEM_H - ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="overflow-y-auto no-scrollbar" style={{ height: ITEM_H * 4 }}>
      {items.map((n) => {
        const active = n === selected;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n)}
            className="w-full grid place-items-center rounded-sm font-mono text-[13px] transition-colors"
            style={{
              height: ITEM_H,
              background: active ? "var(--color-cta-default)" : "transparent",
              color: active ? "#fff" : "var(--color-text-primary)",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = "var(--color-surface-cream)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = "transparent";
            }}
          >
            {format(n)}
          </button>
        );
      })}
    </div>
  );
}

const HOURS12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function TimePicker({
  value,
  min,
  onChange,
  disabled,
}: {
  value: number;
  min?: number;
  onChange: (ms: number) => void;
  disabled?: boolean;
}) {
  const valid = Number.isFinite(value);
  const base = useMemo(() => (valid ? new Date(value) : new Date()), [valid, value]);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const h24 = valid ? base.getHours() : 9;
  const minute = valid ? base.getMinutes() : 0;
  const isPm = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  function emit(nextH12: number, nextMin: number, pm: boolean) {
    const h = pm ? (nextH12 % 12) + 12 : nextH12 % 12;
    const d = valid ? new Date(value) : new Date();
    d.setHours(h, nextMin, 0, 0);
    const ms = d.getTime();
    onChange(min !== undefined && ms < min ? min : ms);
  }

  const label = valid ? `${pad(h12)}:${pad(minute)} ${isPm ? "PM" : "AM"}` : "Time";

  return (
    <div ref={ref} className="relative shrink-0 w-[132px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-sm px-3 h-11 text-left font-body text-[14px] disabled:opacity-70"
        style={fieldStyle(disabled)}
      >
        <span className={valid ? "text-ink" : "text-quiet"}>{label}</span>
        <Icon name="schedule" size={16} className="text-muted shrink-0" />
      </button>

      {open && !disabled && (
        <div
          className="absolute right-0 z-50 mt-1 rounded-lg p-2"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-hairline)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
          }}
        >
          <div className="flex gap-1">
            <Column
              items={HOURS12}
              selected={h12}
              format={(n) => pad(n)}
              onSelect={(n) => emit(n, minute, isPm)}
            />
            <div className="grid place-items-center font-mono text-[13px] text-muted px-0.5">:</div>
            <Column
              items={MINUTES}
              selected={minute}
              format={(n) => pad(n)}
              onSelect={(n) => emit(h12, n, isPm)}
            />
            <div className="flex flex-col gap-1 pl-1">
              {(["AM", "PM"] as const).map((p) => {
                const active = (p === "PM") === isPm;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => emit(h12, minute, p === "PM")}
                    className="rounded-sm px-2 h-8 font-mono text-[12px] transition-colors"
                    style={{
                      background: active ? "var(--color-cta-default)" : "transparent",
                      color: active ? "#fff" : "var(--color-text-primary)",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
