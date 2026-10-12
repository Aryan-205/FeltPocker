import { type Rng, cryptoRng } from "./cards";
import { activeOpponents, sizeBet } from "./bots";
import { estimateEquity, potOdds } from "./equity";
import { type HandReading, readHand } from "./analysis";
import type { TableView } from "./view";

export type CoachMove = "fold" | "check" | "call" | "bet" | "raise";

export interface CoachOutcome {
  move: CoachMove;
  /** Button-style label, e.g. "Call 40". */
  label: string;
  /** What happens if you do this. */
  text: string;
  /** Rough expected value in chips relative to folding (null when not meaningful). */
  ev: number | null;
  recommended: boolean;
}

export interface CoachAdvice {
  recommended: CoachMove;
  /** Suggested street total for bet/raise. */
  suggestedTo: number | null;
  headline: string;
  reason: string;
  hand: HandReading;
  equity: number;
  /** Equity needed to call profitably (0 when checking is free). */
  needed: number;
  opponents: number;
  outcomes: CoachOutcome[];
  /** A general lesson tied to this spot. */
  lesson: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Explain the hero's decision in plain language. Only uses information the hero can see. */
export function coachAdvice(v: TableView, rng: Rng = cryptoRng): CoachAdvice | null {
  const legal = v.legal;
  if (!legal || v.hero === null) return null;
  const me = v.seats[v.hero]!;
  const hole = me.hole as number[];
  const opp = activeOpponents(v);
  const { equity } = estimateEquity(v.config.variant, hole, v.board, opp, 1500, rng);
  const hand = readHand(v.config.variant, hole, v.board);
  const toCall = legal.callAmount;
  const pot = v.pot;
  const needed = potOdds(toCall, pot);
  const fair = 1 / (opp + 1);
  const preflop = v.street === "preflop";
  const strong = preflop ? equity / fair > 1.6 : equity > 0.55 + 0.08 * (opp - 1);
  const playable = preflop ? equity / fair > 1.15 : equity >= needed;
  const betWord = legal.raiseLabel === "bet" ? "Bet" : "Raise";
  const sizeFraction = preflop ? 0.9 : equity > 0.8 ? 0.8 : 0.6;
  const suggestedTo = legal.canRaise ? sizeBet(v, sizeFraction) : null;
  const callEv = equity * (pot + toCall) - toCall;

  let recommended: CoachMove;
  if (strong && legal.canRaise) recommended = legal.raiseLabel;
  else if (legal.canCheck) recommended = "check";
  else if (playable && toCall < me.stack * (strong ? 1 : 0.5) + 1) recommended = "call";
  else if (!preflop && callEv > 0) recommended = "call";
  // A cheap price (e.g. completing the small blind) can be worth it with a marginal hand.
  else if (preflop && callEv > 0 && toCall <= v.config.bigBlind) recommended = "call";
  else recommended = "fold";

  const outcomes: CoachOutcome[] = [];
  if (!legal.canCheck) {
    outcomes.push({
      move: "fold",
      label: "Fold",
      text: `You give up this hand and lose nothing more. The ${me.totalBet || me.bet ? `chips you've already put in stay` : "pot goes"} with the other players. Good when you're behind and calling is too expensive.`,
      ev: 0,
      recommended: recommended === "fold",
    });
  }
  if (legal.canCheck) {
    outcomes.push({
      move: "check",
      label: "Check",
      text: preflop
        ? "You see the flop for free. Nothing is lost by waiting."
        : `You pass the action for free and see what opponents do. The risk: ${strong ? "you miss value from weaker hands that would have called" : "players with draws get a free card"}.`,
      ev: null,
      recommended: recommended === "check",
    });
  }
  if (legal.canCall) {
    const allIn = toCall >= me.stack;
    outcomes.push({
      move: "call",
      label: allIn ? `Call all-in ${toCall}` : `Call ${toCall}`,
      text: `You risk ${toCall} to win a pot of ${pot}. You need ${pct(needed)} equity to break even and have about ${pct(equity)}. ${callEv >= 0 ? `Over many hands this call earns about +${Math.round(callEv)} chips.` : `Over many hands this call loses about ${Math.round(-callEv)} chips.`}`,
      ev: Math.round(callEv),
      recommended: recommended === "call",
    });
  }
  if (legal.canRaise && suggestedTo) {
    const risk = suggestedTo - me.bet;
    const allIn = risk >= me.stack;
    outcomes.push({
      move: legal.raiseLabel,
      label: `${betWord} to ${suggestedTo}${allIn ? " (all-in)" : ""}`,
      text: strong
        ? `You build the pot while you're likely ahead. Weaker hands may still call and pay you off. If someone re-raises, they often have something very strong.`
        : `You put in ${risk} more chips. Opponents may fold and hand you the ${pot} pot right now, but if they call you're ${equity < 0.4 ? "usually behind" : "in a close spot"} with a bigger pot at risk.`,
      ev: null,
      recommended: recommended === legal.raiseLabel,
    });
  }

  const opponentsWord = opp === 1 ? "1 opponent" : `${opp} opponents`;
  let headline: string;
  let reason: string;
  switch (recommended) {
    case "bet":
    case "raise":
      headline = `${betWord} to ${suggestedTo} — you're likely ahead`;
      reason = `With about ${pct(equity)} equity against ${opponentsWord}, ${legal.raiseLabel === "bet" ? "betting" : "raising"} gets more chips in while you're the favourite and protects your hand against draws.`;
      break;
    case "check":
      headline = "Check — see the next card for free";
      reason = playable
        ? `Your hand has about ${pct(equity)} equity: decent, but not strong enough to build a big pot yet.`
        : `You only have about ${pct(equity)} equity. Checking costs nothing, so keep the pot small and see what comes.`;
      break;
    case "call":
      headline = `Call ${toCall} — the price is right`;
      reason =
        preflop && !playable
          ? `${hand.label} isn't strong, but it only costs ${toCall} to see a flop. You need ${pct(needed)} and have about ${pct(equity)}.`
          : `You need ${pct(needed)} to call and have about ${pct(equity)}. When your equity beats the pot odds, calling makes money in the long run.`;
      break;
    default:
      headline = "Fold — this hand isn't worth the price";
      reason = preflop
        ? `${hand.label} wins only about ${pct(equity)} against ${opponentsWord}. Saving chips for better spots is how winning players win.`
        : `You need ${pct(needed)} equity to call but only have about ${pct(equity)}. Calling loses chips over time.`;
  }

  return {
    recommended,
    suggestedTo: recommended === "bet" || recommended === "raise" ? suggestedTo : null,
    headline,
    reason,
    hand,
    equity,
    needed: legal.canCheck ? 0 : needed,
    opponents: opp,
    outcomes,
    lesson: pickLesson(v, hand, legal.canCheck),
  };
}

function pickLesson(v: TableView, hand: HandReading, canCheck: boolean): string {
  if (hand.draws.length)
    return `Rule of 2 and 4: multiply your outs (${hand.outs}) by ${v.street === "flop" ? "4 on the flop" : "2 on the turn"} for a rough chance to hit — about ${Math.min(100, hand.outs * (v.street === "flop" ? 4 : 2))}%.`;
  if (v.street === "preflop") {
    const pos = v.hero === v.button ? "on the button (best position)" : v.hero === v.bbSeat ? "in the big blind" : v.hero === v.sbSeat ? "in the small blind" : "out of position";
    return `You're ${pos}. Acting last after the flop is a big edge, so you can play more hands from late position.`;
  }
  if (canCheck) return "Checking is never worse than folding: if nobody has bet, never fold.";
  return "Pot odds: compare what you must call with the pot. Calling 50 into 150 needs 25% equity (50 ÷ 200).";
}
