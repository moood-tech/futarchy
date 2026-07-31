import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./ui";

/**
 * moood-styled date + time fields. The date is a calendar popover (mirrors the
 * web-app: circular days, cream hover, cyan selected day, today = cream + cyan
 * dot). The time is a Material 3 clock dial (big time + AM/PM above a round
 * clock face with a cyan hand + selection), mirroring the web-app's MUI
 * MobileTimePicker. Both are split into their own fields and share one
 * ms-epoch value.
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

// ── Time field (Material 3 clock dial) ──────────────────────────────────────────

const DIAL = 232;
const CENTER = DIAL / 2;
const RING = 90;

/** Point on the dial ring for an angle measured clockwise from the top. */
function dialPoint(deg: number) {
  const r = (deg * Math.PI) / 180;
  return { x: CENTER + RING * Math.sin(r), y: CENTER - RING * Math.cos(r) };
}

const HOUR_NUMS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MIN_NUMS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,..55

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
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const ref = useDismiss(open, () => setOpen(false));

  useEffect(() => {
    if (open) setMode("hour");
  }, [open]);

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
  const handPoint = mode === "hour" ? dialPoint(h12 * 30) : dialPoint(minute * 6);
  const nums = mode === "hour" ? HOUR_NUMS : MIN_NUMS;

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
          className="absolute right-0 z-50 mt-1 rounded-lg p-4"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-hairline)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.10)",
          }}
        >
          {/* Toolbar: big time + AM/PM */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-baseline font-heading text-[30px] font-semibold">
              <button
                type="button"
                onClick={() => setMode("hour")}
                className="px-1.5 rounded-sm transition-colors"
                style={{
                  color: mode === "hour" ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  background: mode === "hour" ? "var(--color-surface-mid)" : "transparent",
                }}
              >
                {pad(h12)}
              </button>
              <span className="px-0.5 text-muted">:</span>
              <button
                type="button"
                onClick={() => setMode("minute")}
                className="px-1.5 rounded-sm transition-colors"
                style={{
                  color: mode === "minute" ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  background: mode === "minute" ? "var(--color-surface-mid)" : "transparent",
                }}
              >
                {pad(minute)}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {(["AM", "PM"] as const).map((p) => {
                const active = (p === "PM") === isPm;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => emit(h12, minute, p === "PM")}
                    className="rounded-sm px-2 h-7 font-mono text-[12px] transition-colors"
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

          {/* Clock dial */}
          <div
            className="relative mt-3 rounded-pill"
            style={{ width: DIAL, height: DIAL, background: "var(--color-surface-mid)" }}
          >
            <svg
              className="absolute inset-0 pointer-events-none"
              width={DIAL}
              height={DIAL}
              viewBox={`0 0 ${DIAL} ${DIAL}`}
            >
              <line
                x1={CENTER}
                y1={CENTER}
                x2={handPoint.x}
                y2={handPoint.y}
                stroke="var(--color-cta-default)"
                strokeWidth={2}
              />
              <circle cx={CENTER} cy={CENTER} r={3} fill="var(--color-cta-default)" />
            </svg>
            {nums.map((n) => {
              const deg = mode === "hour" ? n * 30 : n * 6;
              const p = dialPoint(deg);
              const selected = mode === "hour" ? n === h12 : n === minute;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    if (mode === "hour") {
                      emit(n, minute, isPm);
                      setMode("minute");
                    } else {
                      emit(h12, n, isPm);
                    }
                  }}
                  className="absolute grid place-items-center rounded-pill font-mono text-[13px] -translate-x-1/2 -translate-y-1/2 transition-colors"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: 34,
                    height: 34,
                    background: selected ? "var(--color-cta-default)" : "transparent",
                    color: selected ? "#fff" : "var(--color-text-primary)",
                  }}
                >
                  {mode === "hour" ? n : pad(n)}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
