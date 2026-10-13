import type { Variant } from "./evaluator";
import type { PlayerAction } from "./game";
import type { TableView } from "./view";

/** Shared contract between the Socket.io server and the web client. All chips are play money. */

export type Visibility = "private" | "public";

export interface RoomSettings {
  name: string;
  variant: Variant;
  smallBlind: number;
  bigBlind: number;
  maxSeats: number;
  minBuyIn: number;
  maxBuyIn: number;
  visibility: Visibility;
  /** Seconds per decision. */
  actionTime: number;
}

export interface LobbyRoom {
  code: string;
  name: string;
  variant: Variant;
  smallBlind: number;
  bigBlind: number;
  seated: number;
  maxSeats: number;
  minBuyIn: number;
  maxBuyIn: number;
  hostName: string;
  playing: boolean;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  name: string;
  avatar: string;
  text: string;
  at: number;
  system?: boolean;
}

export interface RoomState {
  code: string;
  settings: RoomSettings;
  hostId: string;
  isHost: boolean;
  /** Private rooms wait for the host to press start. */
  started: boolean;
  view: TableView;
  mySeat: number | null;
  spectators: number;
  /** Epoch ms when the current actor times out. */
  turnDeadline: number | null;
  /** Seats whose player is temporarily disconnected. */
  away: number[];
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** The signed-in player's account. Chips live on the server, never in the browser. */
export interface AccountInfo {
  name: string;
  avatar: string;
  chips: number;
}

export const STARTING_BANKROLL = 10_000;
export const DAILY_BONUS = 2_000;

export interface ClientToServer {
  /** Sent after connecting. `name`/`avatar` seed a brand-new account's profile. */
  hello: (p: { name: string; avatar: string }, ack: (r: Ack<{ playerId: string; account: AccountInfo }>) => void) => void;
  "profile:update": (p: { name: string; avatar: string }, ack: (r: Ack<{ account: AccountInfo }>) => void) => void;
  "lobby:subscribe": () => void;
  "lobby:unsubscribe": () => void;
  "room:create": (s: RoomSettings, ack: (r: Ack<{ code: string }>) => void) => void;
  "room:join": (p: { code: string }, ack: (r: Ack<{ code: string }>) => void) => void;
  "room:leave": (ack?: (r: Ack<{ cashOut: number }>) => void) => void;
  "room:sit": (p: { seat: number; buyIn: number }, ack: (r: Ack<{ buyIn: number }>) => void) => void;
  "room:stand": (ack: (r: Ack<{ cashOut: number }>) => void) => void;
  "room:rebuy": (p: { amount: number }, ack: (r: Ack<{ amount: number }>) => void) => void;
  "room:start": (ack: (r: Ack) => void) => void;
  "game:action": (a: PlayerAction, ack: (r: Ack) => void) => void;
  "chat:send": (p: { text: string }) => void;
}

export interface ServerToClient {
  "lobby:rooms": (rooms: LobbyRoom[]) => void;
  "room:state": (s: RoomState) => void;
  "room:chat": (m: ChatMessage) => void;
  "room:closed": (p: { reason: string }) => void;
  /** The player's bankroll changed. `note` explains why (e.g. chips returned after a disconnect). */
  account: (p: { account: AccountInfo; note?: { title: string; body?: string } }) => void;
}

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export const STAKES = [
  { sb: 5, bb: 10 },
  { sb: 10, bb: 20 },
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 100, bb: 200 },
] as const;

export function defaultSettings(visibility: Visibility, bb = 20, variant: Variant = "holdem"): RoomSettings {
  return {
    name: "",
    variant,
    smallBlind: bb / 2,
    bigBlind: bb,
    maxSeats: 6,
    minBuyIn: bb * 40,
    maxBuyIn: bb * 100,
    visibility,
    actionTime: 25,
  };
}
