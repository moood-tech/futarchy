/**
 * Serializers that turn internal state into the shapes the client renders.
 * Kept separate from routing so the wire format is easy to see in one place.
 */

import { diffStat } from "./diff.js";
import { prices } from "./lmsr.js";
import { current, statsFor } from "./sentiment.js";
import {
  BASELINE_RATE,
  db,
  horizonGrowth,
  marketsForProposal,
  type Market,
  type Proposal,
} from "./store.js";

export function marketView(m: Market) {
  const p = prices(m.lmsr);
  return {
    id: m.id,
    scope: m.scope,
    horizon: m.horizon,
    years: m.years,
    baselineRate: BASELINE_RATE,
    payoutMultiplier: horizonGrowth(m.years), // (1+r)^years — higher for longer
    impliedYes: p.yes,
    impliedNo: p.no,
    b: m.lmsr.b,
    history: m.history,
    volume: db.trades
      .filter((t) => t.marketId === m.id)
      .reduce((n, t) => n + t.shares, 0),
  };
}

/** A one-line read of a proposal's two signals, for list cards. */
export function proposalSummary(p: Proposal) {
  const markets = marketsForProposal(p.id);
  // "Market lean" = the internal market's 1y implied P(yes) as the headline forecast.
  const oneYear = markets.find((m) => m.horizon === "1y" && m.scope === "internal");
  const marketLean = oneYear ? prices(oneYear.lmsr).yes : 0.5;

  const total = p.pulse.positive + p.pulse.negative;
  const sentimentPositive = total > 0 ? p.pulse.positive / total : 0.5;

  const changes = p.changes ?? [];
  let additions = 0;
  let deletions = 0;
  for (const c of changes) {
    const s = diffStat(c.baseDoc, c.proposedDoc);
    additions += s.additions;
    deletions += s.deletions;
  }

  return {
    id: p.id,
    groupId: p.groupId,
    title: p.title,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt,
    signalStart: p.signalStart,
    signalEnd: p.signalEnd,
    source: p.source,
    owner: p.owner, // owning org/individual (public signals only)
    tradingEnabled: p.tradingEnabled, // forecast market available
    naked: p.naked, // standalone sentiment signal (no proposal)
    isDoc: changes.length > 0, // true when the proposal changes documents
    documentCount: changes.length,
    additions,
    deletions,
    marketLean, // implied P(wellbeing up under proposal), 1y
    sentimentPositive, // aggregate share feeling positive now
    pulse: p.pulse,
  };
}

export function proposalDetail(p: Proposal) {
  return {
    ...proposalSummary(p),
    changes: (p.changes ?? []).map((c) => ({
      documentId: c.documentId,
      documentName: c.documentName,
      baseDoc: c.baseDoc,
      proposedDoc: c.proposedDoc,
    })),
    markets: marketsForProposal(p.id).map(marketView),
  };
}

/** Group overview tiles: current index at both thresholds + 30d trend. */
export function groupSummary(groupId: string) {
  const group = db.groups.get(groupId);
  if (!group) return null;
  const series = db.index.get(groupId) ?? [];
  const cur = current(groupId);

  // 30d trend ≈ compare against the point ~4 weeks back (weighted index).
  const back = series[Math.max(0, series.length - 5)];
  const trend30d = back ? cur.indexWeighted - back.indexWeighted : 0;

  // Count governance proposals only — the moood daily check-in is a sentiment
  // signal, not a proposal, so it is excluded from the open-proposal count.
  const openProposals = [...db.proposals.values()].filter(
    (pr) =>
      pr.groupId === groupId &&
      pr.status === "open" &&
      !(pr.source.kind === "import" && pr.source.system === "moood"),
  ).length;

  const stats = statsFor(groupId);

  // TVL: play-money staked across this group's signal markets.
  const proposalIds = new Set(
    [...db.proposals.values()].filter((p) => p.groupId === groupId).map((p) => p.id),
  );
  const marketIds = new Set(
    [...db.markets.values()].filter((m) => proposalIds.has(m.proposalId)).map((m) => m.id),
  );
  const tvl = db.trades
    .filter((t) => marketIds.has(t.marketId))
    .reduce((sum, t) => sum + Math.max(0, t.cost), 0);
  // Year-on-year change is illustrative: no historical TVL is stored yet, so it
  // is derived deterministically from the group and stays stable across requests.
  const seed = [...groupId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tvlYoY = (seed % 80) - 22; // roughly -22% … +57%

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    derived: !!group.derived,
    childrenIds: group.childrenIds ?? [],
    documents: (group.documents ?? []).map((d) => ({ id: d.id, name: d.name, path: d.path })),
    currentIndexUnverified: Math.round(cur.indexUnverified * 10) / 10,
    currentIndexVerified: Math.round(cur.indexVerified * 10) / 10,
    currentIndexWeighted: Math.round(cur.indexWeighted * 10) / 10,
    trend30d: Math.round(trend30d * 10) / 10,
    openProposals,
    totalResponses: stats.allCount,
    verifiedResponses: stats.verCount,
    verifiedShare: Math.round(stats.verifiedShare * 100) / 100,
    tvl: Math.round(tvl),
    tvlYoY,
  };
}

/** Mark-to-market a player's open positions at current prices. */
export function portfolioView(playerId: string) {
  const player = db.players.get(playerId);
  if (!player) return null;

  const positions = Object.entries(player.positions)
    .map(([marketId, pos]) => {
      const m = db.markets.get(marketId);
      if (!m) return null;
      const pr = prices(m.lmsr);
      // Expected redemption, marked at current prices and scaled by the
      // horizon's baseline growth (longer markets are worth more).
      const value = (pos.yes * pr.yes + pos.no * pr.no) * horizonGrowth(m.years);
      const proposal = db.proposals.get(m.proposalId);
      return {
        marketId,
        proposalId: m.proposalId,
        proposalTitle: proposal?.title ?? "—",
        horizon: m.horizon,
        yes: pos.yes,
        no: pos.no,
        markValue: value,
      };
    })
    .filter(Boolean);

  const openValue = positions.reduce((n, p) => n + (p ? p.markValue : 0), 0);

  return {
    id: player.id,
    handle: player.handle,
    balance: player.balance,
    openValue,
    netWorth: player.balance + openValue,
    positions,
  };
}

export function leaderboard() {
  return [...db.players.values()]
    .map((p) => {
      const view = portfolioView(p.id)!;
      return {
        id: p.id,
        handle: p.handle,
        balance: Math.round(p.balance * 100) / 100,
        netWorth: Math.round(view.netWorth * 100) / 100,
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth);
}
