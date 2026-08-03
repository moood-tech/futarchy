/**
 * Deterministic seed so every screen is populated on first run.
 *
 * Produces: 2 groups, ~2 years of weekly wellbeing-index points each, a handful
 * of proposals (one rich "core" proposal), 1y/3y/5y LMSR markets per proposal,
 * mock play-money players, and seed trades so prices aren't flat.
 *
 * NB: none of the sentiment seed is per-user. The index series is aggregate and
 * the proposal pulses are counts only — consistent with the anonymity invariant.
 */

import { buyShares } from "./market.js";
import {
  HORIZONS,
  STARTING_BALANCE,
  db,
  getOrCreatePlayer,
  nextId,
  type Group,
  type GroupDocument,
  type Horizon,
  type IndexPoint,
  type Market,
  type Proposal,
} from "./store.js";

/** mulberry32 — tiny deterministic PRNG so the demo is identical every boot. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Governing documents (each group's constitution / contract / law set) ──────
// A proposal is a proposed edit to one of these. The diff is the proposal.
const COMPANY_DOC = `# Company Beta Working Policy

## 1. Working week
The standard working week is five days, Monday to Friday.
Core hours are 09:00 to 17:00.
Overtime is compensated at time and a half.

## 2. Location
Attendance is remote-first.
In-person attendance is optional.
Desk space is available on request.

## 3. Time off
Employees accrue 25 days of paid leave per year.
Unused leave may carry over for one year.

## 4. Meetings
Meetings may be booked by any employee.
There is no cap on meeting hours.`;

const COMMUNITY_DOC = `# Community Alpha Charter

## 1. Membership
Membership is open to anyone.
New members are welcomed by a host.

## 2. Moderation
Moderators are appointed by the founders.
Moderators serve for an indefinite term.
Decisions are final.

## 3. Decisions
Day-to-day decisions are made by the founders.`;

const COHORT_DOC = `# Cohort Delta Agreement

## 1. Structure
The cohort works together as a single collective.
Progress is reviewed weekly.

## 2. Support
Support is provided by programme staff.
Office hours are held twice a week.

## 3. Term
The term runs for twelve weeks.`;

// A second document in each group's repository (so there's a choice to make).
const COMPANY_CONDUCT = `# Company Beta Code of Conduct

## 1. Respect
Treat colleagues with respect and good faith.

## 2. Confidentiality
Company information is confidential unless marked public.`;

const COMMUNITY_GUIDELINES = `# Community Alpha Posting Guidelines

## 1. Tone
Be constructive and kind.

## 2. Spam
Self-promotion is limited to the weekly thread.`;

const COHORT_SYLLABUS = `# Cohort Delta Syllabus

## 1. Weeks 1 to 4
Foundations and onboarding.

## 2. Weeks 5 to 12
Project work and review.`;

const COMPANY_REPO: GroupDocument[] = [
  { id: "doc_company_policy", name: "Working Policy", path: "policies/working-policy.md", content: COMPANY_DOC },
  { id: "doc_company_conduct", name: "Code of Conduct", path: "legal/code-of-conduct.md", content: COMPANY_CONDUCT },
];
const COMMUNITY_REPO: GroupDocument[] = [
  { id: "doc_community_charter", name: "Charter", path: "governance/charter.md", content: COMMUNITY_DOC },
  { id: "doc_community_guidelines", name: "Posting Guidelines", path: "community/posting-guidelines.md", content: COMMUNITY_GUIDELINES },
];
const COHORT_REPO: GroupDocument[] = [
  { id: "doc_cohort_agreement", name: "Agreement", path: "program/agreement.md", content: COHORT_DOC },
  { id: "doc_cohort_syllabus", name: "Syllabus", path: "program/syllabus.md", content: COHORT_SYLLABUS },
];

const ALL_DOCS: Record<string, GroupDocument> = Object.fromEntries(
  [...COMPANY_REPO, ...COMMUNITY_REPO, ...COHORT_REPO].map((d) => [d.id, d]),
);

// Which document in the repository each seeded proposal changes.
const PROPOSAL_TARGET: Record<string, string> = {
  prop_fourday: "doc_company_policy",
  prop_office: "doc_company_policy",
  prop_sabbatical: "doc_company_policy",
  prop_company_async: "doc_company_policy",
  prop_community_mod: "doc_community_charter",
  prop_cohort_pods: "doc_cohort_agreement",
};

/** Produce a proposed document by replacing a clause in the base document. */
const withEdit = (doc: string, from: string, to: string) => doc.replace(from, to);

