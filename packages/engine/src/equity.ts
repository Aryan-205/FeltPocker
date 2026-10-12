import { type Card, type Rng, cryptoRng, freshDeck } from "./cards";
import { type Variant, quickScore } from "./evaluator";

export interface EquityResult {
  /** Share of the pot won on average, 0..1 (ties split). */
  equity: number;
  win: number;
  tie: number;
}

/**
 * Monte Carlo equity of `hole` against `opponents` random hands.
 * Fast enough for real-time coaching (~1–2k iterations).
 */
export function estimateEquity(
  variant: Variant,
  hole: Card[],
  board: Card[],
  opponents: number,
  iterations = 1200,
  rng: Rng = cryptoRng,
): EquityResult {
  if (opponents <= 0) return { equity: 1, win: 1, tie: 0 };
  // Omaha hands have 60 five-card combinations vs 21; keep the cost similar.
  if (variant === "omaha") iterations = Math.max(150, Math.round(iterations / 3));
  const used = new Set([...hole, ...board]);
  const stub = freshDeck().filter((c) => !used.has(c));
  const holeCount = variant === "omaha" ? 4 : 2;
  const need = opponents * holeCount + (5 - board.length);
  let share = 0;
  let wins = 0;
  let ties = 0;
  const deck = stub.slice();
  for (let it = 0; it < iterations; it++) {
    // partial Fisher–Yates for just the cards we need
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (deck.length - i));
      const t = deck[i]!;
      deck[i] = deck[j]!;
      deck[j] = t;
    }
    let k = 0;
    const fullBoard = board.slice();
    while (fullBoard.length < 5) fullBoard.push(deck[k++]!);
    const mine = quickScore(variant, hole, fullBoard);
    let best = -1;
    let bestCount = 0;
    for (let o = 0; o < opponents; o++) {
      const oh = deck.slice(k, k + holeCount);
      k += holeCount;
      const sc = quickScore(variant, oh, fullBoard);
      if (sc > best) {
        best = sc;
        bestCount = 1;
      } else if (sc === best) bestCount++;
    }
    if (mine > best) {
      share += 1;
      wins++;
    } else if (mine === best) {
      share += 1 / (bestCount + 1);
      ties++;
    }
  }
  return { equity: share / iterations, win: wins / iterations, tie: ties / iterations };
}

/** Fraction of the final pot you must contribute to call: call / (pot + call). */
export const potOdds = (toCall: number, pot: number) => (toCall <= 0 ? 0 : toCall / (pot + toCall));
