"use client";

import { type RoomSettings, type Variant, type Visibility, STAKES, defaultSettings } from "@felt/engine";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { request, useSocket } from "@/lib/socket";
import { fmt, useProfile } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { Button } from "../ui/button";

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cream/50">{label}</p>
    {children}
    {hint && <p className="mt-1.5 text-xs text-cream/40">{hint}</p>}
  </div>
);

const Seg = <T extends string | number>({ options, value, onChange, cols }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; cols?: string }) => (
  <div className={cn("grid gap-2", cols ?? "grid-cols-2")}>
    {options.map((o) => (
      <button
        type="button"
        key={String(o.v)}
        onClick={() => onChange(o.v)}
        className={cn(
          "h-11 rounded-xl px-2 text-sm font-semibold ring-1 transition",
          value === o.v ? "bg-gold-400/15 text-gold-100 ring-gold-300/60" : "bg-white/[0.03] text-cream/70 ring-white/10 hover:bg-white/[0.06]",
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export function CreateTableForm({ visibility, onDone }: { visibility: Visibility; onDone?: () => void }) {
  const router = useRouter();
  const { socket, status } = useSocket();
  const myName = useProfile((s) => s.name);
  const [name, setName] = useState("");
  const [variant, setVariant] = useState<Variant>("holdem");
  const [bb, setBb] = useState(20);
  const [seats, setSeats] = useState(6);
  const [actionTime, setActionTime] = useState(25);
  const [busy, setBusy] = useState(false);
  const base = defaultSettings(visibility, bb, variant);

  const create = async () => {
    if (!socket) return;
    setBusy(true);
    const settings: RoomSettings = { ...base, name: name.trim(), maxSeats: seats, actionTime };
    try {
      const r = await request<{ ok: true; code: string } | { ok: false; error: string }>((cb) => socket.emit("room:create", settings, cb));
      if (!r.ok) throw new Error(r.error);
      onDone?.();
      router.push(`/room?code=${r.code}`);
    } catch (e) {
      toast("Couldn't create table", (e as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <Field label="Table name">
        <input
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          placeholder={myName ? `${myName}'s table` : "Friday night game"}
          className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 outline-none transition focus:border-gold-400/60 focus:ring-4 focus:ring-gold-400/10"
        />
      </Field>
      <Field label="Game">
        <Seg
          options={[
            { v: "holdem" as Variant, label: "No-Limit Hold'em" },
            { v: "omaha" as Variant, label: "Pot-Limit Omaha" },
          ]}
          value={variant}
          onChange={setVariant}
        />
      </Field>
      <Field label="Blinds" hint={`Buy-in ${fmt(base.minBuyIn)} – ${fmt(base.maxBuyIn)} play chips`}>
        <Seg options={STAKES.map((s) => ({ v: s.bb as number, label: `${s.sb}/${s.bb}` }))} value={bb} onChange={setBb} cols="grid-cols-5" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Seats">
          <Seg options={[2, 4, 6, 9].map((n) => ({ v: n, label: n === 2 ? "Heads-up" : `${n}` }))} value={seats} onChange={setSeats} />
        </Field>
        <Field label="Turn timer">
          <Seg options={[15, 25, 40, 60].map((n) => ({ v: n, label: `${n}s` }))} value={actionTime} onChange={setActionTime} />
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy || status !== "ready"}>
        {status !== "ready" ? "Connecting to server…" : busy ? "Creating…" : visibility === "private" ? "Create private room" : "Open public table"}
      </Button>
    </form>
  );
}
