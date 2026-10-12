import type { Card } from "./cards";
import { type GameState, type LegalActions, type SeatState, legalActions, potTotal } from "./game";

export interface SeatView extends Omit<SeatState, "hole"> {
  /** Own cards, revealed showdown cards, or `null` per hidden card. */
  hole: (Card | null)[];
}

export interface TableView extends Omit<GameState, "deck" | "seats"> {
  seats: (SeatView | null)[];
  pot: number;
  /** Seat this view was made for (null = spectator). */
  hero: number | null;
  legal: LegalActions | null;
}

/** Strip everything a given seat is not allowed to see. */
export function toPlayerView(state: GameState, hero: number | null): TableView {
  const { deck: _deck, seats, ...rest } = state;
  const revealed = state.result?.revealed ?? {};
  return {
    ...structuredClone(rest),
    seats: seats.map((p, i) => {
      if (!p) return null;
      const visible = i === hero || revealed[i] !== undefined;
      return { ...structuredClone(p), hole: visible ? [...p.hole] : p.hole.map(() => null) };
    }),
    pot: potTotal(state),
    hero,
    legal: hero === null ? null : legalActions(state, hero),
  };
}
