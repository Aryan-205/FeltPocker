/** A card is an integer 0..51: rank = card >> 2 (0 = deuce … 12 = ace), suit = card & 3. */
export type Card = number;

export const RANKS = "23456789TJQKA";
export const SUITS = "shdc"; // spades, hearts, diamonds, clubs
export const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"] as const;
export const RANK_NAMES = [
  "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace",
] as const;
export const RANK_PLURALS = [
  "Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Jacks", "Queens", "Kings", "Aces",
] as const;

export const rankOf = (c: Card) => c >> 2;
export const suitOf = (c: Card) => c & 3;
export const makeCard = (rank: number, suit: number): Card => (rank << 2) | suit;

/** "As" → card */
export function parseCard(s: string): Card {
  const r = RANKS.indexOf(s[0]!.toUpperCase());
  const su = SUITS.indexOf(s[1]!.toLowerCase());
  if (r < 0 || su < 0) throw new Error(`Bad card: ${s}`);
  return makeCard(r, su);
}

export const parseCards = (s: string): Card[] => s.trim().split(/\s+/).filter(Boolean).map(parseCard);

export const cardToString = (c: Card) => RANKS[rankOf(c)]! + SUITS[suitOf(c)]!;

export function freshDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i);
}

export type Rng = () => number;

/** Uniform float in [0, 1) backed by crypto when available. */
export const cryptoRng: Rng = () => {
  const g = globalThis.crypto;
  if (g?.getRandomValues) {
    const buf = new Uint32Array(1);
    g.getRandomValues(buf);
    return buf[0]! / 0x1_0000_0000;
  }
  return Math.random();
};

/** Deterministic PRNG (mulberry32) for tests and simulations. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher–Yates shuffle. */
export function shuffle<T>(arr: T[], rng: Rng = cryptoRng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
