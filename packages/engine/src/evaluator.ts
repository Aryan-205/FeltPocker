import { type Card, rankOf, suitOf, RANK_NAMES, RANK_PLURALS } from "./cards";

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  Trips = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  Quads = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: "High Card",
  [HandCategory.Pair]: "One Pair",
  [HandCategory.TwoPair]: "Two Pair",
  [HandCategory.Trips]: "Three of a Kind",
  [HandCategory.Straight]: "Straight",
  [HandCategory.Flush]: "Flush",
  [HandCategory.FullHouse]: "Full House",
  [HandCategory.Quads]: "Four of a Kind",
  [HandCategory.StraightFlush]: "Straight Flush",
  [HandCategory.RoyalFlush]: "Royal Flush",
};

export interface HandValue {
  /** Higher is better; comparable across any two hands. */
  score: number;
  category: HandCategory;
  /** Ranks that decide the hand, most significant first (e.g. trips rank, then kickers). */
  ranks: number[];
  /** The best five cards. */
  cards: Card[];
  name: string;
}


const CNT = new Int8Array(13);
const B = 16 ** 5;
const P4 = 16 ** 4, P3 = 16 ** 3, P2 = 16 ** 2;

/** Fast, allocation-free score of exactly five cards. */
export function score5(a: Card, b: Card, c: Card, d: Card, e: Card): number {
  const flush = (((a ^ b) | (a ^ c) | (a ^ d) | (a ^ e)) & 3) === 0;
  const r0 = a >> 2, r1 = b >> 2, r2 = c >> 2, r3 = d >> 2, r4 = e >> 2;
  const mask = (1 << r0) | (1 << r1) | (1 << r2) | (1 << r3) | (1 << r4);
  let distinct = 0;
  for (let m = mask; m; m &= m - 1) distinct++;

  if (distinct === 5) {
    let straightHigh = -1;
    const low = 31 - Math.clz32(mask & -mask);
    if (mask >> low === 0x1f) straightHigh = low + 4;
    else if (mask === 0x100f) straightHigh = 3; // wheel A-2-3-4-5
    if (straightHigh >= 0)
      return (flush ? (straightHigh === 12 ? HandCategory.RoyalFlush : HandCategory.StraightFlush) : HandCategory.Straight) * B + straightHigh * P4;
    let s = flush ? HandCategory.Flush : HandCategory.HighCard;
    for (let r = 12; r >= 0; r--) if (mask & (1 << r)) s = s * 16 + r;
    return s;
  }

  CNT[r0] = 0; CNT[r1] = 0; CNT[r2] = 0; CNT[r3] = 0; CNT[r4] = 0;
  CNT[r0]++; CNT[r1]++; CNT[r2]++; CNT[r3]++; CNT[r4]++;
  let quad = -1, trip = -1, pairHi = -1, pairLo = -1;
  let k0 = -1, k1 = -1, k2 = -1;
  for (let r = 12; r >= 0; r--) {
    if (!(mask & (1 << r))) continue;
    const n = CNT[r]!;
    if (n === 4) quad = r;
    else if (n === 3) trip = r;
    else if (n === 2) {
      if (pairHi < 0) pairHi = r;
      else pairLo = r;
    } else if (k0 < 0) k0 = r;
    else if (k1 < 0) k1 = r;
    else k2 = r;
  }
  if (quad >= 0) return HandCategory.Quads * B + quad * P4 + k0 * P3;
  if (trip >= 0 && pairHi >= 0) return HandCategory.FullHouse * B + trip * P4 + pairHi * P3;
  if (trip >= 0) return HandCategory.Trips * B + trip * P4 + k0 * P3 + k1 * P2;
  if (pairLo >= 0) return HandCategory.TwoPair * B + pairHi * P4 + pairLo * P3 + k0 * P2;
  return HandCategory.Pair * B + pairHi * P4 + k0 * P3 + k1 * P2 + k2 * 16;
}

export const categoryOfScore = (score: number): HandCategory => Math.floor(score / 16 ** 5) as HandCategory;

