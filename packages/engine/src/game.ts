import { type Card, type Rng, cryptoRng, freshDeck, shuffle } from "./cards";
import { type Variant, evaluate } from "./evaluator";

export type Street = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown" | "complete";

export interface TableConfig {
  variant: Variant;
  smallBlind: number;
  bigBlind: number;
  maxSeats: number;
}

export type ActionKind = "fold" | "check" | "call" | "bet" | "raise" | "allin";

export interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  isBot?: boolean;
}

export interface SeatState extends PlayerInfo {
  stack: number;
  hole: Card[];
  /** Chips put in on the current street. */
  bet: number;
  /** Chips put in over the whole hand. */
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  /** Not dealt into the current hand. */
  sittingOut: boolean;
  hasActed: boolean;
  /** Table bet level at the moment this player last acted (for re-raise rights). */
  actedAtLevel: number;
  lastAction: { kind: ActionKind | "sb" | "bb"; amount: number } | null;
}

export type PlayerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  /** Bet or raise so that this player's street total becomes `to`. */
  | { type: "raise"; to: number };

export interface PotResult {
  amount: number;
  eligible: number[];
  winners: number[];
  handName: string | null;
}

export interface HandResult {
  showdown: boolean;
  pots: PotResult[];
  /** Net amount won per seat (gross won, not profit). */
  won: Record<number, number>;
  /** Seats whose cards are shown at showdown, with hand description and best five. */
  revealed: Record<number, { hole: Card[]; handName: string; best: Card[] }>;
}

export type LogEvent =
  | { t: "start"; hand: number; button: number }
  | { t: "blind"; seat: number; amount: number; kind: "sb" | "bb" }
  | { t: "action"; seat: number; kind: ActionKind; amount: number; street: Street }
  | { t: "street"; street: Street; board: Card[] }
  | { t: "refund"; seat: number; amount: number }
  | { t: "win"; seat: number; amount: number; handName: string | null };

export interface GameState {
  config: TableConfig;
  seats: (SeatState | null)[];
  handNumber: number;
  button: number;
  sbSeat: number;
  bbSeat: number;
  street: Street;
  deck: Card[];
  board: Card[];
  toAct: number | null;
  /** Highest street bet. */
  currentBet: number;
  /** Size of the last full bet/raise on this street. */
  lastRaiseSize: number;
  /** Bet level established by the last *full* raise (incomplete all-ins don't reopen action). */
  fullRaiseLevel: number;
  result: HandResult | null;
  log: LogEvent[];
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  /** "bet" when nobody has bet this street, otherwise "raise". */
  raiseLabel: "bet" | "raise";
  minRaiseTo: number;
  maxRaiseTo: number;
}

const clone = <T>(x: T): T => structuredClone(x);

export function createTable(config: TableConfig): GameState {
  return {
    config,
    seats: Array.from({ length: config.maxSeats }, () => null),
    handNumber: 0,
    button: -1,
    sbSeat: -1,
    bbSeat: -1,
    street: "waiting",
    deck: [],
    board: [],
    toAct: null,
    currentBet: 0,
    lastRaiseSize: 0,
    fullRaiseLevel: 0,
    result: null,
    log: [],
  };
}

export function sitDown(state: GameState, seat: number, player: PlayerInfo, stack: number): GameState {
  if (state.seats[seat]) throw new Error("Seat taken");
  const s = clone(state);
  s.seats[seat] = {
    ...player,
    stack,
    hole: [],
    bet: 0,
    totalBet: 0,
    folded: true,
    allIn: false,
    sittingOut: true,
    hasActed: false,
    actedAtLevel: 0,
    lastAction: null,
  };
  return s;
}

/** Remove a player. Mid-hand they are folded first; their committed chips stay in the pot. */
export function standUp(state: GameState, seat: number): { state: GameState; cashOut: number } {
  let s = state;
  const p = s.seats[seat];
  if (!p) return { state, cashOut: 0 };
  if (isHandLive(s) && !p.folded && !p.sittingOut) {
    if (s.toAct === seat) s = applyAction(s, seat, { type: "fold" });
    else {
      s = clone(s);
      s.seats[seat]!.folded = true;
      s.seats[seat]!.hasActed = true;
      s = maybeAdvance(s, true);
    }
  }
  s = s === state ? clone(s) : s;
  const cashOut = s.seats[seat]!.stack;
  s.seats[seat] = null;
  return { state: s, cashOut };
}

export function addChips(state: GameState, seat: number, amount: number): GameState {
  const s = clone(state);
  const p = s.seats[seat];
  if (p) p.stack += amount;
  return s;
}

