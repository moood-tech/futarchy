/**
 * In-memory data store for the POC.
 *
 * ── ANONYMITY INVARIANT (see PRIVACY.md) ────────────────────────────────────
 * There is deliberately NO table, map, or field anywhere in this store that ties
 * a sentiment response to an individual. `SentimentContribution`s that arrive on
 * the open API are folded into aggregates the instant they land and then thrown
 * away — they are never persisted. The current-sentiment pulse keeps only running
 * positive/negative COUNTS. The only per-actor records that exist are play-money
 * `Player`s and their `Trade`s, which are a game leaderboard, not a person.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Everything lives in process memory and is re-seeded on boot. Swapping this file
 * for a real database (aggregate-only schema) is the single integration point —
 * see ARCHITECTURE.md.
 */

import type { LmsrState, Side } from "./lmsr.js";

export type VerificationLevel = "none" | "verified";
export type Horizon = "1y" | "2y" | "3y" | "5y" | "10y" | "20y" | "30y";
export type ProposalStatus = "draft" | "open" | "closed";

/**
 * Play-money baseline (risk-free) annual rate. A winning stake compounds at this
 * rate over its horizon, so longer horizons pay more — it is the time value of
 * capital held at risk for the term. Drives the payout multiplier shown on each
 * market. It is NOT a floor: a losing stake is lost to the winning side.
 */
export const BASELINE_RATE = 0.05;

/** The forecast horizons, each with its length in years. */
export const HORIZONS: { key: Horizon; years: number }[] = [
  { key: "1y", years: 1 },
  { key: "2y", years: 2 },
  { key: "3y", years: 3 },
  { key: "5y", years: 5 },
  { key: "10y", years: 10 },
  { key: "20y", years: 20 },
  { key: "30y", years: 30 },
];

/** Compounded baseline growth factor over `years` — the payout multiplier. */
export function horizonGrowth(years: number): number {
  return Math.pow(1 + BASELINE_RATE, years);
}

/** One document in a group's repository (a constitution / contract / policy). */
export interface GroupDocument {
  id: string;
  name: string;
  path: string; // repo path, e.g. "policies/working-policy.md" (for the file tree)
  content: string; // markdown
}

export interface Group {
  id: string;
  name: string;
  description: string;
  /**
   * The group's document repository. A proposal proposes an edit to ONE of
   * these documents (chosen at create time) — see `Proposal`.
   */
  documents?: GroupDocument[];
  /** True when this group's index is a live aggregate of its children. */
  derived?: boolean;
  /** Child group ids that roll up into this one (for derived/"Global" groups). */
  childrenIds?: string[];
}

/** One point on a group's aggregate wellbeing index. Aggregate only. */
export interface IndexPoint {
  date: string; // ISO yyyy-mm-dd
  /** Index computed counting ALL contributions regardless of verification. */
  indexNone: number; // 0..100
  /** Index computed counting only `verified` contributions (trust-weighted). */
  indexVerified: number; // 0..100
}

export interface Market {
  id: string;
  proposalId: string;
  horizon: Horizon;
  years: number;
  lmsr: LmsrState;
  /** Price-history samples (implied P(yes)) taken after each trade. */
  history: { t: number; yes: number }[];
}

/**
 * Where a proposal came from. `builtin` proposals are authored in this app;
 * `import` proposals are synced from an external governance system (Snapshot,
 * Tally, Aragon, …) — our copy is a lightweight stub that links back to the
 * original. In the POC the imported ones are mock, with placeholder URLs.
 */
export type ProposalSource =
  | { kind: "builtin" }
  | { kind: "import"; system: string; url: string; ref: string };

/** One document changed by a proposal (one "file" in the PR). */
export interface DocChange {
  documentId: string;
  documentName: string;
  baseDoc: string; // snapshot of the document, diffed against
  proposedDoc: string; // the proposed new content
}

export interface Proposal {
  id: string;
  groupId: string;
  title: string;
  /** Optional rationale (the "why"). The substance is the document diff. */
  description: string;
  status: ProposalStatus;
  createdAt: number;
  /**
   * The signal window: when the sentiment signal opens and closes (ms epoch).
   * Maps to a moood pulse when dispatched to a linked org — signalStart is the
   * pulse `scheduledAt`, and (signalEnd − signalStart) its `duration`.
   */
  signalStart: number;
  signalEnd: number;
  source: ProposalSource;
  /**
   * The documents this proposal changes (like the files in a GitHub PR).
   * Each entry diffs baseDoc → proposedDoc. Empty/absent for a title-only
   * proposal (e.g. the moood daily check-in). Documents are added/removed on
   * the edit page (`git add ./file`).
   */
  changes?: DocChange[];
  /**
   * Whether the forecast market is enabled. When false there is no market to
   * trade — the signal is sentiment-only (e.g. the daily wellbeing check-in).
   */
  tradingEnabled: boolean;
  /**
   * A naked signal is standalone sentiment with no proposal behind it (no
   * document changes, no decision). The daily wellbeing check-in is the
   * canonical one: it baselines a group's long-term sentiment and every
   * proposal's market is judged against that index.
   */
  naked: boolean;
  /**
   * The signal's owner: the organization, or an individual with no org, that
   * owns it. Every signal has one. For an org group the owner is the group
   * itself, so this is left unset; for a public signal (the Public group) it
   * names the owning org or individual, since the group is not the owner.
   */
  owner?: string;
  /** Aggregate-only tallies of the live "how do you feel about this?" pulse. */
  pulse: { positive: number; negative: number };
}

export interface Trade {
  id: string;
  marketId: string;
  side: Side;
  shares: number;
  cost: number;
  playerId: string;
  t: number;
}

/** Shares held per market. */
export interface Position {
  yes: number;
  no: number;
}

export interface Player {
  id: string;
  handle: string;
  balance: number; // play-money
  /** marketId -> position. */
  positions: Record<string, Position>;
}

export const STARTING_BALANCE = 1000;

interface DB {
  groups: Map<string, Group>;
  index: Map<string, IndexPoint[]>; // groupId -> series
  proposals: Map<string, Proposal>;
  markets: Map<string, Market>;
  trades: Trade[];
  players: Map<string, Player>;
}

export const db: DB = {
  groups: new Map(),
  index: new Map(),
  proposals: new Map(),
  markets: new Map(),
  trades: [],
  players: new Map(),
};

/** Fetch or lazily create a play-money player (session handle, not an identity). */
export function getOrCreatePlayer(id: string, handle?: string): Player {
  let p = db.players.get(id);
  if (!p) {
    p = {
      id,
      handle: handle || id,
      balance: STARTING_BALANCE,
      positions: {},
    };
    db.players.set(id, p);
  }
  return p;
}

export function marketsForProposal(proposalId: string): Market[] {
  return [...db.markets.values()]
    .filter((m) => m.proposalId === proposalId)
    .sort((a, b) => a.years - b.years);
}

let counter = 0;
/** Deterministic id generator (Math.random is unavailable in this runtime). */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}
