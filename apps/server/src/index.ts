import { randomInt } from "node:crypto";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import {
  type Ack,
  type ClientToServer,
  type ServerToClient,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "@felt/engine";
import { buyIn, cashOut, claimDailyBonus, getAccount, publicInfo, recoverInPlay, setProfile, syncInPlay, type Account } from "./accounts";
import { handleAuth } from "./auth";
import { config } from "./config";
import { migrate, pool } from "./db";
import { allow, clientIp, limit, redis, resolveSession } from "./redis";
import { Room } from "./room";

const GRACE_MS = 60_000;

type IO = Server<ClientToServer, ServerToClient>;
type Sock = Socket<ClientToServer, ServerToClient, Record<string, never>, { playerId: string; name: string; avatar: string }>;

let shuttingDown = false;

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(shuttingDown ? 503 : 200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: !shuttingDown, rooms: rooms.size }));
    return;
  }
  void handleAuth(req, res).then((handled) => {
    if (!handled) res.writeHead(404).end();
  });
});
const io: IO = new Server(http, { cors: { origin: config.webOrigins }, maxHttpBufferSize: 16_000 });

const rooms = new Map<string, Room>();
/** playerId → room code they're currently in. */
const playerRoom = new Map<string, string>();
/** playerId → live sockets. */
const playerSockets = new Map<string, Set<string>>();

// ── helpers ──────────────────────────────────────────────────

function newCode(): string {
  for (;;) {
    let c = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
}

/** Push a fresh balance to every tab the player has open. */
function pushAccount(playerId: string, account: Account, note?: { title: string; body?: string }) {
  for (const id of playerSockets.get(playerId) ?? []) io.to(id).emit("account", { account: publicInfo(account), note });
}

/** Return table chips to the bankroll (the player may be offline). */
async function settle(playerId: string, amount: number, reason: string, notify = true): Promise<Account | null> {
  try {
    const account = await cashOut(playerId, amount, reason);
    if (notify) pushAccount(playerId, account, amount > 0 ? { title: `+${amount.toLocaleString()} chips back in your bankroll`, body: reason } : undefined);
    return account;
  } catch (e) {
    // The chips stay in `in_play` and are returned on the next boot.
    console.error(`cash-out failed for ${playerId} (${amount}):`, e);
    return null;
  }
}

function credit(playerId: string, amount: number, reason: string) {
  void settle(playerId, amount, reason);
}

let lobbyTimer: NodeJS.Timeout | null = null;
function lobbyChanged() {
  if (lobbyTimer) return;
  lobbyTimer = setTimeout(() => {
    lobbyTimer = null;
    io.to("lobby").emit("lobby:rooms", lobbyList());
  }, 250);
}

const lobbyList = () =>
  [...rooms.values()]
    .filter((r) => r.settings.visibility === "public")
    .map((r) => r.lobbyInfo())
    .sort((a, b) => b.seated - a.seated || b.createdAt - a.createdAt);

const hooks = {
  broadcast(room: Room) {
    for (const m of room.members.values()) {
      if (!m.sockets.size) continue;
      const st = room.stateFor(m.playerId);
      for (const id of m.sockets) io.to(id).emit("room:state", st);
    }
  },
  chat(room: Room, msg: Parameters<ServerToClient["room:chat"]>[0]) {
    io.to(`room:${room.code}`).emit("room:chat", msg);
  },
  credit,
  handComplete(stacks: { id: string; stack: number }[]) {
    syncInPlay(stacks).catch((e) => console.error("stack sync failed:", e));
  },
  lobbyChanged,
};

function closeIfEmpty(room: Room) {
  if (!room.isEmpty) return;
  room.destroy();
  rooms.delete(room.code);
  lobbyChanged();
}

/** Leave the current room and return any table chips to the bankroll. */
async function leaveCurrent(playerId: string, reason: string): Promise<number> {
  const code = playerRoom.get(playerId);
  if (!code) return 0;
  const room = rooms.get(code);
  playerRoom.delete(playerId);
  for (const id of playerSockets.get(playerId) ?? []) io.in(id).socketsLeave(`room:${code}`);
  if (!room) return 0;
  const cash = room.leave(playerId);
  closeIfEmpty(room);
  if (cash > 0) await settle(playerId, cash, reason);
  return cash;
}

// ── validation ───────────────────────────────────────────────

const settingsSchema = z
  .object({
    name: z.string().trim().max(32).default(""),
    variant: z.enum(["holdem", "omaha"]),
    smallBlind: z.number().int().min(1).max(10_000),
    bigBlind: z.number().int().min(2).max(20_000),
    maxSeats: z.number().int().min(2).max(9),
    minBuyIn: z.number().int().min(1),
    maxBuyIn: z.number().int().min(1),
    visibility: z.enum(["private", "public"]),
    actionTime: z.number().int().min(10).max(90).default(25),
  })
  .refine((s) => s.bigBlind >= s.smallBlind, "Big blind must be at least the small blind")
  .transform((s) => {
    const minBuyIn = Math.max(s.bigBlind * 10, s.minBuyIn);
    const maxBuyIn = Math.max(minBuyIn, Math.min(s.maxBuyIn, s.bigBlind * 500));
    return { ...s, minBuyIn, maxBuyIn };
  });

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fold") }),
  z.object({ type: z.literal("check") }),
  z.object({ type: z.literal("call") }),
  z.object({ type: z.literal("raise"), to: z.number().int().positive() }),
]);

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(20),
  avatar: z.string().min(1).max(16),
});