// The proposed document for each seeded proposal (its edit to the group doc).
const PROPOSED_DOCS: Record<string, string> = {
  prop_fourday: withEdit(
    COMPANY_DOC,
    `The standard working week is five days, Monday to Friday.
Core hours are 09:00 to 17:00.
Overtime is compensated at time and a half.`,
    `The standard working week is four days, Monday to Thursday.
Fridays are protected as no-meeting recovery time.
Core hours are 09:00 to 16:00.
Overtime is discouraged and must be pre-approved.`,
  ),
  prop_office: withEdit(
    COMPANY_DOC,
    `Attendance is remote-first.
In-person attendance is optional.
Desk space is available on request.`,
    `Attendance is required in person Tuesday, Wednesday, and Thursday.
Monday and Friday are remote by default.
Every employee has an assigned desk.`,
  ),
  prop_sabbatical: withEdit(
    COMPANY_DOC,
    `Employees accrue 25 days of paid leave per year.
Unused leave may carry over for one year.`,
    `Employees accrue 30 days of paid leave per year.
Leave may carry over without limit.
After four years of tenure, employees receive a six-week paid sabbatical.`,
  ),
  prop_company_async: withEdit(
    COMPANY_DOC,
    `Meetings may be booked by any employee.
There is no cap on meeting hours.`,
    `Written, asynchronous updates are the default.
Booking a synchronous meeting requires a stated reason.
Meeting-free Wednesdays are protected.`,
  ),
  prop_community_mod: withEdit(
    COMMUNITY_DOC,
    `Moderators are appointed by the founders.
Moderators serve for an indefinite term.
Decisions are final.`,
    `Moderators are elected by the community.
Terms last six months and rotate.
Decisions may be appealed to a community vote.`,
  ),
  prop_cohort_pods: withEdit(
    COHORT_DOC,
    `Support is provided by programme staff.
Office hours are held twice a week.`,
    `Support is provided by programme staff and peer mentors.
Members are grouped into pods of four to six.
Pods meet at least twice a week.`,
  ),
};

/**
 * Build a weekly index series ending today: a gentle sine-driven baseline plus
 * a seeded random walk. `indexVerified` (trust-weighted) tracks the same shape
 * but is smoother and holds a slightly higher floor, illustrating that verified
 * contributions denoise the signal.
 */
function buildSeries(seed: number, weeks: number, center: number): IndexPoint[] {
  const rng = makeRng(seed);
  const points: IndexPoint[] = [];
  const today = new Date();
  let walk = 0;
  let verifiedEwma = center;

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);

    const season = Math.sin((i / 26) * Math.PI) * 6; // ~yearly swell
    walk = clamp(walk + (rng() - 0.5) * 6, -14, 14);
    const noise = (rng() - 0.5) * 5;

    const none = clamp(center + season + walk + noise, 5, 95);
    verifiedEwma = verifiedEwma * 0.7 + (center + season + walk) * 0.3;
    const verified = clamp(verifiedEwma + 2, 5, 95);

    points.push({
      date: isoDay(d),
      indexNone: Math.round(none * 10) / 10,
      indexVerified: Math.round(verified * 10) / 10,
    });
  }
  return points;
}

function makeMarkets(proposalId: string, scope: "internal" | "external"): Market[] {
  return HORIZONS.map(({ key, years }) => ({
    id: nextId("mkt"),
    proposalId,
    scope,
    horizon: key,
    years,
    lmsr: { b: 100, qYes: 0, qNo: 0 },
    history: [{ t: 0, yes: 0.5 }],
  }));
}

