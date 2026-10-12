import { describe, expect, it } from "vitest";
import { parseCards } from "./cards";
import { HandCategory, evaluateHoldem, evaluateOmaha } from "./evaluator";

const h = (s: string) => evaluateHoldem(parseCards(s));

describe("evaluateHoldem", () => {
  it.each([
    ["As Ks Qs Js Ts 2d 3c", HandCategory.RoyalFlush, "Royal Flush"],
    ["9h 8h 7h 6h 5h Ad Ac", HandCategory.StraightFlush, "Straight Flush, Nine high"],
    ["Ah 2h 3h 4h 5h Kd Kc", HandCategory.StraightFlush, "Straight Flush, Five high"],
    ["7s 7h 7d 7c Ks 2d 3c", HandCategory.Quads, "Four of a Kind, Sevens"],
    ["Ks Kh Kd 2c 2s 9d 3c", HandCategory.FullHouse, "Full House, Kings full of Twos"],
    ["As 9s 7s 4s 2s Kd Qc", HandCategory.Flush, "Flush, Ace high"],
    ["Ad 2c 3h 4s 5d Kd 9c", HandCategory.Straight, "Straight, Five high"],
    ["Ts Jh Qd Kc Ad 2c 3c", HandCategory.Straight, "Straight, Ace high"],
    ["Qs Qh Qd 9c 4s 2d 3c", HandCategory.Trips, "Three of a Kind, Queens"],
    ["Js Jh 4d 4c As 2d 8c", HandCategory.TwoPair, "Two Pair, Jacks and Fours"],
    ["Ts Th 4d 7c As 2d 8c", HandCategory.Pair, "Pair of Tens"],
    ["As Jh 4d 7c 9s 2d 8c", HandCategory.HighCard, "Ace High"],
  ])("%s → %s", (cards, cat, name) => {
    const v = h(cards);
    expect(v.category).toBe(cat);
    expect(v.name).toBe(name);
  });

  it("ranks categories correctly and uses kickers", () => {
    expect(h("As Ad Kc 7h 2s 3d 9c").score).toBeGreaterThan(h("As Ad Qc 7h 2s 3d 9c").score);
    expect(h("2s 2d 3c 3h 4s 9d Tc").score).toBeGreaterThan(h("As Ad Kc Qh 2s 3d 9c").score);
    expect(h("Ad 2c 3h 4s 5d Kd 9c").score).toBeLessThan(h("2c 3h 4s 5d 6d Kd 9c").score);
  });

  it("detects exact ties (playing the board)", () => {
    expect(h("2c 3d As Ks Qs Js Ts").score).toBe(h("4c 5d As Ks Qs Js Ts").score);
  });
});

describe("evaluateOmaha", () => {
  it("must use exactly two hole cards", () => {
    // Four spades on board + one spade in hand is NOT a flush in Omaha.
    const v = evaluateOmaha(parseCards("As Kd Qc 2h"), parseCards("3s 7s 9s Js 4d"));
    expect(v.category).not.toBe(HandCategory.Flush);
    const f = evaluateOmaha(parseCards("As Ks Qc 2h"), parseCards("3s 7s 9s Jd 4d"));
    expect(f.category).toBe(HandCategory.Flush);
  });

  it("can't play a board straight with one card", () => {
    const v = evaluateOmaha(parseCards("Ah Ad 2c 2s"), parseCards("Ts Jd Qc Kh 3d"));
    expect(v.category).toBe(HandCategory.Pair);
  });
});
