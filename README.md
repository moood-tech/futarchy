# Advisory Governance Module — POC

An **open sentiment protocol** plus an **advisory governance layer**, as a clickable,
local, mock-data proof-of-concept.

Any client can POST anonymous sentiment for a group into an open API; the API publishes an
aggregate **wellbeing index**. Contribution is open, but each contribution carries a (mocked)
**trust weight** — demonstrating that *anonymity* and *uniqueness* are separable. On top, a
decision-maker looks at a proposal through **two independent signals side by side**:

1. **Predicted wellbeing** — a futarchy-style, **play-money** prediction market (LMSR) forecasting
   whether the group's wellbeing index will be higher *under the proposal* than the status quo, across
   **1 / 2 / 3 / 5 / 10 / 20 / 30-year** horizons. Longer horizons pay more: every stake compounds at
   a **baseline (risk-free) rate**, and that baseline is also a floor — a losing bet is still refunded
   with the baseline interest (you forgo the upside, you're not wiped out).
2. **Current sentiment** — the group's live, aggregate positive/negative feeling about the proposal.

**The tool only advises. It never executes anything.** No proposal passes because a market leans
yes — a human reads both signals and decides.

The built-in client stands in as the "first reference client" — this is where **moood** would plug in.

---

## Run it

```bash
npm install
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:4000>

`npm run dev` starts the Express API and the Vite client together (Vite proxies `/api` → `:4000`).
Everything is seeded on boot, so every screen is populated on first run.

Other scripts:

```bash
npm run typecheck   # type-check server + client
npm run build       # production build of the client
```

Requires Node 18+ (developed on Node 24/25).

---

## Screens

| Route | What it is |
|---|---|
| `/` | **Dashboard** — the group's wellbeing index (~2y time-series), summary tiles, trust-threshold toggle. |
| `/proposals` | **Proposal list** — one card per decision, each showing both signals at a glance. |
| `/proposals/:id` | **Proposal detail (the core screen)** — the two signals side by side + the advisory note. |
| `/portfolio` | **Play-money portfolio + leaderboard** — your session's positions and the ranking. |
| `/how-it-works` | **Plain-language explainer** — the two signals, the anonymity property, the advisory boundary. |

---

## The open protocol API

The API is deliberately the "protocol surface" — the thing a reference client (like moood) plugs into.

| Method & path | Purpose |
|---|---|
| `POST /api/contribute` | **Open contribution.** Body `{ groupId, value, verificationToken? }`. Anyone can call it. Folded into the aggregate immediately; **never stored against a user.** A `vp_`-prefixed token mock-verifies (higher trust weight). |
| `GET /api/index/:groupId?threshold=none\|verified` | **The oracle.** Aggregate index (0–100) at the chosen trust threshold, plus the historical series and response counts (only ~30% of respondents are verified). |
| `GET /api/groups`, `/api/groups/:id` | Group list / summary tiles. |
| `GET /api/proposals?groupId=`, `/api/proposals/:id` | Proposal summaries / detail (with markets). |
| `POST /api/proposals/:id/pulse` | Increment the aggregate current-sentiment counter (`{ direction: "positive"\|"negative" }`). Counts only. |
| `POST /api/markets/:id/quote` | Non-mutating LMSR cost quote for the buy UI. |
| `POST /api/markets/:id/buy` | Buy play-money YES/NO shares. |
| `POST /api/markets/:id/resolve` | **Simulate resolution** (admin) — settle against a hypothetical future index. |
| `GET /api/leaderboard`, `/api/players/:id` | Play-money leaderboard / portfolio. |

Quick tour with `curl`:

```bash
# publish anonymous sentiment to a leaf org (verified). Contributing to the
# derived "Global" group is rejected — it only aggregates its children.
curl -sX POST localhost:4000/api/contribute -H 'content-type: application/json' \
  -d '{"groupId":"grp_company","value":85,"verificationToken":"vp_demo"}'

# read the oracle at the verified threshold
curl -s 'localhost:4000/api/index/grp_company?threshold=verified'
```

### Groups

**Global** is a derived, top-level group that rolls up three leaf organizations —
**Community Alpha**, **Company Beta**, and **Cohort Delta**. Its index is the live
response-weighted average of its children; you contribute to the leaves, not to Global.

---

## POC scope / what's mocked

This is a wireframe-grade POC. It demonstrates the end-to-end flow and a clean architecture the
real version can slot into — **not** a production system.

**Mocked / simplified:**

- **No blockchain, wallets, tokens, or real money.** The prediction market is a pure in-memory LMSR
  with play-money balances.
- **Verification is mocked** — any `vp_`-prefixed token counts as "verified". Real proof-of-personhood
  providers (World ID / BrightID / Gitcoin Passport-style) plug in at `verifyToken()` without changing
  the interface. See `ARCHITECTURE.md`.
- **Resolution is simulated** — real markets resolve years out, so an admin "simulate resolution"
  control sets a hypothetical future index and settles against it. Clearly labelled as a simulation.
- **Storage is in-memory** and re-seeded on every boot (SQLite/Postgres swaps in behind the same
  interface). The sentiment index and market participants are **seeded** so screens are populated.
- **No authentication / accounts / multi-tenancy.** The play-money "player" is a `localStorage`
  session handle — a leaderboard nickname, not an identity.

**Not mocked — real by design:**

- The **anonymity invariant**: no sentiment response is ever stored against an individual. See
  `PRIVACY.md`. This is a core property, not a shortcut.
- The **LMSR** market maths (cost function, softmax pricing, deterministic) and the
  **baseline-rate payout** model (winning shares redeem at `(1+r)^years`; a losing stake is
  refunded at the same baseline — so longer horizons pay more and losers still keep the baseline).
- The **anonymity property**: verified is a real 30%-of-respondents subset, computed without ever
  storing who contributed.
- The **advisory boundary**: nothing here executes a decision.

**Explicitly out of scope:** blockchain, smart contracts, wallets, tokens, real money, real
long-horizon resolution, authentication, multi-tenant accounts, production security hardening.

---

## Design

Built on the canonical **moood** design system. The brand tokens in
`client/src/styles/tokens.css` are vendored verbatim from `@moood/design-system` (the same
`dist/css/tokens.css` the real apps consume), and the Tailwind theme maps onto them. Geist for
headings, Inter for body, IBM Plex Mono for `// eyebrow` labels; cyan `#33b1ff` is used for CTAs
only; the purple emphasis system marks the "our-side" forecast surfaces.

## Layout

```
server/   Express + TypeScript API (in-memory store, LMSR, seed)
  src/lmsr.ts        LMSR market maker (pure maths)
  src/store.ts       in-memory data model (aggregate-only — see PRIVACY.md)
  src/sentiment.ts   open-protocol aggregation + the index oracle
  src/market.ts      buy / resolve operations
  src/seed.ts        deterministic demo seed (~2y index, proposals, trades)
  src/views.ts       API serializers
  src/index.ts       routes
client/   React + Vite + TypeScript + Tailwind + Recharts
```

See also `PRIVACY.md` and `ARCHITECTURE.md`.