export const isHandLive = (s: GameState) => s.street !== "waiting" && s.street !== "complete";

const n = (s: GameState) => s.seats.length;

/** Next occupied seat clockwise after `from` that matches `pred`. */
function nextSeat(s: GameState, from: number, pred: (p: SeatState) => boolean): number {
  for (let i = 1; i <= n(s); i++) {
    const idx = (from + i + n(s)) % n(s);
    const p = s.seats[idx];
    if (p && pred(p)) return idx;
  }
  return -1;
}

const inHand = (p: SeatState) => !p.sittingOut && !p.folded;
const canActP = (p: SeatState) => inHand(p) && !p.allIn;

export function seatsReady(s: GameState): number[] {
  return s.seats.flatMap((p, i) => (p && p.stack > 0 ? [i] : []));
}

export function canStartHand(s: GameState): boolean {
  return !isHandLive(s) && seatsReady(s).length >= 2;
}

export function startHand(state: GameState, rng: Rng = cryptoRng): GameState {
  if (!canStartHand(state)) throw new Error("Need at least two players with chips");
  const s = clone(state);
  s.handNumber += 1;
  s.board = [];
  s.result = null;
  s.log = [];
  s.currentBet = 0;
  s.lastRaiseSize = s.config.bigBlind;
  s.fullRaiseLevel = 0;
  for (const p of s.seats) {
    if (!p) continue;
    p.hole = [];
    p.bet = 0;
    p.totalBet = 0;
    p.allIn = false;
    p.hasActed = false;
    p.actedAtLevel = 0;
    p.lastAction = null;
    p.sittingOut = p.stack <= 0;
    p.folded = p.sittingOut;
  }
  const active = (p: SeatState) => !p.sittingOut;
  s.button = nextSeat(s, s.button < 0 ? -1 : s.button, active);
  const players = s.seats.filter((p) => p && active(p)).length;
  if (players === 2) {
    // Heads-up: the button posts the small blind and acts first preflop.
    s.sbSeat = s.button;
    s.bbSeat = nextSeat(s, s.button, active);
  } else {
    s.sbSeat = nextSeat(s, s.button, active);
    s.bbSeat = nextSeat(s, s.sbSeat, active);
  }
  s.log.push({ t: "start", hand: s.handNumber, button: s.button });

  s.deck = shuffle(freshDeck(), rng);
  const holeCount = s.config.variant === "omaha" ? 4 : 2;
  for (let k = 0; k < holeCount; k++) {
    let idx = s.sbSeat;
    for (let c = 0; c < players; c++) {
      s.seats[idx]!.hole.push(s.deck.pop()!);
      idx = nextSeat(s, idx, active);
    }
  }

  postBlind(s, s.sbSeat, s.config.smallBlind, "sb");
  postBlind(s, s.bbSeat, s.config.bigBlind, "bb");
  s.currentBet = Math.max(s.seats[s.sbSeat]!.bet, s.seats[s.bbSeat]!.bet);
  s.fullRaiseLevel = s.currentBet;
  s.lastRaiseSize = s.config.bigBlind;
  s.street = "preflop";
  s.toAct = nextSeat(s, s.bbSeat, canActP);
  return maybeAdvance(s, true);
}

function postBlind(s: GameState, seat: number, amount: number, kind: "sb" | "bb") {
  const p = s.seats[seat]!;
  const amt = Math.min(amount, p.stack);
  p.stack -= amt;
  p.bet += amt;
  p.totalBet += amt;
  if (p.stack === 0) p.allIn = true;
  p.lastAction = { kind, amount: amt };
  s.log.push({ t: "blind", seat, amount: amt, kind });
}

export const potTotal = (s: GameState) => s.seats.reduce((a, p) => a + (p ? p.totalBet : 0), 0);

export function legalActions(s: GameState, seat: number): LegalActions | null {
  if (!isHandLive(s) || s.toAct !== seat || s.street === "showdown") return null;
  const p = s.seats[seat]!;
  const callAmount = Math.min(s.currentBet - p.bet, p.stack);
  const maxTotal = p.bet + p.stack;
  const reopened = !p.hasActed || s.fullRaiseLevel > p.actedAtLevel;
  // Someone else must still be able to respond for a raise to be meaningful.
  const othersCanAct = s.seats.some((q, i) => q && i !== seat && canActP(q));
  let maxRaiseTo = maxTotal;
  if (s.config.variant === "omaha") {
    const fullCall = s.currentBet - p.bet;
    maxRaiseTo = Math.min(maxTotal, s.currentBet + potTotal(s) + fullCall);
  }
  const minRaiseTo = Math.min(s.currentBet + Math.max(s.lastRaiseSize, s.config.bigBlind), maxTotal);
  const canRaise = reopened && othersCanAct && maxTotal > s.currentBet;
  return {
    canFold: true,
    canCheck: s.currentBet === p.bet,
    canCall: s.currentBet > p.bet,
    callAmount,
    canRaise,
    raiseLabel: s.currentBet === 0 ? "bet" : "raise",
    minRaiseTo,
    maxRaiseTo: Math.max(minRaiseTo, maxRaiseTo),
  };
}

