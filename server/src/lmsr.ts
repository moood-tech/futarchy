/**
 * LMSR — Logarithmic Market Scoring Rule (Hanson).
 *
 * A simple, deterministic automated market maker for the play-money prediction
 * markets. Two outcomes per market: YES and NO.
 *
 *   Cost function:   C(q) = b * ln( Σ_i e^(q_i / b) )
 *   Marginal price:  p_i  = e^(q_i / b) / Σ_j e^(q_j / b)   (a softmax)
 *
 * `b` is the liquidity parameter: larger b => deeper market, prices move less
 * per share, and the maximum subsidy/loss the maker can take is b * ln(n).
 *
 * All maths here is pure and side-effect free so it is trivial to unit-test and
 * reason about. Everything is play-money — see PRIVACY.md / ARCHITECTURE.md.
 */

export type Side = "yes" | "no";

export interface LmsrState {
  b: number;
  qYes: number;
  qNo: number;
}

/** Numerically stable log-sum-exp over the two outcome quantities. */
function logSumExp(qYes: number, qNo: number, b: number): number {
  const a = qYes / b;
  const c = qNo / b;
  const m = Math.max(a, c);
  return m + Math.log(Math.exp(a - m) + Math.exp(c - m));
}

/** Total cost held by the market maker for the given outstanding shares. */
export function cost(state: LmsrState): number {
  return state.b * logSumExp(state.qYes, state.qNo, state.b);
}

/** Instantaneous implied probability (price in [0,1]) of each outcome. */
export function prices(state: LmsrState): { yes: number; no: number } {
  const a = state.qYes / state.b;
  const c = state.qNo / state.b;
  const m = Math.max(a, c);
  const ea = Math.exp(a - m);
  const ec = Math.exp(c - m);
  const sum = ea + ec;
  return { yes: ea / sum, no: ec / sum };
}

/** Price of a single side, for convenience. */
export function priceOf(state: LmsrState, side: Side): number {
  const p = prices(state);
  return side === "yes" ? p.yes : p.no;
}

/**
 * Cost (in play-money) to buy `shares` of `side`. Positive = you pay.
 * Selling is expressed as a negative share count and returns a negative cost
 * (a payout). The state is NOT mutated — caller applies the delta on success.
 */
export function costToBuy(state: LmsrState, side: Side, shares: number): number {
  const next: LmsrState =
    side === "yes"
      ? { ...state, qYes: state.qYes + shares }
      : { ...state, qNo: state.qNo + shares };
  return cost(next) - cost(state);
}

/** Return a new state with `shares` of `side` added to the outstanding pool. */
export function applyTrade(state: LmsrState, side: Side, shares: number): LmsrState {
  return side === "yes"
    ? { ...state, qYes: state.qYes + shares }
    : { ...state, qNo: state.qNo + shares };
}
