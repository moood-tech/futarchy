import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type LeaderRow, type Portfolio as Port } from "../lib/api";
import { Card, Eyebrow, InfoTip, Pill } from "../components/ui";
import { cx, getPlayer, money } from "../lib/util";

export function Portfolio() {
  const [player] = useState(getPlayer);
  const [port, setPort] = useState<Port | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);

  useEffect(() => {
    api.ensurePlayer(player.id, player.handle).then(setPort);
    api.leaderboard().then(setBoard);
  }, [player]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5">
        <span className="eyebrow">my account</span>
        <InfoTip text="Your play-money balance, open positions, and the leaderboard. The handle is a session nickname, not an identity. No real money." />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <Eyebrow>your handle</Eyebrow>
          <div className="mt-2 font-mono text-[22px] font-semibold">{port?.handle ?? "…"}</div>
        </Card>
        <Card className="p-5">
          <Eyebrow>cash balance</Eyebrow>
          <div className="mt-2 font-heading text-[30px] font-semibold leading-none">
            {money(port?.balance ?? 0)}
          </div>
        </Card>
        <Card className="p-5">
          <Eyebrow>total balance</Eyebrow>
          <div className="mt-2 font-heading text-[30px] font-semibold leading-none">
            {money(port?.netWorth ?? 0)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted">
            incl. {money(port?.openValue ?? 0)} open positions
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <Eyebrow>your positions</Eyebrow>
          <div className="mt-3 space-y-2">
            {port && port.positions.length === 0 && (
              <Card className="p-5 text-[13px] text-muted">
                No open positions yet.{" "}
                <Link to="/signals" className="text-ink underline">
                  Back a forecast →
                </Link>
              </Card>
            )}
            {port?.positions.map((pos) => (
              <Link key={pos.marketId} to={`/signals/${pos.proposalId}`}>
                <Card className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-[14px] font-semibold">{pos.proposalTitle}</span>
                    <Pill tone="purple">{pos.horizon}</Pill>
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[12px] text-muted">
                    <span>
                      {pos.yes > 0 && <span style={{ color: "var(--color-status-success)" }}>{pos.yes} YES</span>}
                      {pos.yes > 0 && pos.no > 0 && " · "}
                      {pos.no > 0 && <span style={{ color: "var(--color-magenta-70)" }}>{pos.no} NO</span>}
                    </span>
                    <span className="text-ink font-semibold">mark {money(pos.markValue)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow>leaderboard</Eyebrow>
          <Card className="mt-3 divide-y" style={{ borderColor: "var(--color-border-hairline)" }}>
            {board.map((row, i) => {
              const you = row.id === player.id;
              return (
                <div
                  key={row.id}
                  className={cx("flex items-center justify-between px-4 py-3", you && "bg-emphasis-light")}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[13px] text-quiet w-5">{i + 1}</span>
                    <span className="font-mono text-[14px] font-semibold">
                      {row.handle}
                      {you && <span className="ml-2 text-[10px]" style={{ color: "var(--color-emphasis-text)" }}>you</span>}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[14px] font-semibold">{money(row.netWorth)}</div>
                    <div className="font-mono text-[10px] text-quiet">cash {money(row.balance)}</div>
                  </div>
                </div>
              );
            })}
          </Card>
          <p className="mt-2 font-mono text-[10px] text-quiet">
            // total balance marks open positions at current LMSR prices
          </p>
        </div>
      </div>
    </div>
  );
}
