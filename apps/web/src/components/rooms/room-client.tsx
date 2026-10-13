"use client";

import type { ChatMessage, PlayerAction, RoomState } from "@felt/engine";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTableSounds } from "@/hooks/use-table-sounds";
import { request, useSocket } from "@/lib/socket";
import { fmt, useProfile } from "@/lib/store";
import { toast } from "@/lib/toast";

import { SignInGate } from "../auth/sign-in-gate";
import { FitBox } from "../fit-box";
import { TopBar } from "../top-bar";
import { ActionBar } from "../table/action-bar";
import { PokerTable } from "../table/poker-table";
import { Button, ButtonLink } from "../ui/button";
import { Modal } from "../ui/modal";
import { ServerStatus } from "./server-status";
import { Chat } from "./chat";

type AckR<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export function RoomFromQuery() {
  const code = useSearchParams().get("code") ?? "";
  // Remount on code change so a new table starts from a clean slate.
  return <RoomClient key={code} code={code} />;
}

export function RoomClient({ code: raw }: { code: string }) {
  const code = raw.toUpperCase();
  const router = useRouter();
  const { socket, status } = useSocket();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [sitAt, setSitAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const joined = useRef(false);

  useTableSounds(room?.view ?? null);

  // Join on connect (and re-join after reconnects); leave when the page goes away.
  useEffect(() => {
    if (!socket || status !== "ready") return;
    const onState = (s: RoomState) => s.code === code && setRoom(s);
    const onChat = (m: ChatMessage) => setChat((c) => (c.some((x) => x.id === m.id) ? c : [...c.slice(-80), m]));
    const onClosed = ({ reason }: { reason: string }) => setError(reason);
    socket.on("room:state", onState);
    socket.on("room:chat", onChat);
    socket.on("room:closed", onClosed);
    socket.emit("room:join", { code }, (r) => {
      if (r.ok) {
        joined.current = true;
        setError(null);
      } else setError(r.error);
    });
    return () => {
      socket.off("room:state", onState);
      socket.off("room:chat", onChat);
      socket.off("room:closed", onClosed);
      if (joined.current) {
        joined.current = false;
        // The server returns any table chips and sends the updated bankroll.
        socket.emit("room:leave");
      }
    };
  }, [socket, status, code]);

  const act = useCallback(
    async (a: PlayerAction) => {
      if (!socket) return;
      setBusy(true);
      try {
        const r = await request<AckR>((cb) => socket.emit("game:action", a, cb));
        if (!r.ok) toast("Action rejected", r.error, "error");
      } catch (e) {
        toast("Connection problem", (e as Error).message, "error");
      } finally {
        setBusy(false);
      }
    },
    [socket],
  );

  const stand = async () => {
    if (!socket) return;
    const r = await request<AckR<{ cashOut: number }>>((cb) => socket.emit("room:stand", cb));
    if (!r.ok) toast("Couldn't stand up", r.error, "error");
  };

  const start = async () => {
    if (!socket) return;
    const r = await request<AckR>((cb) => socket.emit("room:start", cb));
    if (!r.ok) toast("Can't start yet", r.error, "error");
  };

  const rebuy = async () => {
    if (!socket || !room) return;
    const amount = Math.min(useProfile.getState().account?.chips ?? 0, room.settings.maxBuyIn);
    if (amount <= 0) return toast("Your bankroll is empty", "Come back tomorrow for your daily bonus.", "error");
    const r = await request<AckR<{ amount: number }>>((cb) => socket.emit("room:rebuy", { amount }, cb));
    if (r.ok) toast(`Added ${fmt(r.amount)} chips`, undefined, "success");
    else toast("Couldn't add chips", r.error, "error");
  };

  if (status === "signed-out")
    return (
      <main className="room-bg flex min-h-dvh flex-col">
        <TopBar back={{ href: "/", label: "Lobby" }} />
        <div className="mt-10 px-4">
          <SignInGate>{null}</SignInGate>
        </div>
      </main>
    );

  if (error)
    return (
      <main className="room-bg flex min-h-dvh flex-col">
        <TopBar back={{ href: "/", label: "Lobby" }} />
        <div className="mx-auto mt-16 max-w-md px-4 text-center">
          <span className="font-display text-7xl text-white/10">♦</span>
          <h1 className="mt-4 font-display text-4xl font-semibold">Table not found</h1>
          <p className="mt-3 text-cream/60">{error}. Check the code with your host, or browse the public lobby.</p>
          <div className="mt-8 flex justify-center gap-3">
            <ButtonLink href="/friends" variant="glass">
              Enter a code
            </ButtonLink>
            <ButtonLink href="/online">Public lobby</ButtonLink>
          </div>
        </div>
      </main>
    );

  const view = room?.view;
  const me = room && room.mySeat !== null ? view!.seats[room.mySeat] : null;
  const seatedCount = view?.seats.filter(Boolean).length ?? 0;
  const myTurn = !!view?.legal && view.toAct === room?.mySeat && view.street !== "complete";
  const handLive = view && view.street !== "waiting" && view.street !== "complete";

  let center: React.ReactNode = null;
  if (room && !room.started) {
    center = (
      <WaitingCard room={room} seated={seatedCount} onStart={start} />
    );
  } else if (room && !handLive && seatedCount < 2) {
    center = <p className="rounded-full bg-black/40 px-4 py-1.5 text-sm text-cream/70">Waiting for another player to sit down…</p>;
  }

  return (
    <main className="room-bg relative flex min-h-dvh flex-col md:h-dvh md:overflow-hidden">
      <TopBar back={{ href: room?.settings.visibility === "public" ? "/online" : "/friends", label: "Leave" }} className="shrink-0 sm:h-16" />
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-4 px-3 pb-3 sm:px-6">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <ServerStatus />
          {/* Room header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate font-display text-xl font-semibold sm:text-2xl">{room?.settings.name ?? "Joining table…"}</h1>
              {room && (
                <CodeBadge code={room.code} />
              )}
            </div>
            {room && (
              <div className="flex items-center gap-2 text-xs text-cream/50">
                <span className="hidden sm:inline">
                  {room.settings.variant === "omaha" ? "Pot-Limit Omaha" : "No-Limit Hold'em"} · {room.settings.smallBlind}/{room.settings.bigBlind}
                  {room.spectators > 0 && ` · ${room.spectators} watching`}
                </span>
                {me && (
                  <Button size="sm" variant="ghost" onClick={stand}>
                    Stand up
                  </Button>
                )}
                <Button size="sm" variant="glass" onClick={() => router.push(room.settings.visibility === "public" ? "/online" : "/")}>
                  Leave
                </Button>
                <Button size="sm" variant="glass" className="lg:hidden" onClick={() => setChatOpen(true)}>
                  Chat
                </Button>
              </div>
            )}
          </div>

          {view ? (
            <FitBox aspect={16 / 9.4} portraitAspect={3 / 4.4}>
              <PokerTable
                view={view}
                turnDeadline={room?.turnDeadline}
                actionTime={room?.settings.actionTime}
                away={room?.away}
                onSit={room && room.mySeat === null ? (seat) => setSitAt(seat) : undefined}
                center={center}
              />
            </FitBox>
          ) : (
            <div className="grid flex-1 place-items-center text-cream/50">{status === "ready" ? "Joining table…" : "Connecting…"}</div>
          )}

          <div className="relative z-30 min-h-[52px] shrink-0">
            <AnimatePresence>{myTurn && view && <ActionBar key="bar" view={view} onAct={act} busy={busy} />}</AnimatePresence>
            {!myTurn && room && (
              <div className="flex flex-wrap items-center justify-center gap-3 py-2 text-sm text-cream/55">
                {room.mySeat === null ? (
                  <span>You&apos;re watching. Click an empty seat to sit down.</span>
                ) : me && me.stack === 0 && !handLive ? (
                  <>
                    <span>You&apos;re out of chips.</span>
                    <Button size="sm" onClick={rebuy}>
                      Rebuy
                    </Button>
                  </>
                ) : handLive && me && !me.folded ? (
                  <span>Waiting for {view?.toAct !== null && view?.toAct !== undefined ? view.seats[view.toAct]?.name : "players"}…</span>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Chat: sidebar on large screens */}
        <aside className="hidden w-80 shrink-0 flex-col pb-1 lg:flex">
          <Chat messages={chat} socket={socket} />
        </aside>
      </div>

      <Modal open={chatOpen} onClose={() => setChatOpen(false)} className="h-[70dvh] max-w-md p-0 sm:p-0">
        <Chat messages={chat} socket={socket} />
      </Modal>

      {room && sitAt !== null && (
        <BuyInModal
          room={room}
          seat={sitAt}
          onClose={() => setSitAt(null)}
          onSat={() => setSitAt(null)}
        />
      )}
    </main>
  );
}

function CodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const link = `${window.location.origin}/room?code=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Room code", code);
    }
  };
  return (
    <button
      onClick={copy}
      className="group flex items-center gap-2 rounded-full bg-black/40 py-1 pl-3 pr-2 ring-1 ring-gold-300/25 transition hover:ring-gold-300/60"
      title="Copy invite link"
    >
      <span className="font-mono text-sm font-bold tracking-[0.25em] text-gold-100">{code}</span>
      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream/60 group-hover:text-cream">
        {copied ? "Copied!" : "Copy link"}
      </span>
    </button>
  );
}

function WaitingCard({ room, seated, onStart }: { room: RoomState; seated: number; onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1 flex max-w-xs flex-col items-center gap-2 rounded-2xl bg-black/55 px-5 py-4 text-center ring-1 ring-gold-300/20 backdrop-blur"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold-300/80">Private room</p>
      <p className="text-sm text-cream/75">
        {room.isHost
          ? seated < 2
            ? "Share the code with friends. You need at least two seated players."
            : `${seated} players seated. Ready when you are.`
          : "Waiting for the host to start the game…"}
      </p>
      {room.isHost && (
        <Button size="sm" onClick={onStart} disabled={seated < 2}>
          Start game
        </Button>
      )}
    </motion.div>
  );
}

function BuyInModal({ room, seat, onClose, onSat }: { room: RoomState; seat: number; onClose: () => void; onSat: () => void }) {
  const { socket } = useSocket();
  const bankroll = useProfile((s) => s.account?.chips ?? 0);
  const { minBuyIn, maxBuyIn, bigBlind } = room.settings;
  const max = Math.min(maxBuyIn, bankroll);
  const [amount, setAmount] = useState(() => Math.min(max, Math.max(minBuyIn, Math.round((minBuyIn + maxBuyIn) / 2 / bigBlind) * bigBlind)));
  const [busy, setBusy] = useState(false);
  const canAfford = bankroll >= minBuyIn;

  const sit = async () => {
    if (!socket) return;
    setBusy(true);
    try {
      const r = await request<AckR<{ buyIn: number }>>((cb) => socket.emit("room:sit", { seat, buyIn: amount }, cb));
      if (!r.ok) throw new Error(r.error);
      onSat();
    } catch (e) {
      toast("Couldn't sit down", (e as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-300/70">Seat {seat + 1}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Buy in</h2>
      {canAfford ? (
        <>
          <p className="mt-2 text-sm text-cream/55">
            Bring between {fmt(minBuyIn)} and {fmt(maxBuyIn)} chips. Unused chips go back to your bankroll ({fmt(bankroll)}) when you leave.
          </p>
          <div className="mt-8 text-center">
            <p className="font-display text-5xl font-semibold tabular-nums text-gold-100">{fmt(amount)}</p>
            <p className="mt-1 text-xs text-cream/40">{Math.round(amount / bigBlind)} big blinds</p>
          </div>
          <input
            type="range"
            className="gold-range mt-6 w-full"
            min={minBuyIn}
            max={max}
            step={bigBlind}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label="Buy-in amount"
          />
          <div className="mt-1 flex justify-between text-xs text-cream/40">
            <span>{fmt(minBuyIn)}</span>
            <span>{fmt(max)}</span>
          </div>
          <Button size="lg" className="mt-8 w-full" onClick={sit} disabled={busy}>
            {busy ? "Sitting down…" : `Sit down with ${fmt(amount)}`}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-cream/60">
            This table needs at least <span className="font-semibold text-gold-100">{fmt(minBuyIn)}</span> chips, and your bankroll has{" "}
            {fmt(bankroll)}. Try a table with lower blinds, or come back tomorrow for your daily bonus.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="glass" className="flex-1" onClick={onClose}>
              Watch instead
            </Button>
            <Link href="/learn/practice" className="flex-1">
              <Button className="w-full">Practise for free</Button>
            </Link>
          </div>
        </>
      )}
    </Modal>
  );
}