/** Postgres/Redis/network errors carry a `code`; their text is for logs, not players. */
const isInternal = (e: unknown) => !(e instanceof Error) || typeof (e as { code?: unknown }).code === "string";

const fail = (e: unknown): { ok: false; error: string } => {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  if (isInternal(e)) {
    console.error(e);
    return { ok: false, error: "Something went wrong on the server. Please try again" };
  }
  return { ok: false, error: (e as Error).message };
};

// ── connections ──────────────────────────────────────────────

// Every socket must carry a valid session from Google sign-in.
io.use(async (socket, next) => {
  try {
    if (shuttingDown) return next(new Error("restarting"));
    if (!(await allow(`conn:${clientIp(socket.request)}`, 30, 60))) return next(new Error("rate_limited"));
    const userId = await resolveSession(socket.handshake.auth?.session);
    const account = userId ? await getAccount(userId) : null;
    if (!account || account.banned) return next(new Error("unauthorized"));
    socket.data = { playerId: account.id, name: account.name, avatar: account.avatar };
    next();
  } catch (e) {
    console.error("handshake failed:", e);
    next(new Error("unavailable"));
  }
});

io.on("connection", (socket: Sock) => {
  // Simple token bucket: 15 events/sec burst, refilled continuously.
  let tokens = 15;
  let last = Date.now();
  socket.use((_packet, next) => {
    const now = Date.now();
    tokens = Math.min(15, tokens + ((now - last) / 1000) * 10);
    last = now;
    if (tokens < 1) return next(new Error("Slow down"));
    tokens--;
    next();
  });

  const ack = <T extends object>(cb: unknown, fn: () => Ack<T> | Promise<Ack<T>>) => {
    void (async () => {
      try {
        const r = await fn();
        if (typeof cb === "function") cb(r);
      } catch (e) {
        const r = fail(e);
        if (typeof cb === "function") cb(r);
      }
    })();
  };

  const me = () => socket.data.playerId;
  const playerId = me();
  if (!playerSockets.has(playerId)) playerSockets.set(playerId, new Set());
  playerSockets.get(playerId)!.add(socket.id);
  const myRoom = () => {
    const code = playerRoom.get(me());
    const room = code ? rooms.get(code) : undefined;
    if (!room) throw new Error("You're not in a room");
    return room;
  };

  socket.on("hello", (payload, cb) =>
    ack(cb, async () => {
      // A brand-new account takes the name the player already picked on this device.
      const seed = profileSchema.safeParse(payload);
      let account = seed.success ? await setProfile(me(), seed.data.name, seed.data.avatar, true) : (await getAccount(me()))!;
      socket.data.name = account.name;
      socket.data.avatar = account.avatar;
      const bonus = await claimDailyBonus(me());
      account = bonus.account;
      if (bonus.amount) {
        const note = { title: `Daily bonus: +${bonus.amount.toLocaleString()} chips`, body: "Come back tomorrow for more." };
        setTimeout(() => socket.emit("account", { account: publicInfo(account), note }), 300);
      }
      return { ok: true, playerId: me(), account: publicInfo(account) };
    }),
  );

  socket.on("profile:update", (payload, cb) =>
    ack(cb, async () => {
      await limit(`profile:${me()}`, 10, 600, "Too many profile changes");
      const { name, avatar } = profileSchema.parse(payload);
      const account = await setProfile(me(), name, avatar);
      for (const id of playerSockets.get(me()) ?? []) {
        const s = io.sockets.sockets.get(id) as Sock | undefined;
        if (s) Object.assign(s.data, { name, avatar });
      }
      const code = playerRoom.get(me());
      if (code) rooms.get(code)?.rename(me(), name, avatar);
      return { ok: true, account: publicInfo(account) };
    }),
  );

  socket.on("lobby:subscribe", () => {
    socket.join("lobby");
    socket.emit("lobby:rooms", lobbyList());
  });
  socket.on("lobby:unsubscribe", () => void socket.leave("lobby"));

  socket.on("room:create", (raw, cb) =>
    ack(cb, async () => {
      const playerId = me();
      const settings = settingsSchema.parse(raw);
      if (rooms.size >= config.maxRooms) throw new Error("The server is full right now. Try again soon");
      await limit(`create:${playerId}`, 10, 600, "You're creating tables too quickly");
      const code = newCode();
      const name = settings.name || `${socket.data.name}'s table`;
      const room = new Room(code, { ...settings, name }, playerId, socket.data.name!, hooks);
      rooms.set(code, room);
      lobbyChanged();
      return { ok: true, code };
    }),
  );

  socket.on("room:join", (raw, cb) =>
    ack(cb, async () => {
      const playerId = me();
      await limit(`join:${playerId}`, 30, 60, "Too many attempts");
      const code = z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH).parse(raw?.code);
      const room = rooms.get(code);
      if (!room) throw new Error("No table found with that code");
      const current = playerRoom.get(playerId);
      if (current && current !== code) {
        await leaveCurrent(playerId, "Cashed out when you switched tables");
      }
      playerRoom.set(playerId, code);
      socket.join(`room:${code}`);
      room.join(playerId, socket.data.name!, socket.data.avatar!, socket.id);
      for (const m of room.chatLog.slice(-30)) socket.emit("room:chat", m);
      return { ok: true, code };
    }),
  );

  socket.on("room:leave", (cb) =>
    ack(cb, async () => {
      const amount = await leaveCurrent(me(), "You left the table");
      return { ok: true, cashOut: amount };
    }),
  );

  // Chips leave the bankroll before they reach the table, and go back if seating fails.
  socket.on("room:sit", (raw, cb) =>
    ack(cb, async () => {
      const p = z.object({ seat: z.number().int(), buyIn: z.number().int().positive() }).parse(raw);
      const room = myRoom();
      const amount = room.sitAmount(me(), p.seat, p.buyIn);
      const account = await buyIn(me(), amount, `Buy-in at table ${room.code}`);
      try {
        if (rooms.get(room.code) !== room) throw new Error("The table closed");
        room.sit(me(), p.seat, amount);
      } catch (e) {
        await settle(me(), amount, "Buy-in refunded");
        throw e;
      }
      pushAccount(me(), account);
      return { ok: true, buyIn: amount };
    }),
  );

  socket.on("room:stand", (cb) =>
    ack(cb, async () => {
      const amount = myRoom().stand(me());
      if (amount > 0) await settle(me(), amount, "You stood up from the table");
      return { ok: true, cashOut: amount };
    }),
  );

  socket.on("room:rebuy", (raw, cb) =>
    ack(cb, async () => {
      const room = myRoom();
      const add = room.rebuyAmount(me(), z.number().int().positive().parse(raw?.amount));
      const account = await buyIn(me(), add, `Top-up at table ${room.code}`);
      try {
        if (rooms.get(room.code) !== room) throw new Error("The table closed");
        room.rebuy(me(), add);
      } catch (e) {
        await settle(me(), add, "Top-up refunded");
        throw e;
      }
      pushAccount(me(), account);
      return { ok: true, amount: add };
    }),
  );

  socket.on("room:start", (cb) =>
    ack(cb, () => {
      myRoom().start(me());
      return { ok: true };
    }),
  );

  socket.on("game:action", (raw, cb) =>
    ack(cb, () => {
      myRoom().act(me(), actionSchema.parse(raw));
      return { ok: true };
    }),
  );

  socket.on("chat:send", (raw) => {
    void (async () => {
      try {
        const text = z.string().max(400).parse(raw?.text);
        const room = myRoom();
        if (!(await allow(`chat:${me()}`, 8, 15))) return socket.emit("room:chat", { id: `rl${Date.now()}`, name: "Dealer", avatar: "🎩", text: "Slow down, you're sending messages too quickly.", at: Date.now(), system: true });
        room.say(me(), text);
      } catch {
        /* ignore */
      }
    })();
  });

  socket.on("disconnect", () => {
    playerSockets.get(playerId)?.delete(socket.id);
    if (playerSockets.get(playerId)?.size === 0) playerSockets.delete(playerId);
    const code = playerRoom.get(playerId);
    const room = code ? rooms.get(code) : undefined;
    room?.dropSocket(playerId, socket.id);
  });
});

// Clean up players who disconnected and never came back.
setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    room.sweep(now, GRACE_MS);
    closeIfEmpty(room);
  }
  for (const [playerId, code] of playerRoom) if (!rooms.get(code)?.members.has(playerId)) playerRoom.delete(playerId);
}, 5_000);

// ── lifecycle ────────────────────────────────────────────────

/** Cash everyone out before exiting, so a deploy never costs anyone chips. */
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, closing ${rooms.size} tables…`);
  const refunds = [...rooms.values()].flatMap((room) => {
    io.to(`room:${room.code}`).emit("room:closed", { reason: "The server is restarting for an update. Your chips are back in your bankroll" });
    return room.shutdown();
  });
  rooms.clear();
  await Promise.all(refunds.map((r) => settle(r.id, r.amount, "Table closed for a server update")));
  io.close();
  await Promise.allSettled([pool.end(), redis.quit()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await migrate();
const recovered = await recoverInPlay();
if (recovered) console.log(`returned table chips to ${recovered} players after an unclean shutdown`);
http.listen(config.port, () => console.log(`♠ Felt server listening on :${config.port}`));
