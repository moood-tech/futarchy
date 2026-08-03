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
  unverValueSum: number; // Σ value          (all responses, equal weight)
  weightedValueSum: number; // Σ value*weight (all responses, trust-weighted)
  weightedWeightSum: number; // Σ weight
  verValueSum: number; // Σ value            (verified only)
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
    const unverifiedCount = PRIOR_TOTAL - verCount; // 140
    // weighted mass = verified*1 + unverified*0.25
    const weightedWeightSum =
      verCount * TRUST_WEIGHT.verified + unverifiedCount * TRUST_WEIGHT.none;

    live.set(groupId, {
      allCount: PRIOR_TOTAL,
      verCount,
      unverValueSum: last.indexUnverified * PRIOR_TOTAL,
      weightedValueSum: last.indexWeighted * weightedWeightSum,
      weightedWeightSum,
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
  indexUnverified: number;
  indexVerified: number;
  indexWeighted: number;
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
  agg.unverValueSum += v;
  agg.weightedValueSum += v * w;
  agg.weightedWeightSum += w;
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
    today.indexUnverified = Math.round(result.indexUnverified * 10) / 10;
    today.indexVerified = Math.round(result.indexVerified * 10) / 10;
    today.indexWeighted = Math.round(result.indexWeighted * 10) / 10;
  }

  return { level, ...result };
}

/**
 * Current aggregate index for a group at both thresholds. For a derived group
 * (Global) this is the response-weighted average across its children.
 */
export function current(groupId: string): {
  indexUnverified: number;
  indexVerified: number;
  indexWeighted: number;
} {
  const group = db.groups.get(groupId);
  if (!group) throw new Error("unknown group");

  if (group.derived) {
    const kids = group.childrenIds ?? [];
    let allW = 0;
    let unverWV = 0; // index sums weighted by response count
    let wtW = 0;
    let wtWV = 0;
    let verW = 0;
    let verWV = 0;
    for (const kid of kids) {
      const c = current(kid);
      const s = statsFor(kid);
      allW += s.allCount;
      unverWV += c.indexUnverified * s.allCount;
      // weighted mass ≈ verified*1 + unverified*0.25
      const mass =
        s.verCount * TRUST_WEIGHT.verified + (s.allCount - s.verCount) * TRUST_WEIGHT.none;
      wtW += mass;
      wtWV += c.indexWeighted * mass;
      verW += s.verCount;
      verWV += c.indexVerified * s.verCount;
    }
    return {
      indexUnverified: allW > 0 ? unverWV / allW : 0,
      indexVerified: verW > 0 ? verWV / verW : 0,
      indexWeighted: wtW > 0 ? wtWV / wtW : 0,
    };
  }

  const agg = live.get(groupId);
  if (!agg) throw new Error("no aggregate for group");
  const indexUnverified = agg.allCount > 0 ? agg.unverValueSum / agg.allCount : 0;
  const indexWeighted = agg.weightedWeightSum > 0 ? agg.weightedValueSum / agg.weightedWeightSum : 0;
  const indexVerified = agg.verCount > 0 ? agg.verValueSum / agg.verCount : indexWeighted;
  return { indexUnverified, indexVerified, indexWeighted };
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
export function oracle(
  groupId: string,
  threshold: "unverified" | "verified" | "weighted",
): number {
  const c = current(groupId);
  if (threshold === "verified") return c.indexVerified;
  if (threshold === "unverified") return c.indexUnverified;
  return c.indexWeighted;
}
