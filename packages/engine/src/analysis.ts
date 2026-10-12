import { type Card, RANK_NAMES, freshDeck, rankOf, suitOf } from "./cards";
import { HandCategory, type Variant, categoryOfScore, describeScore, quickScore } from "./evaluator";

export interface HandReading {
  /** e.g. "Pair of Kings", or a preflop label like "Suited connectors". */
  label: string;
  category: HandCategory | null;
  draws: string[];
  /** Unseen cards that would give at least a straight (only on flop/turn). */
  outs: number;
  /** Beginner-friendly one-liner. */
  plain: string;
}

/** Plain-English read of the hero's hand right now. */
export function readHand(variant: Variant, hole: Card[], board: Card[]): HandReading {
  if (board.length === 0) return readPreflop(variant, hole);
  const score = quickScore(variant, hole, board);
  const category = categoryOfScore(score);
  const label = describeScore(score);
  const draws: string[] = [];
  let outs = 0;

  if (board.length < 5 && category < HandCategory.Straight) {
    const used = new Set([...hole, ...board]);
    let flushOuts = 0;
    let straightOuts = 0;
    for (const c of freshDeck()) {
      if (used.has(c)) continue;
      const cat = categoryOfScore(quickScore(variant, hole, [...board, c]));
      if (cat >= HandCategory.Straight) {
        outs++;
        if (cat === HandCategory.Flush || cat >= HandCategory.StraightFlush) flushOuts++;
        else if (cat === HandCategory.Straight) straightOuts++;
      }
    }
    if (flushOuts >= 7) draws.push("flush draw");
    if (straightOuts >= 7) draws.push("open-ended straight draw");
    else if (straightOuts >= 3) draws.push("gutshot straight draw");
  }

  let plain: string;
  if (category >= HandCategory.Straight) plain = `You have a ${label.toLowerCase()} — a very strong hand.`;
  else if (category >= HandCategory.TwoPair) plain = `You have ${label.toLowerCase()} — a strong made hand.`;
  else if (category === HandCategory.Pair) plain = `You have a ${label.toLowerCase()}.`;
  else plain = `You have nothing yet (${label.toLowerCase()}).`;
  if (draws.length) plain += ` You're on a ${draws.join(" and ")} with ${outs} outs.`;
  return { label, category, draws, outs, plain };
}

function readPreflop(variant: Variant, hole: Card[]): HandReading {
  if (variant === "omaha") {
    const suits = hole.map(suitOf);
    const ranks = hole.map(rankOf).sort((a, b) => b - a);
    const doubleSuited = new Set(suits).size === 2 && suits.filter((s) => s === suits[0]).length === 2;
    const pairs = ranks.filter((r, i) => ranks.indexOf(r) !== i).length;
    const span = ranks[0]! - ranks[3]!;
    const parts: string[] = [];
    if (doubleSuited) parts.push("double-suited");
    if (pairs) parts.push(pairs > 1 ? "two pairs" : "a pair");
    if (span <= 4 && pairs === 0) parts.push("connected");
    const label = parts.length ? `Omaha hand: ${parts.join(", ")}` : "Disconnected Omaha hand";
    return {
      label,
      category: null,
      draws: [],
      outs: 0,
      plain: "In Omaha you must use exactly two of your four cards. Connected, suited cards play best.",
    };
  }
  const [a, b] = hole as [Card, Card];
  const hi = Math.max(rankOf(a), rankOf(b));
  const lo = Math.min(rankOf(a), rankOf(b));
  const suited = suitOf(a) === suitOf(b);
  const gap = hi - lo;
  const name = `${RANK_NAMES[hi]}-${RANK_NAMES[lo]}${suited ? " suited" : ""}`;
  let label: string;
  if (gap === 0) label = hi >= 9 ? "Premium pocket pair" : hi >= 6 ? "Medium pocket pair" : "Small pocket pair";
  else if (hi >= 11 && lo >= 10) label = suited ? "Premium suited broadways" : "Strong broadway cards";
  else if (lo >= 8) label = suited ? "Suited broadways" : "Broadway cards";
  else if (hi === 12 && suited) label = "Suited ace";
  else if (gap === 1 && suited) label = "Suited connectors";
  else if (hi >= 8 && lo >= 8) label = "Broadway cards";
  else if (hi === 12) label = "Ace with a weak kicker";
  else label = suited ? "Weak suited hand" : "Weak, unconnected hand";
  return {
    label: gap === 0 ? `${label} (${RANK_NAMES[hi]}s)` : `${label} (${name})`,
    category: null,
    draws: [],
    outs: 0,
    plain:
      gap === 0
        ? "A pocket pair is already a made hand before the flop."
        : suited
          ? "Suited cards can make flushes; connected cards can make straights."
          : "Unsuited cards rely mostly on pairing the board.",
  };
}
