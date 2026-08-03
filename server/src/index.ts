/**
 * Advisory Governance Module POC — API server.
 *
 * Open sentiment protocol + play-money advisory markets. Local, in-memory,
 * non-blockchain. The API is intentionally the "protocol surface": anyone can
 * POST anonymous sentiment; the index it publishes is the oracle the markets
 * read. Advisory by default; a signal can opt in to binding execution.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { applyTrade, costToBuy, prices, type Side } from "./lmsr.js";
import { buyShares } from "./market.js";
import { seed } from "./seed.js";
import {
  contribute,
  initLive,
  oracle,
  statsFor,
  verifyToken,
} from "./sentiment.js";
import {
  HORIZONS,
  db,
  getOrCreatePlayer,
  marketsForProposal,
  nextId,
  type Proposal,
} from "./store.js";
import {
  groupSummary,
  leaderboard,
  marketView,
  portfolioView,
  proposalDetail,
  proposalSummary,
} from "./views.js";

const PORT = Number(process.env.PORT) || 4000;

seed();
initLive();

const app = express();
app.use(cors());
app.use(express.json());

const ok = (res: Response, body: unknown) => res.json(body);
const bad = (res: Response, code: number, msg: string) =>
  res.status(code).json({ error: msg });

app.get("/api/health", (_req, res) => ok(res, { ok: true }));

// ── Groups ──────────────────────────────────────────────────────────────────
app.get("/api/groups", (_req, res) => {
  ok(res, [...db.groups.keys()].map((id) => groupSummary(id)));
});

app.get("/api/groups/:id", (req, res) => {
  const summary = groupSummary(req.params.id);
  if (!summary) return bad(res, 404, "unknown group");
  ok(res, summary);
});

// ── Open contribution API (the protocol surface) ──────────────────────────────
// Anyone can call this. Body: { groupId, value (0..100), verificationToken? }.
// The value is folded into the aggregate immediately and NEVER stored per-user.
app.post("/api/contribute", (req: Request, res: Response) => {
  const { groupId, value, verificationToken } = req.body ?? {};
  if (typeof groupId !== "string" || !db.groups.has(groupId)) {
    return bad(res, 400, "valid groupId required");
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return bad(res, 400, "numeric value (0..100) required");
  }
  const level = verifyToken(verificationToken);
  try {
    ok(res, contribute(groupId, value, level));
  } catch (e) {
    bad(res, 400, (e as Error).message);
  }
});

// The oracle the markets read: aggregate index at a chosen trust threshold.
app.get("/api/index/:groupId", (req, res) => {
  const { groupId } = req.params;
  if (!db.groups.has(groupId)) return bad(res, 404, "unknown group");
  const q = req.query.threshold;
  const threshold = q === "verified" ? "verified" : q === "unverified" ? "unverified" : "weighted";
  const series = db.index.get(groupId) ?? [];
  const stats = statsFor(groupId);
  ok(res, {
    groupId,
    threshold,
    indexValue: Math.round(oracle(groupId, threshold) * 10) / 10,
    totalResponses: stats.allCount,
    verifiedResponses: stats.verCount,
    verifiedShare: Math.round(stats.verifiedShare * 100) / 100,
    series,
  });
});

// ── Proposals ─────────────────────────────────────────────────────────────────
app.get("/api/motions", (req, res) => {
  const groupId = typeof req.query.groupId === "string" ? req.query.groupId : null;
  const list = [...db.proposals.values()]
    .filter((p) => (groupId ? p.groupId === groupId : true))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(proposalSummary);
  ok(res, list);
});

app.get("/api/motions/:id", (req, res) => {
  const p = db.proposals.get(req.params.id);
  if (!p) return bad(res, 404, "unknown proposal");
  ok(res, proposalDetail(p));
});

// Built-in governance: author a proposal here. Creates the proposal (source
// `builtin`) plus a forecast market per horizon.
app.post("/api/motions", (req, res) => {
  const { groupId, title, description } = req.body ?? {};
  if (typeof groupId !== "string" || !db.groups.has(groupId)) {
    return bad(res, 400, "valid groupId required");
  }
  if (typeof title !== "string" || !title.trim()) {
    return bad(res, 400, "title required");
  }

  // A proposal starts as a title + optional details. Documents to change are
  // added on the edit page (like `git add ./file` into a pull request).
  const now = Date.now();
  const id = nextId("prop");
  const proposal: Proposal = {
    id,
    groupId,
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : "",
    source: { kind: "builtin" },
    status: "draft",
    createdAt: now,
    signalStart: Number(req.body?.signalStart) || now,
    signalEnd: Number(req.body?.signalEnd) || now + 30 * 86_400_000,
    changes: [],
    tradingEnabled: true,
    naked: false,
    pulse: { positive: 0, negative: 0 },
  };
  db.proposals.set(id, proposal);

  for (const scope of ["internal", "external"] as const) {
    for (const { key, years } of HORIZONS) {
      const mid = nextId("mkt");
      db.markets.set(mid, {
        id: mid,
        proposalId: id,
        scope,
        horizon: key,
        years,
        lmsr: { b: 100, qYes: 0, qNo: 0 },
        history: [{ t: 0, yes: 0.5 }],
      });
    }
  }

  ok(res, proposalDetail(proposal));
});

// Edit a proposal's text (built-in governance).
app.put("/api/motions/:id", (req, res) => {
  const p = db.proposals.get(req.params.id);
  if (!p) return bad(res, 404, "unknown proposal");
  const { title, description, changes, signalStart, signalEnd, groupId, status, tradingEnabled, naked } =
    req.body ?? {};
  // A synced proposal's identity (title, description, window, group, status)
  // belongs to the source and is read-only here; only its documents can change.
  const isImport = p.source.kind === "import";
  if (!isImport) {
    if (typeof title === "string" && title.trim()) p.title = title.trim();
    if (typeof description === "string") p.description = description.trim();
    if (Number(signalStart) > 0) p.signalStart = Number(signalStart);
    if (Number(signalEnd) > 0) p.signalEnd = Number(signalEnd);
    // Changing the organization switches which repository applies, so any
    // attached document changes are cleared.
    if (typeof groupId === "string" && db.groups.has(groupId) && groupId !== p.groupId) {
      p.groupId = groupId;
      p.changes = [];
    }
    if (status === "draft" || status === "open" || status === "closed") p.status = status;
    // Naked = a standalone sentiment signal: no proposal, so no documents.
    if (typeof naked === "boolean") {
      p.naked = naked;
      if (naked) p.changes = [];
    }
  }
  // Trading toggle: create the per-horizon market when enabled, or tear it (and
  // its trades) down when disabled. Applies to synced signals too.
  if (typeof tradingEnabled === "boolean" && tradingEnabled !== p.tradingEnabled) {
    p.tradingEnabled = tradingEnabled;
    if (tradingEnabled) {
      if (marketsForProposal(p.id).length === 0) {
        for (const scope of ["internal", "external"] as const) {
          for (const { key, years } of HORIZONS) {
            const mid = nextId("mkt");
            db.markets.set(mid, {
              id: mid,
              proposalId: p.id,
              scope,
              horizon: key,
              years,
              lmsr: { b: 100, qYes: 0, qNo: 0 },
              history: [{ t: 0, yes: 0.5 }],
            });
          }
        }
      }
    } else {
      const ids = new Set(marketsForProposal(p.id).map((m) => m.id));
      db.trades = db.trades.filter((t) => !ids.has(t.marketId));
      for (const mid of ids) db.markets.delete(mid);
    }
  }
  // The provided list is authoritative: drop any attached document not present
  // (a pending removal being committed) and update the proposed content of the
  // rest. Applies to synced proposals too — their documents are editable.
  if (Array.isArray(changes)) {
    const keep = new Set(changes.map((ch) => ch?.documentId));
    p.changes = (p.changes ?? []).filter((c) => keep.has(c.documentId));
    for (const ch of changes) {
      const existing = p.changes.find((c) => c.documentId === ch?.documentId);
      if (existing && typeof ch.proposedDoc === "string") existing.proposedDoc = ch.proposedDoc;
    }
  }
  ok(res, proposalDetail(p));
});

// Add a document from the group's repository to a proposal (`git add ./file`).
app.post("/api/motions/:id/documents", (req, res) => {
  const p = db.proposals.get(req.params.id);
  if (!p) return bad(res, 404, "unknown proposal");
  // Locked to the proposal's own group repository (its organizational unit).
  const group = db.groups.get(p.groupId);
  const doc = group?.documents?.find((d) => d.id === String(req.body?.documentId || ""));
  if (!doc) return bad(res, 400, "document not in this group's repository");
  p.changes = p.changes ?? [];
  if (!p.changes.some((c) => c.documentId === doc.id)) {
    p.changes.push({
      documentId: doc.id,
      documentName: doc.name,
      baseDoc: doc.content,
      proposedDoc: doc.content,
    });
  }
  ok(res, proposalDetail(p));
});

// Remove a document from a proposal.
app.delete("/api/motions/:id/documents/:documentId", (req, res) => {
  const p = db.proposals.get(req.params.id);
  if (!p) return bad(res, 404, "unknown proposal");
  if (p.source.kind === "import") return bad(res, 400, "synced proposals are read-only");
  p.changes = (p.changes ?? []).filter((c) => c.documentId !== req.params.documentId);
  ok(res, proposalDetail(p));
});

// Delete a proposal (built-in only). Also removes its markets and their trades.
app.delete("/api/motions/:id", (req, res) => {
  const p = db.proposals.get(req.params.id);
  if (!p) return bad(res, 404, "unknown proposal");
  if (p.source.kind !== "builtin") return bad(res, 400, "only built-in proposals can be deleted");
  const marketIds = new Set(marketsForProposal(p.id).map((m) => m.id));
  db.trades = db.trades.filter((t) => !marketIds.has(t.marketId));
  for (const mid of marketIds) db.markets.delete(mid);
  db.proposals.delete(p.id);
  ok(res, { deleted: p.id });
});

// Current-sentiment pulse. Increments an AGGREGATE counter only — a single swipe
// left/right. No individual response is ever stored (see PRIVACY.md).
app.post("/api/motions/:id/pulse", (req, res) => {
  const p = db.proposals.get(req.params.id);
  if (!p) return bad(res, 404, "unknown proposal");
  const dir = req.body?.direction as "positive" | "negative";
  if (dir !== "positive" && dir !== "negative") {
    return bad(res, 400, "direction must be 'positive' or 'negative'");
  }
  p.pulse[dir] += 1; // aggregate count only — no user row is written
  ok(res, { pulse: p.pulse });
});

// ── Markets ───────────────────────────────────────────────────────────────────
app.get("/api/markets/:id", (req, res) => {
  const m = db.markets.get(req.params.id);
  if (!m) return bad(res, 404, "unknown market");
  ok(res, marketView(m));
});

// Non-mutating cost quote for the buy UI.
app.post("/api/markets/:id/quote", (req, res) => {
  const m = db.markets.get(req.params.id);
  if (!m) return bad(res, 404, "unknown market");
  const side = req.body?.side as Side;
  const shares = Number(req.body?.shares);
  if (side !== "yes" && side !== "no") return bad(res, 400, "side must be yes|no");
  if (!(shares > 0)) return bad(res, 400, "shares must be positive");
  // Reuse market maths without mutating: costToBuy is pure.
  const cost = costToBuy(m.lmsr, side, shares);
  const after = prices(applyTrade(m.lmsr, side, shares));
  ok(res, { side, shares, cost, impliedYesAfter: after.yes });
});

app.post("/api/markets/:id/buy", (req, res) => {
  const m = db.markets.get(req.params.id);
  if (!m) return bad(res, 404, "unknown market");
  const side = req.body?.side as Side;
  const shares = Number(req.body?.shares);
  const playerId = String(req.body?.playerId || "");
  const handle = req.body?.handle ? String(req.body.handle) : undefined;
  if (side !== "yes" && side !== "no") return bad(res, 400, "side must be yes|no");
  if (!(shares > 0)) return bad(res, 400, "shares must be positive");
  if (!playerId) return bad(res, 400, "playerId required");

  getOrCreatePlayer(playerId, handle);
  try {
    const result = buyShares(m, playerId, side, shares, Date.now());
    ok(res, {
      trade: result.trade,
      balance: result.balance,
      market: marketView(m),
      portfolio: portfolioView(playerId),
    });
  } catch (e) {
    bad(res, 400, (e as Error).message);
  }
});

// ── Players / play-money ──────────────────────────────────────────────────────
app.post("/api/players", (req, res) => {
  const id = String(req.body?.id || "");
  const handle = req.body?.handle ? String(req.body.handle) : undefined;
  if (!id) return bad(res, 400, "id required");
  getOrCreatePlayer(id, handle);
  ok(res, portfolioView(id));
});

app.get("/api/players/:id", (req, res) => {
  const view = portfolioView(req.params.id);
  if (!view) return bad(res, 404, "unknown player");
  ok(res, view);
});

app.get("/api/leaderboard", (_req, res) => ok(res, leaderboard()));

// In production, serve the built client from the same origin (the API is on
// /api, everything else falls back to the SPA's index.html). Skipped in dev,
// where Vite serves the client and proxies /api here.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(path.join(clientDist, "index.html"));
    } else {
      next();
    }
  });
}

app.listen(PORT, () => {
  console.log(`[api] advisory-governance POC listening on http://localhost:${PORT}`);
});
