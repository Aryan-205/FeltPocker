import { type Rng, cryptoRng } from "./cards";
import { estimateEquity, potOdds } from "./equity";
import type { PlayerAction } from "./game";
import type { TableView } from "./view";

export interface BotPersonality {
  key: string;
  label: string;
  /** How much below pot odds they'll still call (looser = higher). */
  looseness: number;
  /** Probability of raising with a strong hand instead of calling. */
  aggression: number;
  /** Probability of betting/raising with a weak hand. */
  bluff: number;
}

export const BOT_PERSONALITIES: BotPersonality[] = [
  { key: "rock", label: "Tight & Passive", looseness: -0.04, aggression: 0.35, bluff: 0.02 },
  { key: "lag", label: "Loose & Aggressive", looseness: 0.08, aggression: 0.8, bluff: 0.16 },
  { key: "station", label: "Calling Station", looseness: 0.16, aggression: 0.2, bluff: 0.03 },
  { key: "reg", label: "Solid Regular", looseness: 0.0, aggression: 0.6, bluff: 0.08 },
];

export const activeOpponents = (v: TableView) =>
  v.seats.filter((p, i) => p && i !== v.hero && !p.folded && !p.sittingOut).length;

/** Choose a bet size of roughly `fraction` of the pot, clamped to legal limits. */
export function sizeBet(v: TableView, fraction: number): number {
  const legal = v.legal!;
  const hero = v.seats[v.hero!]!;
  const toCall = v.currentBet - hero.bet;
  const raiseBy = Math.round((v.pot + toCall) * fraction);
  const to = v.currentBet + Math.max(raiseBy, v.config.bigBlind);
  return Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, roundChips(to, v.config.smallBlind)));
}

const roundChips = (x: number, unit: number) => Math.max(unit, Math.round(x / unit) * unit);

export function botDecide(v: TableView, bot: BotPersonality, rng: Rng = cryptoRng): PlayerAction {
  const legal = v.legal;
  if (!legal || v.hero === null) return { type: "fold" };
  const me = v.seats[v.hero]!;
  const opp = activeOpponents(v);
  const { equity } = estimateEquity(v.config.variant, me.hole as number[], v.board, opp, 350, rng);
  const toCall = legal.callAmount;
  const odds = potOdds(toCall, v.pot);
  const fair = 1 / (opp + 1);
  const strength = equity / fair; // 1.0 = average hand vs this many opponents
  const r = rng();

  const raise = (fraction: number): PlayerAction =>
    legal.canRaise ? { type: "raise", to: sizeBet(v, fraction) } : legal.canCall ? { type: "call" } : { type: "check" };
  const passive = (): PlayerAction => (legal.canCheck ? { type: "check" } : { type: "call" });

  if (v.street === "preflop") {
    if (strength > 1.7 && r < 0.5 + bot.aggression / 2) return raise(toCall > v.config.bigBlind * 4 ? 1 : 0.9);
    if (strength > 1.25 || (legal.canCheck && strength > 0.8)) {
      if (r < bot.aggression * 0.35 && strength > 1.4) return raise(0.8);
      if (toCall > me.stack * 0.35 && strength < 1.6) return legal.canCheck ? { type: "check" } : { type: "fold" };
      return passive();
    }
    if (legal.canCheck) return r < bot.bluff ? raise(0.7) : { type: "check" };
    if (toCall <= v.config.bigBlind && strength > 0.9 - bot.looseness * 3) return { type: "call" };
    return r < bot.bluff / 2 ? raise(0.8) : { type: "fold" };
  }

  // Post-flop
  const valueLine = 0.55 + 0.08 * (opp - 1);
  if (equity > valueLine) {
    if (r < bot.aggression) return raise(equity > 0.8 ? 0.85 : 0.6);
    return passive();
  }
  if (legal.canCheck) return r < bot.bluff ? raise(0.5) : { type: "check" };
  if (equity + bot.looseness >= odds) return { type: "call" };
  return r < bot.bluff / 2 ? raise(0.6) : { type: "fold" };
}
