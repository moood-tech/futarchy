/**
 * The open sentiment protocol's aggregation layer + the index "oracle".
 *
 * Contributions arriving on POST /api/contribute are folded into a per-group
 * running aggregate here and then DISCARDED. Nothing about the contributor is
 * retained — no id, no history, not even a row. Only the accumulators below
 * survive, and they are pure aggregates. (See PRIVACY.md.)
 *
 * Two trust thresholds are exposed, demonstrating that *anonymity* and
 * *uniqueness* are separable:
 *   - `none`     : every response counts, weighted by a trust weight.
 *   - `verified` : only mock-verified responses count. In the seeded demo only
 *                  ~30% of respondents are verified, so the verified index is a
 *                  smaller, higher-trust subset of the whole.
 *
 * "Global" is a DERIVED group: it has no aggregate of its own — its index is the
 * live response-weighted average of its child organizations.
 */

import { db, type VerificationLevel } from "./store.js";

/** Share of seeded respondents who are verified. */
export const VERIFIED_SHARE = 0.3;

/** Trust weight applied to a response at the `none` threshold. */
const TRUST_WEIGHT: Record<VerificationLevel, number> = {
  none: 0.25,
  verified: 1,
};

interface LiveAgg {
  allCount: number; // total responses
  verCount: number; // verified responses (~30% of allCount)
  noneValueSum: number; // Σ value*weight  (all responses)
  noneWeightSum: number; // Σ weight
  verValueSum: number; // Σ value          (verified only)
}

const live = new Map<string, LiveAgg>();

/**
 * Seed each LEAF group's live aggregate from the tail of its historical series,
 * with a synthetic prior "mass" so one fresh contribution nudges the index
 * rather than replacing it. 30% of the prior respondents are verified. Derived
 * groups (Global) get no aggregate — they read their children.
 */
export function initLive(): void {
  live.clear();
  const PRIOR_TOTAL = 200;
  for (const [groupId, group] of db.groups) {
    if (group.derived) continue;
    const series = db.index.get(groupId);
    if (!series || !series.length) continue;
    const last = series[series.length - 1];

    const verCount = Math.round(PRIOR_TOTAL * VERIFIED_SHARE); // 60
    const unverified = PRIOR_TOTAL - verCount; // 140
    // none-threshold weight mass = verified*1 + unverified*0.25
    const noneWeightSum = verCount * TRUST_WEIGHT.verified + unverified * TRUST_WEIGHT.none;

    live.set(groupId, {
      allCount: PRIOR_TOTAL,
      verCount,
      noneValueSum: last.indexNone * noneWeightSum,
      noneWeightSum,
      verValueSum: last.indexVerified * verCount,
    });
  }
}

/**
 * Mock proof-of-personhood check. A real deployment plugs a provider in here
 * (World ID / BrightID / Gitcoin Passport-style) WITHOUT changing this
 * signature — see ARCHITECTURE.md. For the POC any token starting `vp_` passes.
 */
export function verifyToken(token?: string): VerificationLevel {
  return token && token.startsWith("vp_") ? "verified" : "none";
}

export interface ContributeResult {
  level: VerificationLevel;
  indexNone: number;
  indexVerified: number;
}

/**
 * Fold one anonymous contribution into a leaf group's aggregate and return the
 * updated index. The `value` and `level` are used only to move the accumulators
 * and are then out of scope — never stored against anyone.
 */
export function contribute(
  groupId: string,
  value: number,
  level: VerificationLevel,
): ContributeResult {
  const group = db.groups.get(groupId);
  if (!group) throw new Error("unknown group");
  if (group.derived) throw new Error("cannot contribute to a derived (aggregate) group");
  const agg = live.get(groupId);
  if (!agg) throw new Error("no aggregate for group");

  const v = Math.max(0, Math.min(100, value));
  const w = TRUST_WEIGHT[level];

  agg.allCount += 1;
  agg.noneValueSum += v * w;
  agg.noneWeightSum += w;
  if (level === "verified") {
    agg.verCount += 1;
    agg.verValueSum += v;
  }
  // `v`, `level`, and the raw contribution are now discarded. No user record.

  const result = current(groupId);

  // Reflect the live value in today's point on the chart series.
  const series = db.index.get(groupId);
  if (series && series.length) {
    const today = series[series.length - 1];
    today.indexNone = Math.round(result.indexNone * 10) / 10;
    today.indexVerified = Math.round(result.indexVerified * 10) / 10;
  }

  return { level, ...result };
}

/**
 * Current aggregate index for a group at both thresholds. For a derived group
 * (Global) this is the response-weighted average across its children.
 */
export function current(groupId: string): { indexNone: number; indexVerified: number } {
  const group = db.groups.get(groupId);
  if (!group) throw new Error("unknown group");

  if (group.derived) {
    const kids = group.childrenIds ?? [];
    let noneW = 0;
    let noneWV = 0; // weighted-by-count index sums
    let verW = 0;
    let verWV = 0;
    for (const kid of kids) {
      const c = current(kid);
      const s = statsFor(kid);
      noneW += s.allCount;
      noneWV += c.indexNone * s.allCount;
      verW += s.verCount;
      verWV += c.indexVerified * s.verCount;
    }
    return {
      indexNone: noneW > 0 ? noneWV / noneW : 0,
      indexVerified: verW > 0 ? verWV / verW : 0,
    };
  }

  const agg = live.get(groupId);
  if (!agg) throw new Error("no aggregate for group");
  const indexNone = agg.noneValueSum / agg.noneWeightSum;
  const indexVerified = agg.verCount > 0 ? agg.verValueSum / agg.verCount : indexNone;
  return { indexNone, indexVerified };
}

/** Response-count stats: total, verified, and verified share. Rolls up children. */
export function statsFor(groupId: string): {
  allCount: number;
  verCount: number;
  verifiedShare: number;
} {
  const group = db.groups.get(groupId);
  if (!group) throw new Error("unknown group");

  if (group.derived) {
    let all = 0;
    let ver = 0;
    for (const kid of group.childrenIds ?? []) {
      const s = statsFor(kid);
      all += s.allCount;
      ver += s.verCount;
    }
    return { allCount: all, verCount: ver, verifiedShare: all > 0 ? ver / all : 0 };
  }

  const agg = live.get(groupId);
  if (!agg) return { allCount: 0, verCount: 0, verifiedShare: 0 };
  return {
    allCount: agg.allCount,
    verCount: agg.verCount,
    verifiedShare: agg.allCount > 0 ? agg.verCount / agg.allCount : 0,
  };
}

/** The oracle read: the single index value at the requested trust threshold. */
export function oracle(groupId: string, threshold: "none" | "verified"): number {
  const c = current(groupId);
  return threshold === "verified" ? c.indexVerified : c.indexNone;
}
