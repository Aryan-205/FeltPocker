import { describe, expect, it } from "vitest";
import { parseCards, seededRng } from "./cards";
import {
  type GameState,
  applyAction,
  buildPots,
  createTable,
  legalActions,
  sitDown,
  startHand,
  totalChips,
} from "./game";
import { botDecide, BOT_PERSONALITIES } from "./bots";
import { toPlayerView } from "./view";

const player = (i: number) => ({ id: `p${i}`, name: `P${i}`, avatar: "🙂" });

function table(stacks: number[], variant: "holdem" | "omaha" = "holdem"): GameState {
  let s = createTable({ variant, smallBlind: 5, bigBlind: 10, maxSeats: 6 });
  stacks.forEach((st, i) => (s = sitDown(s, i, player(i), st)));
  return s;
}

describe("game flow", () => {
  it("posts blinds and gives first action to UTG", () => {
    const s = startHand(table([1000, 1000, 1000]), seededRng(1));
    expect(s.button).toBe(0);
    expect(s.seats[1]!.bet).toBe(5);
    expect(s.seats[2]!.bet).toBe(10);
    expect(s.toAct).toBe(0);
    expect(s.seats.every((p) => !p || p.hole.length === 2)).toBe(true);
  });

  it("heads-up: button is small blind and acts first preflop, last postflop", () => {
    let s = startHand(table([1000, 1000]), seededRng(2));
    expect(s.sbSeat).toBe(s.button);
    expect(s.toAct).toBe(s.button);
    s = applyAction(s, s.toAct!, { type: "call" });
    s = applyAction(s, s.toAct!, { type: "check" });
    expect(s.street).toBe("flop");
    expect(s.toAct).toBe(s.bbSeat);
  });

  it("everyone folds to the big blind", () => {
    let s = startHand(table([1000, 1000, 1000]), seededRng(3));
    s = applyAction(s, 0, { type: "fold" });
    s = applyAction(s, 1, { type: "fold" });
    expect(s.street).toBe("complete");
    expect(s.seats[2]!.stack).toBe(1005);
    expect(s.result!.showdown).toBe(false);
  });

  it("enforces minimum raise and refunds uncalled bets", () => {
    let s = startHand(table([1000, 1000, 1000]), seededRng(4));
    expect(legalActions(s, 0)!.minRaiseTo).toBe(20);
    expect(() => applyAction(s, 0, { type: "raise", to: 15 })).toThrow();
    s = applyAction(s, 0, { type: "raise", to: 30 });
    expect(legalActions(s, 1)!.minRaiseTo).toBe(50);
    s = applyAction(s, 1, { type: "fold" });
    s = applyAction(s, 2, { type: "fold" });
    expect(s.seats[0]!.stack).toBe(1015);
  });

  it("builds side pots for multiple all-ins", () => {
    let s = startHand(table([100, 300, 1000]), seededRng(5));
    // seat 0 button, 1 SB, 2 BB; UTG = seat 0
    s = applyAction(s, 0, { type: "raise", to: 100 });
    s = applyAction(s, 1, { type: "raise", to: 300 });
    s = applyAction(s, 2, { type: "call" });
    // board runs out automatically
    expect(s.street).toBe("complete");
    const pots = s.result!.pots;
    expect(pots[0]!.amount).toBe(300);
    expect(pots[0]!.eligible).toEqual([0, 1, 2]);
    expect(pots[1]!.amount).toBe(400);
    expect(pots[1]!.eligible).toEqual([1, 2]);
    expect(totalChips(s)).toBe(1400);
  });

  it("buildPots includes dead money from folded players", () => {
    let s = startHand(table([1000, 1000, 1000]), seededRng(6));
    s = applyAction(s, 0, { type: "call" });
    s = applyAction(s, 1, { type: "fold" });
    const pots = buildPots(s);
    expect(pots.reduce((a, p) => a + p.amount, 0)).toBe(25);
  });

  it("incomplete all-in raise does not reopen betting", () => {
    let s = startHand(table([1000, 1000, 35]), seededRng(7));
    // UTG(0) raises to 30, SB(1) calls, BB(2) all-in 35 (incomplete raise of 5)
    s = applyAction(s, 0, { type: "raise", to: 30 });
    s = applyAction(s, 1, { type: "call" });
    s = applyAction(s, 2, { type: "raise", to: 35 });
    const l = legalActions(s, 0)!;
    expect(l.canRaise).toBe(false);
    expect(l.callAmount).toBe(5);
  });

  it("pot-limit omaha caps raises at the pot", () => {
    const s = startHand(table([1000, 1000, 1000], "omaha"), seededRng(8));
    expect(s.seats[0]!.hole).toHaveLength(4);
    // pot 15 + call 10 → max raise to 10 + 15 + 10 = 35
    expect(legalActions(s, 0)!.maxRaiseTo).toBe(35);
  });

  it("splits a pot when the board plays", () => {
    let s = startHand(table([1000, 1000]), seededRng(9));
    // rig the deck: board royal flush, everyone ties
    const board = parseCards("As Ks Qs Js Ts");
    s.seats[0]!.hole = parseCards("2c 3d");
    s.seats[1]!.hole = parseCards("2d 3c");
    // deck pops from the end: burn, 3 flop, burn, turn, burn, river
    s.deck = [board[4]!, 50, board[3]!, 49, board[2]!, board[1]!, board[0]!, 48];
    s = applyAction(s, s.toAct!, { type: "call" });
    s = applyAction(s, s.toAct!, { type: "check" });
    for (let i = 0; i < 6; i++) s = applyAction(s, s.toAct!, { type: "check" });
    expect(s.result!.showdown).toBe(true);
    expect(s.seats[0]!.stack).toBe(1000);
    expect(s.seats[1]!.stack).toBe(1000);
  });

  it("view hides opponents' hole cards", () => {
    const s = startHand(table([1000, 1000, 1000]), seededRng(10));
    const v = toPlayerView(s, 0);
    expect(v.seats[0]!.hole.every((c) => c !== null)).toBe(true);
    expect(v.seats[1]!.hole.every((c) => c === null)).toBe(true);
    expect((v as unknown as { deck?: unknown }).deck).toBeUndefined();
  });
});

describe("simulation", () => {
  for (const variant of ["holdem", "omaha"] as const) {
    it(`bots play many ${variant} hands with chips conserved`, () => {
      const rng = seededRng(42);
      let s = table([1000, 800, 1200, 500, 1500, 1000], variant);
      const total = totalChips(s);
      let hands = 0;
      for (; hands < 150; hands++) {
        if (s.seats.filter((p) => p && p.stack > 0).length < 2) break;
        s = startHand(s, rng);
        let guard = 0;
        while (s.street !== "complete") {
          const seat = s.toAct!;
          const bot = BOT_PERSONALITIES[seat % BOT_PERSONALITIES.length]!;
          s = applyAction(s, seat, botDecide(toPlayerView(s, seat), bot, rng));
          expect(totalChips(s)).toBe(total);
          if (++guard > 200) throw new Error("hand did not terminate");
        }
        expect(totalChips(s)).toBe(total);
        expect(s.seats.every((p) => !p || p.stack >= 0)).toBe(true);
      }
      expect(hands).toBeGreaterThan(10);
    }, 60_000);
  }
});