export function applyAction(state: GameState, seat: number, action: PlayerAction): GameState {
  const legal = legalActions(state, seat);
  if (!legal) throw new Error("Not your turn");
  const s = clone(state);
  const p = s.seats[seat]!;
  const levelBefore = s.currentBet;

  const put = (amt: number) => {
    p.stack -= amt;
    p.bet += amt;
    p.totalBet += amt;
    if (p.stack === 0) p.allIn = true;
  };

  let kind: ActionKind;
  switch (action.type) {
    case "fold":
      p.folded = true;
      kind = "fold";
      break;
    case "check":
      if (!legal.canCheck) throw new Error("Cannot check");
      kind = "check";
      break;
    case "call": {
      if (!legal.canCall) throw new Error("Nothing to call");
      put(legal.callAmount);
      kind = p.allIn ? "allin" : "call";
      break;
    }
    case "raise": {
      if (!legal.canRaise) throw new Error("Cannot raise");
      const to = Math.floor(action.to);
      const maxTotal = p.bet + p.stack;
      const isAllIn = to >= maxTotal;
      if (to > legal.maxRaiseTo) throw new Error("Raise exceeds limit");
      if (to < legal.minRaiseTo && !isAllIn) throw new Error(`Minimum raise is to ${legal.minRaiseTo}`);
      if (to <= s.currentBet) throw new Error("Raise must exceed the current bet");
      const raiseSize = to - s.currentBet;
      put(to - p.bet);
      if (raiseSize >= s.lastRaiseSize || s.currentBet === 0 && raiseSize >= s.config.bigBlind) {
        s.lastRaiseSize = raiseSize;
        s.fullRaiseLevel = to;
      }
      kind = p.allIn ? "allin" : levelBefore === 0 ? "bet" : "raise";
      s.currentBet = to;
      break;
    }
  }
  p.hasActed = true;
  p.actedAtLevel = s.currentBet;
  const amount = action.type === "fold" || action.type === "check" ? 0 : p.bet;
  p.lastAction = { kind, amount };
  s.log.push({ t: "action", seat, kind, amount, street: s.street });

  return maybeAdvance(s);
}

/**
 * Moves the turn, ends streets, runs out boards and settles pots as needed.
 * `keep` re-checks from the current `toAct` instead of moving past it.
 */
function maybeAdvance(s: GameState, keep = false): GameState {
  if (!isHandLive(s)) return s;
  const live = s.seats.flatMap((p, i) => (p && inHand(p) ? [i] : []));
  if (live.length === 1) {
    refundUncalled(s);
    return settle(s, false);
  }

  const roundDone = s.seats.every((p) => !p || !canActP(p) || (p.hasActed && p.bet === s.currentBet));
  if (!roundDone) {
    const from = s.toAct ?? s.button;
    s.toAct = nextSeat(s, keep ? from - 1 : from, (p) => canActP(p) && (!p.hasActed || p.bet < s.currentBet));
    return s;
  }

  refundUncalled(s);
  const canStillBet = live.filter((i) => canActP(s.seats[i]!)).length;
  if (s.street === "river") return settle(s, true);

  // Collect street bets into the pot (totalBet already tracks them).
  for (const p of s.seats) {
    if (!p) continue;
    p.bet = 0;
    p.hasActed = false;
    p.actedAtLevel = 0;
  }
  s.currentBet = 0;
  s.lastRaiseSize = s.config.bigBlind;
  s.fullRaiseLevel = 0;
  dealNextStreet(s);

  if (canStillBet <= 1) {
    // Everyone (or all but one) is all-in: run the board out.
    while ((s.street as Street) !== "river") dealNextStreet(s);
    return settle(s, true);
  }
  s.toAct = nextSeat(s, s.button, canActP);
  return s;
}