export function seed(): void {
  // Reset (used by tests / re-seed).
  db.groups.clear();
  db.index.clear();
  db.proposals.clear();
  db.markets.clear();
  db.players.clear();
  db.trades.length = 0;

  const now = Date.now();

  // ── Groups + 2y wellbeing index ──────────────────────────────────────────
  // "Public" holds every signal that is not part of a named collective: open to
  // everyone and anonymous. It is NOT an aggregate of the collectives — they are separate.
  const global: Group = {
    id: "grp_global",
    name: "Public",
    description:
      "All signals that are not part of a collective. Anyone can propose and contribute anonymously.",
  };
  const leaves: Group[] = [
    {
      id: "grp_community",
      name: "Community Alpha",
      description:
        "An open community piloting the sentiment protocol. Contribution is public and anonymous.",
      documents: COMMUNITY_REPO,
    },
    {
      id: "grp_company",
      name: "Company Beta",
      description: "A ~120-person company running moood company-wide.",
      documents: COMPANY_REPO,
    },
    {
      id: "grp_cohort",
      name: "Cohort Delta",
      description: "A time-boxed programme cohort tracking wellbeing through an intense term.",
      documents: COHORT_REPO,
    },
  ];

  // Insert Global first so it's the default dashboard view.
  db.groups.set(global.id, global);
  for (const g of leaves) db.groups.set(g.id, g);

  db.index.set("grp_global", buildSeries(555, 104, 61));
  db.index.set("grp_community", buildSeries(9001, 104, 55));
  db.index.set("grp_company", buildSeries(1337, 104, 66));
  db.index.set("grp_cohort", buildSeries(2718, 104, 48));

  // ── Mock players (play-money leaderboard only) ────────────────────────────
  const mockPlayers = [
    { id: "plr_ada", handle: "ada" },
    { id: "plr_grace", handle: "grace" },
    { id: "plr_linus", handle: "linus" },
    { id: "plr_margaret", handle: "margaret" },
  ];
  for (const mp of mockPlayers) getOrCreatePlayer(mp.id, mp.handle);
  // Seed trades are a fixed count per market, and there are now two market sets
  // (internal + external) per motion. Give the seed traders a deep balance so
  // every seed trade lands; their cash is reset to STARTING_BALANCE afterward.
  for (const mp of mockPlayers) getOrCreatePlayer(mp.id).balance = 100_000_000;

  // ── Proposals ─────────────────────────────────────────────────────────────
  const DURATIONS: Record<string, number> = {
    prop_feeling: 1,
    prop_public_disconnect: 45,
    prop_public_mhdays: 45,
    prop_fourday: 60,
    prop_office: 30,
    prop_rnd_profit: 45,
    prop_relocate: 60,
    prop_sabbatical: 90,
    prop_community_mod: 30,
    prop_company_async: 30,
    prop_cohort_pods: 21,
  };

  const proposals: Array<
    Omit<
      Proposal,
      "createdAt" | "status" | "pulse" | "signalStart" | "signalEnd" | "tradingEnabled" | "naked"
    > & {
      ageDays: number;
      pulse: { positive: number; negative: number };
      seedLean: number; // target implied P(yes) at the 1y horizon after seeding
      // Optional per-horizon target override, for a deliberate term structure
      // (e.g. fine now, heavily bearish by year 5). Falls back to seedLean +
      // pull-to-50/50 for any horizon not listed.
      horizonLeans?: Partial<Record<Horizon, number>>;
      // The external market (effect on the wider public's index). When omitted,
      // the external market mirrors the internal one (an aligned scenario).
      externalSeedLean?: number;
      externalHorizonLeans?: Partial<Record<Horizon, number>>;
      tradingEnabled?: boolean; // default true
      naked?: boolean; // default false
    }
  > = [
    {
      id: "prop_feeling",
      groupId: "grp_global",
      source: {
        kind: "import",
        system: "moood",
        url: "https://app.moood.tech/checkin",
        ref: "moood app · daily check-in",
      },
      title: "How are you feeling?",
      description:
        "The daily wellbeing check-in from the moood app. A naked signal: no trading and no motion. It baselines a collective's long-term sentiment, the index that every motion's forecast market is judged against.",
      owner: "moood",
      naked: true,
      tradingEnabled: false,
      ageDays: 0,
      pulse: { positive: 3400, negative: 1600 },
      seedLean: 0.6,
    },
    {
      id: "prop_public_disconnect",
      groupId: "grp_global",
      source: {
        kind: "import",
        system: "Snapshot",
        url: "https://snapshot.org/#/public.moood.eth/proposal/0x7ac41e0b",
        ref: "public.moood.eth · 0x7ac4…1e0b",
      },
      title: "Establish a right to disconnect after work hours",
      description:
        "A public standard that no one is expected to answer work messages outside working hours. Tests whether protected downtime lifts general wellbeing.",
      owner: "Digital Rights Collective",
      ageDays: 3,
      pulse: { positive: 1240, negative: 85 },
      seedLean: 0.9,
      externalSeedLean: 0.84, // aligned: good for the collective and the public
    },
    {
      id: "prop_public_mhdays",
      groupId: "grp_global",
      source: { kind: "builtin" },
      title: "Make mental-health days a standard entitlement",
      description:
        "Recognise mental-health days as ordinary leave everywhere, no explanation required. Question is whether it meaningfully improves sustained wellbeing.",
      owner: "Grace Okoro",
      ageDays: 6,
      pulse: { positive: 540, negative: 210 },
      seedLean: 0.6,
    },
    {
      id: "prop_fourday",
      groupId: "grp_global",
      source: {
        kind: "import",
        system: "Snapshot",
        url: "https://snapshot.org/#/public.moood.eth/proposal/0x4d0a9c1f",
        ref: "public.moood.eth · 0x4d0a…9c1f",
      },
      title: "Shift to a four-day work week",
      description:
        "Adopt a permanent Mon to Thu schedule at full pay, protecting Fridays as no-meeting recovery time. Proponents argue it lifts sustained wellbeing; skeptics worry about delivery pressure compressing into four days.",
      owner: "Future of Work Forum",
      ageDays: 9,
      pulse: { positive: 90, negative: 1180 },
      seedLean: 0.12,
    },
    {
      id: "prop_office",
      groupId: "grp_company",
      source: {
        kind: "import",
        system: "Tally",
        url: "https://www.tally.xyz/gov/moood/proposal/72",
        ref: "moood · Governor #72",
      },
      title: "Return to office three days a week",
      description:
        "Require in-person attendance Tue/Wed/Thu. Intended to strengthen collaboration, with a real risk of eroding the flexibility people currently value.",
      ageDays: 5,
      pulse: { positive: 71, negative: 121 },
      seedLean: 0.37,
      externalSeedLean: 0.52, // divergent: weak for the company, roughly neutral for the public
    },
    {
      id: "prop_rnd_profit",
      groupId: "grp_company",
      source: { kind: "builtin" },
      title: "Redirect R&D budget into profit-sharing",
      description:
        "Move a large share of the annual R&D budget into direct profit distribution to staff, raising take-home pay now. The open question is whether trading long-term investment for near-term cash holds up beyond a five-year horizon.",
      owner: "Company Beta · Finance WG",
      ageDays: 4,
      pulse: { positive: 205, negative: 24 },
      seedLean: 0.5,
      // Staff want it now (high sentiment), but the market turns heavily bearish
      // from year five onward as the lost R&D investment is priced in.
      horizonLeans: { "1y": 0.5, "2y": 0.4, "3y": 0.29, "5y": 0.12, "10y": 0.08, "20y": 0.06, "30y": 0.05 },
      externalSeedLean: 0.14, // aligned negative: cutting R&D also drags on the wider public
    },
    {
      id: "prop_relocate",
      groupId: "grp_company",
      source: { kind: "builtin" },
      title: "Relocate operations to a lower-cost region",
      description:
        "Move core operations to cut costs and lift margins. The market expects this to help the company while pulling jobs and spending out of the current community.",
      owner: "Company Beta · Strategy",
      ageDays: 3,
      pulse: { positive: 104, negative: 68 },
      seedLean: 0.73, // internal: good for the company
      externalSeedLean: 0.14, // polar opposite: bad for the wider public
    },
    {
      id: "prop_sabbatical",
      groupId: "grp_company",
      source: { kind: "builtin" },
      title: "Introduce a 6-week paid sabbatical every 4 years",
      description:
        "A tenure-based sabbatical to prevent long-run burnout. Question is whether the wellbeing lift is durable across the 3–5 year horizon or fades after the break.",
      ageDays: 2,
      pulse: { positive: 96, negative: 18 },
      seedLean: 0.61,
    },
    {
      id: "prop_community_mod",
      groupId: "grp_community",
      source: {
        kind: "import",
        system: "Aragon",
        url: "https://app.aragon.org/#/daos/ethereum/community-alpha.dao.eth/proposals/18",
        ref: "community-alpha.dao.eth · #18",
      },
      title: "Adopt community-elected moderation",
      description:
        "Replace appointed moderators with a rotating, community-elected panel. Tests whether distributed governance improves the collective's felt wellbeing.",
      ageDays: 12,
      pulse: { positive: 210, negative: 140 },
      seedLean: 0.54,
    },
    {
      id: "prop_company_async",
      groupId: "grp_company",
      source: { kind: "builtin" },
      title: "Go async-first: no default-sync meetings",
      description:
        "Make written, asynchronous updates the default and require an explicit reason to book a synchronous meeting. Aims to protect focus time — with a risk of slower decisions.",
      ageDays: 7,
      pulse: { positive: 132, negative: 44 },
      seedLean: 0.63,
    },
    {
      id: "prop_cohort_pods",
      groupId: "grp_cohort",
      source: {
        kind: "import",
        system: "Snapshot",
        url: "https://snapshot.org/#/cohort-delta.eth/proposal/0x9b3e77a2",
        ref: "cohort-delta.eth · 0x9b3e…77a2",
      },
      title: "Introduce peer mentorship pods",
      description:
        "Cluster the cohort into small standing pods with a peer mentor, to buffer the intensity of the term. Question is whether the support outlasts the novelty.",
      ageDays: 4,
      pulse: { positive: 88, negative: 26 },
      seedLean: 0.58,
    },
  ];

  const rng = makeRng(4242);

  for (const p of proposals) {
    const proposedDoc = PROPOSED_DOCS[p.id];
    const targetDoc = ALL_DOCS[PROPOSAL_TARGET[p.id]];
    const changes =
      proposedDoc && targetDoc
        ? [
            {
              documentId: targetDoc.id,
              documentName: targetDoc.name,
              baseDoc: targetDoc.content,
              proposedDoc,
            },
          ]
        : undefined;
    const createdAt = now - p.ageDays * 86_400_000;
    const tradingEnabled = p.tradingEnabled ?? true;
    const naked = p.naked ?? false;
    const proposal: Proposal = {
      id: p.id,
      groupId: p.groupId,
      title: p.title,
      description: p.description,
      source: p.source,
      status: "open",
      createdAt,
      signalStart: createdAt,
      signalEnd: createdAt + (DURATIONS[p.id] ?? 30) * 86_400_000,
      changes,
      tradingEnabled,
      naked,
      owner: p.owner,
      pulse: p.pulse,
    };
    db.proposals.set(p.id, proposal);

    // Sentiment-only signals (trading off, e.g. the daily check-in) have no market.
    if (!tradingEnabled) continue;

    // Seed a few trades per market so prices sit near the target lean (longer
    // horizons a touch more uncertain, i.e. pulled back toward 50/50). Each
    // motion carries two market sets: internal (the collective's own index) and
    // external (the wider public's). With no external lean given, the external
    // market mirrors the internal one (an aligned scenario).
    const horizonPull: Record<Horizon, number> = {
      "1y": 0,
      "2y": 0.15,
      "3y": 0.28,
      "5y": 0.42,
      "10y": 0.6,
      "20y": 0.72,
      "30y": 0.8,
    };
    const hasExternal =
      p.externalSeedLean !== undefined || p.externalHorizonLeans !== undefined;
    const scopes = [
      { scope: "internal" as const, lean: p.seedLean, horizonLeans: p.horizonLeans },
      hasExternal
        ? {
            scope: "external" as const,
            lean: p.externalSeedLean ?? p.seedLean,
            horizonLeans: p.externalHorizonLeans,
          }
        : { scope: "external" as const, lean: p.seedLean, horizonLeans: p.horizonLeans },
    ];
    for (const s of scopes) {
      const markets = makeMarkets(p.id, s.scope);
      for (const m of markets) db.markets.set(m.id, m);
      for (const m of markets) {
        const target =
          s.horizonLeans?.[m.horizon] ??
          s.lean + (0.5 - s.lean) * horizonPull[m.horizon];
        // More trades the further the target sits from 50/50, so extreme,
        // confident markets actually reach their target rather than undershoot.
        const rounds = 5 + Math.floor(rng() * 4) + Math.round(Math.abs(0.5 - target) * 26);
        for (let i = 0; i < rounds; i++) {
          const impliedYes =
            Math.exp(m.lmsr.qYes / m.lmsr.b) /
            (Math.exp(m.lmsr.qYes / m.lmsr.b) + Math.exp(m.lmsr.qNo / m.lmsr.b));
          const side = impliedYes < target ? "yes" : "no";
          const shares = 8 + Math.floor(rng() * 22);
          const player = mockPlayers[Math.floor(rng() * mockPlayers.length)];
          try {
            buyShares(m, player.id, side, shares, proposal.createdAt + i * 3_600_000);
          } catch {
            // Player ran low on play-money; skip this seed trade.
          }
        }
      }
    }
  }

  // Reset the seed traders' cash so the leaderboard starts from a normal balance.
  for (const mp of mockPlayers) getOrCreatePlayer(mp.id).balance = STARTING_BALANCE;

  const totalTrades = db.trades.length;
  const totalPoints = [...db.index.values()].reduce((n, s) => n + s.length, 0);
  console.log(
    `[seed] ${db.groups.size} groups, ${totalPoints} index points, ` +
      `${db.proposals.size} proposals, ${db.markets.size} markets, ` +
      `${totalTrades} seed trades, ${db.players.size} players ` +
      `(starting balance ${STARTING_BALANCE}).`,
  );
}
