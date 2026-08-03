/** Thin typed client for the POC's open protocol API. */

export type Threshold = "unverified" | "verified" | "weighted";
export type Horizon = "1y" | "2y" | "3y" | "5y" | "10y" | "20y" | "30y";
export type Side = "yes" | "no";

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  derived: boolean;
  childrenIds: string[];
  documents: { id: string; name: string; path: string }[];
  currentIndexUnverified: number;
  currentIndexVerified: number;
  currentIndexWeighted: number;
  trend30d: number;
  openProposals: number;
  totalResponses: number;
  verifiedResponses: number;
  verifiedShare: number;
  tvl: number;
  tvlYoY: number;
}

export interface IndexPoint {
  date: string;
  indexUnverified: number;
  indexVerified: number;
  indexWeighted: number;
}

export interface IndexResponse {
  groupId: string;
  threshold: Threshold;
  indexValue: number;
  totalResponses: number;
  verifiedResponses: number;
  verifiedShare: number;
  series: IndexPoint[];
}

export interface MarketView {
  id: string;
  scope: "internal" | "external";
  horizon: Horizon;
  years: number;
  baselineRate: number;
  payoutMultiplier: number; // (1+baselineRate)^years — payout scales with horizon
  impliedYes: number;
  impliedNo: number;
  b: number;
  history: { t: number; yes: number }[];
  volume: number;
}

export type ProposalSource =
  | { kind: "builtin" }
  | { kind: "import"; system: string; url: string; ref: string };

export interface ProposalSummary {
  id: string;
  groupId: string;
  title: string;
  description: string;
  status: "draft" | "open" | "closed";
  createdAt: number;
  signalStart: number;
  signalEnd: number;
  source: ProposalSource;
  owner?: string;
  tradingEnabled: boolean;
  naked: boolean;
  isDoc: boolean;
  documentCount: number;
  additions: number;
  deletions: number;
  marketLean: number;
  sentimentPositive: number;
  pulse: { positive: number; negative: number };
}

export interface DocChange {
  documentId: string;
  documentName: string;
  baseDoc: string;
  proposedDoc: string;
}

export interface ProposalDetail extends ProposalSummary {
  changes: DocChange[];
  markets: MarketView[];
}

export interface Position {
  marketId: string;
  proposalId: string;
  proposalTitle: string;
  horizon: Horizon;
  yes: number;
  no: number;
  markValue: number;
}

export interface Portfolio {
  id: string;
  handle: string;
  balance: number;
  openValue: number;
  netWorth: number;
  positions: Position[];
}

export interface LeaderRow {
  id: string;
  handle: string;
  balance: number;
  netWorth: number;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  groups: () => req<GroupSummary[]>("/api/groups"),
  group: (id: string) => req<GroupSummary>(`/api/groups/${id}`),
  index: (groupId: string, threshold: Threshold) =>
    req<IndexResponse>(`/api/index/${groupId}?threshold=${threshold}`),
  contribute: (groupId: string, value: number, verificationToken?: string) =>
    req<{ level: string; indexUnverified: number; indexVerified: number; indexWeighted: number }>(
      "/api/contribute",
      { method: "POST", body: JSON.stringify({ groupId, value, verificationToken }) },
    ),
  proposals: (groupId?: string) =>
    req<ProposalSummary[]>(`/api/motions${groupId ? `?groupId=${groupId}` : ""}`),
  proposal: (id: string) => req<ProposalDetail>(`/api/motions/${id}`),
  createProposal: (groupId: string, title: string, description: string, documentId?: string) =>
    req<ProposalDetail>("/api/motions", {
      method: "POST",
      body: JSON.stringify({ groupId, title, description, documentId }),
    }),
  updateProposal: (
    id: string,
    fields: {
      title?: string;
      description?: string;
      groupId?: string;
      status?: "draft" | "open" | "closed";
      signalStart?: number;
      signalEnd?: number;
      changes?: { documentId: string; proposedDoc: string }[];
      tradingEnabled?: boolean;
      naked?: boolean;
    },
  ) =>
    req<ProposalDetail>(`/api/motions/${id}`, {
      method: "PUT",
      body: JSON.stringify(fields),
    }),
  addDocument: (id: string, documentId: string) =>
    req<ProposalDetail>(`/api/motions/${id}/documents`, {
      method: "POST",
      body: JSON.stringify({ documentId }),
    }),
  removeDocument: (id: string, documentId: string) =>
    req<ProposalDetail>(`/api/motions/${id}/documents/${documentId}`, {
      method: "DELETE",
    }),
  deleteProposal: (id: string) =>
    req<{ deleted: string }>(`/api/motions/${id}`, { method: "DELETE" }),
  pulse: (id: string, direction: "positive" | "negative") =>
    req<{ pulse: { positive: number; negative: number } }>(
      `/api/motions/${id}/pulse`,
      { method: "POST", body: JSON.stringify({ direction }) },
    ),
  quote: (marketId: string, side: Side, shares: number) =>
    req<{ cost: number; impliedYesAfter: number }>(`/api/markets/${marketId}/quote`, {
      method: "POST",
      body: JSON.stringify({ side, shares }),
    }),
  buy: (
    marketId: string,
    side: Side,
    shares: number,
    playerId: string,
    handle: string,
  ) =>
    req<{ balance: number; market: MarketView; portfolio: Portfolio }>(
      `/api/markets/${marketId}/buy`,
      { method: "POST", body: JSON.stringify({ side, shares, playerId, handle }) },
    ),
  ensurePlayer: (id: string, handle: string) =>
    req<Portfolio>("/api/players", {
      method: "POST",
      body: JSON.stringify({ id, handle }),
    }),
  player: (id: string) => req<Portfolio>(`/api/players/${id}`),
  leaderboard: () => req<LeaderRow[]>("/api/leaderboard"),
};
