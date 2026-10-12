"use client";

import {
  BOT_PERSONALITIES,
  type BotPersonality,
  type CoachAdvice,
  type GameState,
  type PlayerAction,
  type Variant,
  addChips,
  applyAction,
  botDecide,
  coachAdvice,
  createTable,
  isHandLive,
  sitDown,
  startHand,
  toPlayerView,
} from "@felt/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRACTICE_STACK, useProfile } from "@/lib/store";

export const HERO = 0;
const BOT_STACK = 2000;
const BOTS = [
  { name: "Maverick", avatar: "🤠" },
  { name: "Luna", avatar: "🌙" },
  { name: "Diego", avatar: "🦈" },
  { name: "Priya", avatar: "🦚" },
  { name: "Sasha", avatar: "🐆" },
];

export interface PracticeConfig {
  variant: Variant;
  opponents: number;
}

export interface Decision {
  street: string;
  recommended: string;
  taken: string;
  followed: boolean;
}

const actionWord = (a: PlayerAction, s: GameState) =>
  a.type === "raise" ? (s.currentBet === 0 ? "bet" : "raise") : a.type;

export function usePractice(config: PracticeConfig | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [advice, setAdvice] = useState<CoachAdvice | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [autoDealIn, setAutoDealIn] = useState<number | null>(null);
  const personalities = useRef<Record<number, BotPersonality>>({});
  const stateRef = useRef(state);
  stateRef.current = state;

  // Build a fresh table whenever the setup changes.
  useEffect(() => {
    if (!config) {
      setState(null);
      return;
    }
    const profile = useProfile.getState();
    let s = createTable({ variant: config.variant, smallBlind: 10, bigBlind: 20, maxSeats: config.opponents + 1 });
    s = sitDown(s, HERO, { id: "hero", name: profile.name || "You", avatar: profile.avatar }, profile.practiceChips || PRACTICE_STACK);
    const shuffled = [...BOT_PERSONALITIES].sort(() => Math.random() - 0.5);
    for (let i = 1; i <= config.opponents; i++) {
      const bot = BOTS[i - 1]!;
      const p = shuffled[(i - 1) % shuffled.length]!;
      personalities.current[i] = p;
      s = sitDown(s, i, { id: `bot${i}`, name: bot.name, avatar: bot.avatar, isBot: true }, BOT_STACK);
    }
    // Give the button to a random seat so the hero sees different positions.
    s.button = Math.floor(Math.random() * (config.opponents + 1)) - 1;
    setDecisions([]);
    setState(startHand(s));
  }, [config]);

  const view = useMemo(() => (state ? toPlayerView(state, HERO) : null), [state]);
  const heroTurn = !!state && isHandLive(state) && state.toAct === HERO;

  // Coach: recompute for each hero decision (async so the UI stays responsive).
  useEffect(() => {
    if (!view || !heroTurn) return;
    const id = setTimeout(() => setAdvice(coachAdvice(view)), 30);
    return () => clearTimeout(id);
  }, [view, heroTurn]);

  // Bots act after a natural pause.
  useEffect(() => {
    if (!state || !isHandLive(state) || state.toAct === null || state.toAct === HERO) return;
    const seat = state.toAct;
    const heroOut = state.seats[HERO]!.folded;
    const delay = heroOut ? 380 + Math.random() * 300 : 750 + Math.random() * 850;
    const id = setTimeout(() => {
      const cur = stateRef.current;
      if (!cur || cur.toAct !== seat) return;
      const bot = personalities.current[seat] ?? BOT_PERSONALITIES[0]!;
      const action = botDecide(toPlayerView(cur, seat), bot);
      try {
        setState(applyAction(cur, seat, action));
      } catch {
        // Fallback to the safest legal action.
        const v = toPlayerView(cur, seat);
        setState(applyAction(cur, seat, v.legal?.canCheck ? { type: "check" } : { type: "fold" }));
      }
    }, delay);
    return () => clearTimeout(id);
  }, [state]);

  // End of hand: sync chips, then auto-deal after a pause.
  useEffect(() => {
    if (!state || state.street !== "complete") {
      setAutoDealIn(null);
      return;
    }
    useProfile.getState().setPracticeChips(state.seats[HERO]!.stack);
    setAutoDealIn(8);
    const id = setInterval(() => setAutoDealIn((n) => (n === null ? null : Math.max(0, n - 1))), 1000);
    return () => clearInterval(id);
  }, [state]);

  const dealNext = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || isHandLive(cur)) return;
    let s = cur;
    // Busted bots rebuy so the game keeps going.
    for (let i = 1; i < s.seats.length; i++) if (s.seats[i] && s.seats[i]!.stack === 0) s = addChips(s, i, BOT_STACK);
    if (s.seats[HERO]!.stack === 0) return;
    setDecisions([]);
    setAdvice(null);
    setState(startHand(s));
  }, []);

  useEffect(() => {
    if (autoDealIn === 0 && (state?.seats[HERO]?.stack ?? 0) > 0) dealNext();
  }, [autoDealIn, dealNext, state]);

  const act = useCallback(
    (a: PlayerAction) => {
      const cur = stateRef.current;
      if (!cur || cur.toAct !== HERO) return;
      try {
        const next = applyAction(cur, HERO, a);
        if (advice) {
          const taken = actionWord(a, cur);
          setDecisions((d) => [...d, { street: cur.street, recommended: advice.recommended, taken, followed: taken === advice.recommended }]);
        }
        setAdvice(null);
        setState(next);
      } catch (e) {
        console.warn(e);
      }
    },
    [advice],
  );

  const rebuy = useCallback(() => {
    const cur = stateRef.current;
    if (!cur) return;
    useProfile.getState().setPracticeChips(PRACTICE_STACK);
    setState(addChips(cur, HERO, PRACTICE_STACK - cur.seats[HERO]!.stack));
  }, []);

  const tags = useMemo(() => {
    const t: Record<number, string> = {};
    for (const [seat, p] of Object.entries(personalities.current)) t[Number(seat)] = p.label;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.handNumber]);

  return { state, view, advice: heroTurn ? advice : null, heroTurn, act, dealNext, autoDealIn, decisions, rebuy, tags, personalities };
}