function ranksOfScore(score: number): number[] {
  const out: number[] = [];
  let s = score;
  for (let i = 0; i < 5; i++) {
    out.unshift(s % 16);
    s = Math.floor(s / 16);
  }
  return out;
}

const plural = (r: number) => RANK_PLURALS[r]!;
const single = (r: number) => RANK_NAMES[r]!;

export function describeScore(score: number): string {
  const cat = categoryOfScore(score);
  const r = ranksOfScore(score);
  switch (cat) {
    case HandCategory.RoyalFlush:
      return "Royal Flush";
    case HandCategory.StraightFlush:
      return `Straight Flush, ${single(r[0]!)} high`;
    case HandCategory.Quads:
      return `Four of a Kind, ${plural(r[0]!)}`;
    case HandCategory.FullHouse:
      return `Full House, ${plural(r[0]!)} full of ${plural(r[1]!)}`;
    case HandCategory.Flush:
      return `Flush, ${single(r[0]!)} high`;
    case HandCategory.Straight:
      return `Straight, ${single(r[0]!)} high`;
    case HandCategory.Trips:
      return `Three of a Kind, ${plural(r[0]!)}`;
    case HandCategory.TwoPair:
      return `Two Pair, ${plural(r[0]!)} and ${plural(r[1]!)}`;
    case HandCategory.Pair:
      return `Pair of ${plural(r[0]!)}`;
    default:
      return `${single(r[0]!)} High`;
  }
}

function* combos<T>(arr: T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i <= arr.length - (k - acc.length); i++) {
    acc.push(arr[i]!);
    yield* combos(arr, k, i + 1, acc);
    acc.pop();
  }
}

const valueOf = (five: Card[], score: number): HandValue => ({
  score,
  category: categoryOfScore(score),
  ranks: ranksOfScore(score),
  cards: five,
  name: describeScore(score),
});

/** Best 5-card hand from any 5–7 cards (Texas Hold'em rules). */
export function evaluateHoldem(cards: Card[]): HandValue {
  let best = -1;
  let bestFive: Card[] = [];
  for (const f of combos(cards, 5)) {
    const s = score5(f[0]!, f[1]!, f[2]!, f[3]!, f[4]!);
    if (s > best) {
      best = s;
      bestFive = f;
    }
  }
  return valueOf(bestFive, best);
}

/** Best Omaha hand: exactly two hole cards plus exactly three board cards. */
export function evaluateOmaha(hole: Card[], board: Card[]): HandValue {
  let best = -1;
  let bestFive: Card[] = [];
  for (const h of combos(hole, 2))
    for (const b of combos(board, 3)) {
      const s = score5(h[0]!, h[1]!, b[0]!, b[1]!, b[2]!);
      if (s > best) {
        best = s;
        bestFive = [...h, ...b];
      }
    }
  return valueOf(bestFive, best);
}

export type Variant = "holdem" | "omaha";

export function evaluate(variant: Variant, hole: Card[], board: Card[]): HandValue {
  return variant === "omaha" ? evaluateOmaha(hole, board) : evaluateHoldem([...hole, ...board]);
}

/** Score-only fast path used by equity simulation. */
export function quickScore(variant: Variant, hole: Card[], board: Card[]): number {
  let best = -1;
  if (variant === "omaha") {
    const h = hole, b = board;
    for (let i = 0; i < h.length; i++)
      for (let j = i + 1; j < h.length; j++)
        for (let x = 0; x < b.length; x++)
          for (let y = x + 1; y < b.length; y++)
            for (let z = y + 1; z < b.length; z++) {
              const s = score5(h[i]!, h[j]!, b[x]!, b[y]!, b[z]!);
              if (s > best) best = s;
            }
    return best;
  }
  const all = [...hole, ...board];
  const n = all.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const s = score5(all[a]!, all[b]!, all[c]!, all[d]!, all[e]!);
            if (s > best) best = s;
          }
  return best;
}
