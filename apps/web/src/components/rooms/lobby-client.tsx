"use client";

import type { LobbyRoom, Variant } from "@felt/engine";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/lib/socket";
import { compact } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { CreateTableForm } from "./create-table-form";
import { ServerStatus } from "./server-status";

export function LobbyClient() {
  const router = useRouter();
  const { socket, status } = useSocket();
  const [rooms, setRooms] = useState<LobbyRoom[] | null>(null);
  const [variant, setVariant] = useState<Variant | "all">("all");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!socket || status !== "ready") return;
    const onRooms = (r: LobbyRoom[]) => setRooms(r);
    socket.on("lobby:rooms", onRooms);
    socket.emit("lobby:subscribe");
    return () => {
      socket.off("lobby:rooms", onRooms);
      socket.emit("lobby:unsubscribe");
    };
  }, [socket, status]);

  const shown = useMemo(() => (rooms ?? []).filter((r) => variant === "all" || r.variant === variant), [rooms, variant]);
  const quick = shown.find((r) => r.seated > 0 && r.seated < r.maxSeats) ?? shown.find((r) => r.seated < r.maxSeats);

  return (
    <>
      <ServerStatus />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="glass flex rounded-full p-1">
          {(["all", "holdem", "omaha"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                variant === v ? "bg-gold-400/20 text-gold-100" : "text-cream/60 hover:text-cream",
              )}
            >
              {v === "all" ? "All games" : v === "holdem" ? "Hold'em" : "Omaha"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {quick && (
            <Button variant="glass" onClick={() => router.push(`/room?code=${quick.code}`)}>
              ⚡ Quick seat
            </Button>
          )}
          <Button onClick={() => setCreating(true)} disabled={status !== "ready"}>
            + Open a table
          </Button>
        </div>
      </div>

      <div className="glass-strong overflow-hidden rounded-3xl">
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1.2fr_auto] gap-4 border-b border-white/5 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-cream/40 md:grid">
          <span>Table</span>
          <span>Game</span>
          <span>Blinds</span>
          <span>Buy-in</span>
          <span>Players</span>
          <span className="w-20" />
        </div>
        {rooms === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="font-display text-6xl text-white/10">♣</span>
            <p className="mt-4 font-display text-2xl">No open tables right now</p>
            <p className="mt-1 text-sm text-cream/50">Be the first. Open a table and others in the lobby can join you.</p>
            <Button className="mt-6" onClick={() => setCreating(true)} disabled={status !== "ready"}>
              Open a table
            </Button>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {shown.map((r) => {
                const full = r.seated >= r.maxSeats;
                return (
                  <motion.li
                    key={r.code}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-white/5 px-5 py-4 transition last:border-0 hover:bg-white/[0.025] md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr_auto] md:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="text-xs text-cream/40">
                        Host {r.hostName} {r.playing && <span className="ml-1 text-felt-500">● in play</span>}
                      </p>
                    </div>
                    <span className="hidden text-sm text-cream/70 md:block">{r.variant === "omaha" ? "PL Omaha" : "NL Hold'em"}</span>
                    <span className="hidden text-sm font-semibold tabular-nums text-gold-100 md:block">
                      {r.smallBlind}/{r.bigBlind}
                    </span>
                    <span className="hidden text-sm tabular-nums text-cream/60 md:block">
                      {compact(r.minBuyIn)}–{compact(r.maxBuyIn)}
                    </span>
                    <div className="col-start-1 flex items-center gap-2 md:col-start-auto">
                      <div className="flex gap-0.5">
                        {Array.from({ length: r.maxSeats }, (_, i) => (
                          <span key={i} className={cn("h-2.5 w-2.5 rounded-full", i < r.seated ? "bg-gold-300" : "bg-white/10")} />
                        ))}
                      </div>
                      <span className="text-xs text-cream/50">
                        {r.seated}/{r.maxSeats}
                      </span>
                      <span className="text-xs text-cream/40 md:hidden">
                        · {r.variant === "omaha" ? "PLO" : "NLH"} {r.smallBlind}/{r.bigBlind}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={full ? "glass" : "gold"}
                      className="row-span-2 row-start-1 w-20 md:row-span-1 md:row-start-auto"
                      onClick={() => router.push(`/room?code=${r.code}`)}
                    >
                      {full ? "Watch" : "Join"}
                    </Button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} className="max-w-lg">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-300/70">Public table</p>
        <h2 className="mb-6 mt-2 font-display text-3xl font-semibold">Open a table</h2>
        <CreateTableForm visibility="public" onDone={() => setCreating(false)} />
      </Modal>
    </>
  );
}
