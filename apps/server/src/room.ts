import {
  type ChatMessage,
  type GameState,
  type LobbyRoom,
  type PlayerAction,
  type RoomSettings,
  type RoomState,
  addChips,
  applyAction,
  canStartHand,
  createTable,
  isHandLive,
  legalActions,
  sitDown,
  standUp,
  startHand,
  toPlayerView,
} from "@felt/engine";

export interface Member {
  playerId: string;
  name: string;
  avatar: string;
  sockets: Set<string>;
  seat: number | null;
  disconnectedAt: number | null;
  /** Stand up once the current hand finishes. */
  leaving: boolean;
}

export interface RoomHooks {
  /** Push fresh personalised state to every member. */
  broadcast(room: Room): void;
  chat(room: Room, msg: ChatMessage): void;
  /** Return chips to a player's bankroll. */
  credit(playerId: string, amount: number, reason: string): void;
  lobbyChanged(): void;
}

const NEXT_HAND_DELAY = 5500;
const FIRST_HAND_DELAY = 1500;
const DISCONNECTED_ACT_TIME = 4000;

let msgId = 0;

export class Room {
  state: GameState;
  members = new Map<string, Member>();
  chatLog: ChatMessage[] = [];
  started: boolean;
  turnDeadline: number | null = null;
  readonly createdAt = Date.now();
  private turnTimer: NodeJS.Timeout | null = null;
  private handTimer: NodeJS.Timeout | null = null;
  private lastTurnKey = "";

  constructor(
    readonly code: string,
    readonly settings: RoomSettings,
    public hostId: string,
    public hostName: string,
    private hooks: RoomHooks,
  ) {
    this.state = createTable({
      variant: settings.variant,
      smallBlind: settings.smallBlind,
      bigBlind: settings.bigBlind,
      maxSeats: settings.maxSeats,
    });
    // Public tables deal automatically; friend tables wait for the host.
    this.started = settings.visibility === "public";
  }

  // ── membership ──────────────────────────────────────────────

  join(playerId: string, name: string, avatar: string, socketId: string) {
    let m = this.members.get(playerId);
    if (!m) {
      m = { playerId, name, avatar, sockets: new Set(), seat: null, disconnectedAt: null, leaving: false };
      this.members.set(playerId, m);
      this.system(`${name} joined the room`);
    }
    m.sockets.add(socketId);
    m.disconnectedAt = null;
    m.leaving = false;
    m.name = name;
    m.avatar = avatar;
    this.changed();
  }

  /** Socket dropped. Returns true if the member has no sockets left. */
  dropSocket(playerId: string, socketId: string): boolean {
    const m = this.members.get(playerId);
    if (!m) return false;
    m.sockets.delete(socketId);
    if (m.sockets.size === 0) {
      m.disconnectedAt = Date.now();
      this.changed();
      return true;
    }
    return false;
  }

  /** Fully remove a member, cashing them out. Returns chips cashed out (0 if deferred). */
  leave(playerId: string): number {
    const m = this.members.get(playerId);
    if (!m) return 0;
    let cashOut = 0;
    if (m.seat !== null) cashOut = this.stand(playerId);
    this.members.delete(playerId);
    this.system(`${m.name} left the room`);
    if (this.hostId === playerId) {
      const next = [...this.members.values()].find((x) => x.disconnectedAt === null) ?? [...this.members.values()][0];
      if (next) {
        this.hostId = next.playerId;
        this.hostName = next.name;
        this.system(`${next.name} is now the host`);
      }
    }
    this.changed();
    return cashOut;
  }

  sit(playerId: string, seat: number, buyIn: number): number {
    const m = this.members.get(playerId);
    if (!m) throw new Error("Join the room first");
    if (m.seat !== null) throw new Error("You're already seated");
    if (seat < 0 || seat >= this.settings.maxSeats) throw new Error("Invalid seat");
    if (this.state.seats[seat]) throw new Error("That seat is taken");
    const amount = Math.max(this.settings.minBuyIn, Math.min(this.settings.maxBuyIn, Math.floor(buyIn)));
    this.state = sitDown(this.state, seat, { id: playerId, name: m.name, avatar: m.avatar }, amount);
    m.seat = seat;
    this.system(`${m.name} sat down with ${amount.toLocaleString()} chips`);
    this.changed();
    return amount;
  }

  stand(playerId: string): number {
    const m = this.members.get(playerId);
    if (!m || m.seat === null) return 0;
    const { state, cashOut } = standUp(this.state, m.seat);
    this.state = state;
    m.seat = null;
    this.system(`${m.name} stood up`);
    this.changed();
    return cashOut;
  }

  rebuy(playerId: string, amount: number): number {
    const m = this.members.get(playerId);
    if (!m || m.seat === null) throw new Error("Not seated");
    const p = this.state.seats[m.seat]!;
    if (isHandLive(this.state) && !p.sittingOut) throw new Error("Wait for the hand to finish");
    const room = this.settings.maxBuyIn - p.stack;
    const add = Math.max(0, Math.min(room, Math.floor(amount)));
    if (add <= 0) throw new Error("You're already at the maximum buy-in");
    this.state = addChips(this.state, m.seat, add);
    this.changed();
    return add;
  }

  start(playerId: string) {
    if (playerId !== this.hostId) throw new Error("Only the host can start the game");
    if (this.started) return;
    if (!canStartHand(this.state)) throw new Error("At least two seated players are needed");
    this.started = true;
    this.system("The host started the game. Good luck!");
    this.changed();
  }

