"use client";

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@felt/engine";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { request, useSocket } from "@/lib/socket";
import { toast } from "@/lib/toast";
import { Button } from "../ui/button";
import { CreateTableForm } from "./create-table-form";
import { ServerStatus } from "./server-status";

export function FriendsClient() {
  const router = useRouter();
  const { socket, status } = useSocket();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = code.toUpperCase().split("").filter((c) => ROOM_CODE_ALPHABET.includes(c)).join("").slice(0, ROOM_CODE_LENGTH);

  const join = async () => {
    if (!socket || clean.length !== ROOM_CODE_LENGTH) return;
    setBusy(true);
    try {
      const r = await request<{ ok: true; code: string } | { ok: false; error: string }>((cb) => socket.emit("room:join", { code: clean }, cb));
      if (!r.ok) throw new Error(r.error);
      router.push(`/room?code=${r.code}`);
    } catch (e) {
      toast("Couldn't join", (e as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <>
      <ServerStatus />
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <section className="glass-strong rounded-3xl p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-300/70">Host</p>
          <h2 className="mb-6 mt-2 font-display text-3xl font-semibold">Create a room</h2>
          <CreateTableForm visibility="private" />
        </section>
        <section className="glass-strong flex flex-col rounded-3xl p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-300/70">Guest</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">Join with a code</h2>
          <p className="mt-2 text-sm text-cream/55">Ask the host for their 6-character room code.</p>
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <input
              value={clean}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              inputMode="text"
              autoCapitalize="characters"
              aria-label="Room code"
              className="h-20 w-full rounded-2xl border border-white/10 bg-black/40 text-center font-display text-4xl font-semibold tracking-[0.4em] text-gold-100 uppercase outline-none transition placeholder:text-white/10 focus:border-gold-400/60 focus:ring-4 focus:ring-gold-400/10"
            />
            <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy || clean.length !== ROOM_CODE_LENGTH || status !== "ready"}>
              {busy ? "Joining…" : "Join room"}
            </Button>
          </form>
          <div className="mt-auto pt-8">
            <div className="rounded-2xl bg-white/[0.03] p-4 text-sm text-cream/55 ring-1 ring-white/5">
              <p className="font-semibold text-cream/80">How it works</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>The host creates a room and shares the code or invite link.</li>
                <li>Everyone joins, picks a seat and buys in with play chips.</li>
                <li>The host presses Start. Chips go back to your bankroll when you leave.</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
