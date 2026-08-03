import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cx } from "../lib/util";
import { Icon } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: "home_max", end: true },
  { to: "/signals", label: "Signals", icon: "campaign", end: false },
  { to: "/motions", label: "Motions", icon: "how_to_vote", end: false },
  { to: "/how-it-works", label: "How it works", icon: "info", end: false },
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b" style={{ borderColor: "var(--color-border-hairline)" }}>
        <div className="px-8 h-16 grid grid-cols-[1fr_auto_1fr] items-center">
          {/* Left — logo */}
          <div className="flex items-center gap-3 justify-self-start">
            <span
              className="text-[28px] leading-none lowercase text-ink"
              style={{ fontFamily: "'Magical Night', Geist, sans-serif" }}
            >
              moood
            </span>
            <span className="eyebrow hidden md:block">govfi</span>
          </div>

          {/* Center — page links */}
          <nav className="flex items-center gap-1 justify-self-center">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    "flex items-center gap-1.5 rounded-md px-3 h-9 font-mono text-[13px] font-semibold transition-colors",
                    isActive ? "bg-ink text-white" : "text-muted hover:bg-cream",
                  )
                }
              >
                <Icon name={n.icon} size={18} />
                <span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right — account */}
          <div className="justify-self-end">
            <NavLink
              to="/portfolio"
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-1.5 rounded-md px-3 h-9 font-mono text-[13px] font-semibold transition-colors",
                  isActive ? "bg-ink text-white" : "bg-cream text-ink hover:bg-divider-cream",
                )
              }
            >
              <Icon name="account_circle" size={18} />
              <span className="hidden sm:inline">My Account</span>
            </NavLink>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-content px-6 py-8 flex-1">{children}</main>
      <footer className="px-6 py-8">
        <p className="font-mono text-[11px] text-quiet text-center">© 2026 moood · the emotional interface</p>
      </footer>
    </div>
  );
}