  act(playerId: string, action: PlayerAction) {
    const m = this.members.get(playerId);
    if (!m || m.seat === null) throw new Error("Not seated");
    if (this.state.toAct !== m.seat) throw new Error("Not your turn");
    this.state = applyAction(this.state, m.seat, action);
    this.changed();
  }

  say(playerId: string, text: string) {
    const m = this.members.get(playerId);
    if (!m) return;
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 200);
    if (!clean) return;
    this.push({ id: `m${++msgId}`, name: m.name, avatar: m.avatar, text: clean, at: Date.now() });
  }

  private system(text: string) {
    this.push({ id: `m${++msgId}`, name: "Dealer", avatar: "🎩", text, at: Date.now(), system: true });
  }

  private push(msg: ChatMessage) {
    this.chatLog.push(msg);
    if (this.chatLog.length > 60) this.chatLog.shift();
    this.hooks.chat(this, msg);
  }

  // ── game loop ───────────────────────────────────────────────

  /** Called after every mutation: schedules hands and turn timers, then broadcasts. */
  private changed() {
    this.schedule();
    this.hooks.broadcast(this);
    if (this.settings.visibility === "public") this.hooks.lobbyChanged();
  }

  private schedule() {
    const s = this.state;
    if (isHandLive(s) && s.toAct !== null) {
      const key = `${s.handNumber}:${s.street}:${s.toAct}:${s.log.length}`;
      if (key !== this.lastTurnKey) {
        this.lastTurnKey = key;
        this.clearTurn();
        const actor = this.memberAtSeat(s.toAct);
        const ms = actor?.disconnectedAt ? DISCONNECTED_ACT_TIME : this.settings.actionTime * 1000;
        this.turnDeadline = Date.now() + ms;
        const seat = s.toAct;
        this.turnTimer = setTimeout(() => this.timeout(seat), ms);
      }
      return;
    }
    this.clearTurn();
    if (!isHandLive(s) && this.started && !this.handTimer) {
      if (s.street === "complete") this.afterHand();
      // afterHand may have re-entered schedule() and already queued the next hand.
      if (this.handTimer) return;
      if (canStartHand(this.state)) {
        const delay = this.state.street === "complete" ? NEXT_HAND_DELAY : FIRST_HAND_DELAY;
        this.handTimer = setTimeout(() => {
          this.handTimer = null;
          if (!isHandLive(this.state) && canStartHand(this.state)) {
            this.state = startHand(this.state);
            this.changed();
          }
        }, delay);
      }
    }
  }

  /** Between hands: remove players who left or have been gone too long. */
  private afterHand() {
    for (const m of [...this.members.values()]) {
      if (m.leaving || (m.disconnectedAt && Date.now() - m.disconnectedAt > 60_000)) {
        const cash = this.leave(m.playerId);
        if (cash > 0) this.hooks.credit(m.playerId, cash, `Cashed out from table ${this.code}`);
      }
    }
  }

  private timeout(seat: number) {
    this.turnTimer = null;
    const s = this.state;
    if (!isHandLive(s) || s.toAct !== seat) return;
    const legal = legalActions(s, seat);
    if (!legal) return;
    this.state = applyAction(s, seat, legal.canCheck ? { type: "check" } : { type: "fold" });
    const m = this.memberAtSeat(seat);
    if (m && !m.disconnectedAt) this.system(`${m.name} ran out of time`);
    this.changed();
  }

  private clearTurn() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.turnDeadline = null;
    this.lastTurnKey = "";
  }

  memberAtSeat(seat: number): Member | undefined {
    for (const m of this.members.values()) if (m.seat === seat) return m;
    return undefined;
  }

  /** Disconnected members whose grace period expired and who are not in a hand. */
  sweep(now: number, graceMs: number) {
    for (const m of [...this.members.values()]) {
      if (!m.disconnectedAt || now - m.disconnectedAt < graceMs) continue;
      if (isHandLive(this.state) && m.seat !== null && !this.state.seats[m.seat]!.folded) {
        m.leaving = true; // wait for the hand to end
        continue;
      }
      const cash = this.leave(m.playerId);
      if (cash > 0) this.hooks.credit(m.playerId, cash, `Cashed out from table ${this.code}`);
    }
  }

  get isEmpty() {
    return this.members.size === 0;
  }

  destroy() {
    this.clearTurn();
    if (this.handTimer) clearTimeout(this.handTimer);
    this.handTimer = null;
  }

  // ── views ───────────────────────────────────────────────────

  stateFor(playerId: string): RoomState {
    const m = this.members.get(playerId);
    const seat = m?.seat ?? null;
    return {
      code: this.code,
      settings: this.settings,
      hostId: this.hostId,
      isHost: playerId === this.hostId,
      started: this.started,
      view: toPlayerView(this.state, seat),
      mySeat: seat,
      spectators: [...this.members.values()].filter((x) => x.seat === null).length,
      turnDeadline: this.turnDeadline,
      away: [...this.members.values()].flatMap((x) => (x.seat !== null && x.disconnectedAt ? [x.seat] : [])),
    };
  }

  lobbyInfo(): LobbyRoom {
    return {
      code: this.code,
      name: this.settings.name,
      variant: this.settings.variant,
      smallBlind: this.settings.smallBlind,
      bigBlind: this.settings.bigBlind,
      seated: this.state.seats.filter(Boolean).length,
      maxSeats: this.settings.maxSeats,
      minBuyIn: this.settings.minBuyIn,
      maxBuyIn: this.settings.maxBuyIn,
      hostName: this.hostName,
      playing: isHandLive(this.state),
      createdAt: this.createdAt,
    };
  }
}
