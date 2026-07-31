/**
 * Play-money market operations. Shared by the seed script and the HTTP API so
 * there is exactly one code path that moves LMSR state + player balances.
 */

import { applyTrade, costToBuy, prices, type Side } from "./lmsr.js";
import {
  db,
  getOrCreatePlayer,
  nextId,
  type Market,
  type Trade,
} from "./store.js";

export interface BuyResult {
  trade: Trade;
  balance: number;
  impliedYes: number;
}

/**
 * Buy `shares` of `side` in `market` for `playerId` at play-money cost.
 * Mutates the market's LMSR state, the player's balance + positions, appends a
 * trade and a price-history sample. Throws on insufficient balance.
 */
export function buyShares(
  market: Market,
  playerId: string,
  side: Side,
  shares: number,
  t: number,
): BuyResult {
  if (!(shares > 0)) throw new Error("shares must be positive");

  const player = getOrCreatePlayer(playerId);
  const cost = costToBuy(market.lmsr, side, shares);
  if (cost > player.balance + 1e-9) {
    throw new Error("insufficient play-money balance");
  }

  // Apply LMSR state change.
  market.lmsr = applyTrade(market.lmsr, side, shares);

  // Debit player + credit shares.
  player.balance -= cost;
  const pos = player.positions[market.id] || { yes: 0, no: 0 };
  pos[side] += shares;
  player.positions[market.id] = pos;

  const trade: Trade = {
    id: nextId("trade"),
    marketId: market.id,
    side,
    shares,
    cost,
    playerId,
    t,
  };
  db.trades.push(trade);

  const p = prices(market.lmsr);
  market.history.push({ t, yes: p.yes });

  return { trade, balance: player.balance, impliedYes: p.yes };
}