function dealNextStreet(s: GameState) {
  const burn = () => s.deck.pop();
  if (s.street === "preflop") {
    burn();
    s.board.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
    s.street = "flop";
  } else if (s.street === "flop") {
    burn();
    s.board.push(s.deck.pop()!);
    s.street = "turn";
  } else if (s.street === "turn") {
    burn();
    s.board.push(s.deck.pop()!);
    s.street = "river";
  }
  for (const p of s.seats) if (p && !p.folded) p.lastAction = null;
  s.log.push({ t: "street", street: s.street, board: [...s.board] });
}

/** If one player bet more than anyone else could match, give back the excess. */
function refundUncalled(s: GameState) {
  const contributors = s.seats.flatMap((p, i) => (p && !p.sittingOut ? [i] : []));
  const sorted = [...contributors].sort((a, b) => s.seats[b]!.totalBet - s.seats[a]!.totalBet);
  const top = s.seats[sorted[0]!]!;
  const second = sorted[1] !== undefined ? s.seats[sorted[1]]!.totalBet : 0;
  const excess = top.totalBet - second;
  if (excess > 0) {
    top.totalBet -= excess;
    top.bet = Math.max(0, top.bet - excess);
    top.stack += excess;
    if (top.stack > 0) top.allIn = false;
    s.log.push({ t: "refund", seat: sorted[0]!, amount: excess });
  }
}

/** Build main and side pots from each player's total contribution. */
export function buildPots(s: GameState): { amount: number; eligible: number[] }[] {
  const contrib = s.seats.map((p) => (p ? p.totalBet : 0));
  const live = s.seats.flatMap((p, i) => (p && inHand(p) ? [i] : []));
  const levels = [...new Set(live.map((i) => contrib[i]!))].sort((a, b) => a - b);
  const pots: { amount: number; eligible: number[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of contrib) amount += Math.max(0, Math.min(c, level) - prev);
    const eligible = live.filter((i) => contrib[i]! >= level);
    if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }
  // Dead money above the highest live contribution (shouldn't normally happen after refunds).
  const leftover = contrib.reduce((a, c) => a + Math.max(0, c - prev), 0);
  if (leftover > 0 && pots.length) pots[pots.length - 1]!.amount += leftover;
  return pots;
}

function settle(s: GameState, showdown: boolean): GameState {
  const pots = buildPots(s);
  const won: Record<number, number> = {};
  const revealed: HandResult["revealed"] = {};
  const results: PotResult[] = [];
  const live = s.seats.flatMap((p, i) => (p && inHand(p) ? [i] : []));

  const values = new Map<number, ReturnType<typeof evaluate>>();
  if (showdown) {
    for (const i of live) {
      const p = s.seats[i]!;
      const v = evaluate(s.config.variant, p.hole, s.board);
      values.set(i, v);
      revealed[i] = { hole: p.hole, handName: v.name, best: v.cards };
    }
  }

  // Odd chips go to the first winner clockwise from the button.
  const order = (seats: number[]) =>
    [...seats].sort((a, b) => ((a - s.button - 1 + n(s)) % n(s)) - ((b - s.button - 1 + n(s)) % n(s)));

  for (const pot of pots) {
    let winners: number[];
    let handName: string | null = null;
    if (!showdown || pot.eligible.length === 1) {
      winners = pot.eligible.length ? [pot.eligible[0]!] : live;
      if (showdown) handName = values.get(winners[0]!)?.name ?? null;
    } else {
      const best = Math.max(...pot.eligible.map((i) => values.get(i)!.score));
      winners = order(pot.eligible.filter((i) => values.get(i)!.score === best));
      handName = values.get(winners[0]!)!.name;
    }
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const w of winners) {
      const amt = share + (odd > 0 ? 1 : 0);
      if (odd > 0) odd--;
      won[w] = (won[w] ?? 0) + amt;
    }
    results.push({ amount: pot.amount, eligible: pot.eligible, winners, handName });
  }

  for (const [seat, amt] of Object.entries(won)) {
    const i = Number(seat);
    s.seats[i]!.stack += amt;
    s.log.push({ t: "win", seat: i, amount: amt, handName: showdown ? values.get(i)?.name ?? null : null });
  }
  for (const p of s.seats) {
    if (!p) continue;
    p.bet = 0;
    p.totalBet = 0;
  }
  s.result = { showdown, pots: results, won, revealed };
  s.street = "complete";
  s.toAct = null;
  return s;
}

/** Chips in front of players plus in the middle — used to verify conservation. */
export function totalChips(s: GameState): number {
  return s.seats.reduce((a, p) => a + (p ? p.stack + p.totalBet : 0), 0);
}
