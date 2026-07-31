# Architecture — how the POC maps to the real version

The POC is deliberately a set of **mocks behind clean interfaces**. The point is that the real
system can replace each mock without changing the shape the rest of the code (and any reference
client, like moood) depends on. This document lists each seam.

```
 client(s) ──POST /api/contribute──▶  Sentiment aggregation  ──▶  Index oracle
   (moood, kiosks, bots)                 (aggregate-only)              │
                                                                       ▼
 decision-maker ◀── proposal detail ──  Advisory layer  ◀──  Prediction markets (LMSR)
                     (two signals)          (advisory)         reading the oracle
```

## The seams

### 1. Sentiment oracle — mock → real aggregation service

- **POC:** `server/src/sentiment.ts` holds per-group running aggregates in memory. The index is a
  weighted mean; the `verified` threshold counts only verified contributions.
- **Real:** the same `contribute()` / `oracle()` interface backed by a durable aggregate store and a
  proper streaming aggregation (e.g. a privacy-preserving counter service, or differential-privacy
  noised aggregates). **The interface does not change** — callers still POST a value and read an
  index at a threshold. The invariant that raw contributions are never persisted is preserved
  (see `PRIVACY.md`).

### 2. Proof-of-personhood — mock → real provider

- **POC:** `verifyToken()` treats any `vp_`-prefixed token as "verified".
- **Real:** swap the body of `verifyToken()` for a call to a real provider — **World ID**, **BrightID**,
  **Gitcoin Passport**, or similar. The function signature (`token → VerificationLevel`) is the
  integration point. Verification establishes *uniqueness* without revealing *identity*; the token is
  validated and then discarded along with the rest of the contribution.

### 3. Prediction markets — play-money LMSR → on-chain markets

- **POC:** `server/src/lmsr.ts` is a pure, deterministic LMSR maker over 1/2/3/5/10/20/30-year
  horizons; balances are play-money in memory (`server/src/market.ts`). Payouts carry a **baseline
  (risk-free) rate** compounded over the horizon: a winning share redeems at `(1+r)^years`, and a
  losing stake is refunded at that same baseline (`BASELINE_RATE` in `store.ts`). Longer horizons
  pay more; losing still returns the baseline.
- **Real:** the LMSR maths is production-grade and can run as-is, or be replaced by an on-chain
  market (e.g. a CPMM/LMSR contract) fed by the same oracle. The baseline rate maps to a real
  time-value-of-money / staking yield. The `buyShares()` / `prices()` / `costToBuy()` surface is
  what the UI binds to — an on-chain adapter implements the same surface.

### 4. Resolution — simulated → real long-horizon settlement

- **POC:** `resolveMarket()` is triggered by an admin "simulate resolution" control that sets a
  hypothetical future index and settles YES/NO against it, because the POC can't wait years.
- **Real:** resolution is driven by the **oracle** at the horizon date — the market settles against
  the actual measured wellbeing index under the proposal vs. the status-quo baseline. Same
  `resolveMarket(market, measuredIndex, baselineIndex)` signature; the trigger moves from a button to
  a scheduled oracle read.

### 5. Storage — in-memory → database

- **POC:** `server/src/store.ts` is an in-memory model, re-seeded on boot.
- **Real:** a database (SQLite/Postgres) with an **aggregate-only** schema for sentiment. The store
  module is the single file to replace; everything else talks to it through the exported functions.

### 6. Groups — seeded hierarchy → org directory

- **POC:** groups form a one-level hierarchy — a derived **Global** group averages three leaf orgs
  (Community Alpha, Company Beta, Cohort Delta). `current()` / `statsFor()` roll children up.
- **Real:** the same derived-aggregation logic backed by a real org/tenant directory of arbitrary
  depth. Contribution stays leaf-only; every ancestor is a live aggregate.

### 7. Proposals — built-in + imported from existing governance

- **POC:** proposals carry a `source` — either `builtin` (authored here) or `import` (a lightweight
  stub synced from an external system). The seed ships both: some are `builtin`, others are mock
  imports from **Snapshot / Tally / Aragon** with a placeholder `url` the detail page links back to.
  Our copy stays lightweight — title, description, the two signals — and defers to the original.
- **Real:** the `import` variant is produced by an adapter that maps a governance system's proposal
  (Snapshot, Tally / OpenZeppelin Governor, Aragon, DAOhaus, Realms/Colony) onto the `Proposal`
  shape and keeps the canonical `url`. That reframes the product as the **markets + sentiment
  advisory layer** on top of governance you already run — while still letting teams author proposals
  directly. The proposal store / import adapter is the single seam to swap.

### 8. Advisory boundary — unchanged, forever

This is not a mock. **Nothing in the system executes a decision.** The market can lean strongly YES
and the proposal still does not pass on its own — a human reads both signals and decides. Any real
version keeps this boundary; wiring the advisory layer to auto-execute would change what the product
*is*.

## Possible future directions (speculative — not part of the POC, not a commitment)

These are noted for the grant narrative only. None are built here, and none are promises.

- **Play-money → a future token distribution.** Participation in the play-money markets **may or may
  not** inform a future real-token distribution or reward event. This is intentionally left open: it
  is *not* a commitment, *not* an offer or promise of any token, allocation, airdrop, or financial
  value, and would be entirely subject to legal, regulatory, and design review before anything of the
  sort could exist. In the POC, play-money is strictly play-money (see the scope guardrails in
  `README.md`), and the codebase contains no token, wallet, or transfer mechanism. The design keeps
  the door open — the market layer is already isolated behind the `buyShares()` / `resolveMarket()`
  interface — without walking through it.
- **On-chain oracle + markets** as described in seams 1/3/4, making the forecast signal publicly
  verifiable.
- **Federated reference clients** — moood as the first client of an open protocol other apps also
  contribute sentiment to.

## Why this maps to the grant spec

The grant is for an *open sentiment protocol + advisory (futarchy-style) governance*. The POC
demonstrates exactly that flow — open contribution, trust-weighted anonymous aggregation, a
forecast market and a sentiment signal shown side by side, and a strict advisory boundary — with
every "real system" concern (chain, real oracle, real personhood, real resolution) isolated behind
a named interface so the production build is a swap, not a rewrite.
