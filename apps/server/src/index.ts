import { createHash, randomInt } from "node:crypto";
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
import { Room } from "./room";

const PORT = Number(process.env.PORT ?? 4000);
const ORIGINS = process.env.CORS_ORIGIN?.split(",") ?? true;
const GRACE_MS = 60_000;

type IO = Server<ClientToServer, ServerToClient>;
type Sock = Socket<ClientToServer, ServerToClient, Record<string, never>, { playerId?: string; name?: string; avatar?: string }>;

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404).end();
});
const io: IO = new Server(http, { cors: { origin: ORIGINS } });

const rooms = new Map<string, Room>();
/** playerId → room code they're currently in. */
const playerRoom = new Map<string, string>();
/** playerId → live sockets. */
const playerSockets = new Map<string, Set<string>>();
/** Chips owed to players who weren't connected at cash-out time. */
const pendingCredits = new Map<string, number>();

// ── helpers ──────────────────────────────────────────────────

function newCode(): string {
  for (;;) {
    let c = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
}

function credit(playerId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  const socks = playerSockets.get(playerId);
  if (socks?.size) {
    for (const id of socks) io.to(id).emit("bankroll:credit", { amount, reason });
  } else {
    pendingCredits.set(playerId, (pendingCredits.get(playerId) ?? 0) + amount);
  }
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
  lobbyChanged,
};

function closeIfEmpty(room: Room) {
  if (!room.isEmpty) return;
  room.destroy();
  rooms.delete(room.code);
  lobbyChanged();
}

function leaveCurrent(socket: Sock, playerId: string): number {
  const code = playerRoom.get(playerId);
  if (!code) return 0;
  const room = rooms.get(code);
  playerRoom.delete(playerId);
  for (const id of playerSockets.get(playerId) ?? []) io.in(id).socketsLeave(`room:${code}`);
  if (!room) return 0;
  const cash = room.leave(playerId);
  closeIfEmpty(room);
  void socket;
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

const helloSchema = z.object({
  token: z.string().min(16).max(128),
  name: z.string().trim().min(1).max(20),
  avatar: z.string().max(16),
});

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Invalid input") : e instanceof Error ? e.message : "Something went wrong",
});

// ── connections ──────────────────────────────────────────────

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

  const ack = <T extends object>(cb: unknown, fn: () => Ack<T>) => {
    if (typeof cb !== "function") return;
    try {
      cb(fn());
    } catch (e) {
      cb(fail(e));
    }
  };

  const me = () => {
    const id = socket.data.playerId;
    if (!id) throw new Error("Say hello first");
    return id;
  };
  const myRoom = () => {
    const code = playerRoom.get(me());
    const room = code ? rooms.get(code) : undefined;
    if (!room) throw new Error("You're not in a room");
    return room;
  };

  socket.on("hello", (payload, cb) =>
    ack(cb, () => {
      const { token, name, avatar } = helloSchema.parse(payload);
      const playerId = createHash("sha256").update(token).digest("hex").slice(0, 20);
      socket.data = { playerId, name, avatar };
      if (!playerSockets.has(playerId)) playerSockets.set(playerId, new Set());
      playerSockets.get(playerId)!.add(socket.id);
      const owed = pendingCredits.get(playerId);
      if (owed) {
        pendingCredits.delete(playerId);
        setTimeout(() => socket.emit("bankroll:credit", { amount: owed, reason: "Chips returned from a table you left" }), 300);
      }
      return { ok: true, playerId };
    }),
  );

  socket.on("lobby:subscribe", () => {
    socket.join("lobby");
    socket.emit("lobby:rooms", lobbyList());
  });
  socket.on("lobby:unsubscribe", () => void socket.leave("lobby"));

  socket.on("room:create", (raw, cb) =>
    ack(cb, () => {
      const playerId = me();
      const settings = settingsSchema.parse(raw);
      const code = newCode();
      const name = settings.name || `${socket.data.name}'s table`;
      const room = new Room(code, { ...settings, name }, playerId, socket.data.name!, hooks);
      rooms.set(code, room);
      lobbyChanged();
      return { ok: true, code };
    }),
  );

  socket.on("room:join", (raw, cb) =>
    ack(cb, () => {
      const playerId = me();
      const code = z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH).parse(raw?.code);
      const room = rooms.get(code);
      if (!room) throw new Error("No table found with that code");
      const current = playerRoom.get(playerId);
      if (current && current !== code) {
        const cash = leaveCurrent(socket, playerId);
        if (cash) credit(playerId, cash, "Cashed out when you switched tables");
      }
      playerRoom.set(playerId, code);
      socket.join(`room:${code}`);
      room.join(playerId, socket.data.name!, socket.data.avatar!, socket.id);
      for (const m of room.chatLog.slice(-30)) socket.emit("room:chat", m);
      return { ok: true, code };
    }),
  );

  socket.on("room:leave", (cb) =>
    ack(cb, () => {
      const cashOut = leaveCurrent(socket, me());
      return { ok: true, cashOut };
    }),
  );

  socket.on("room:sit", (raw, cb) =>
    ack(cb, () => {
      const p = z.object({ seat: z.number().int(), buyIn: z.number().int().positive() }).parse(raw);
      const buyIn = myRoom().sit(me(), p.seat, p.buyIn);
      return { ok: true, buyIn };
    }),
  );

  socket.on("room:stand", (cb) => ack(cb, () => ({ ok: true, cashOut: myRoom().stand(me()) })));

  socket.on("room:rebuy", (raw, cb) =>
    ack(cb, () => {
      const amount = z.number().int().positive().parse(raw?.amount);
      return { ok: true, amount: myRoom().rebuy(me(), amount) };
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
    try {
      myRoom().say(me(), z.string().max(400).parse(raw?.text));
    } catch {
      /* ignore */
    }
  });

  socket.on("disconnect", () => {
    const playerId = socket.data.playerId;
    if (!playerId) return;
    playerSockets.get(playerId)?.delete(socket.id);
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

http.listen(PORT, () => console.log(`♠ Felt server listening on :${PORT}`));
