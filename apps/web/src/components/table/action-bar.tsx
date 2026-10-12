"use client";

import type { PlayerAction, TableView } from "@felt/engine";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/cn";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function ActionBar({
  view,
  onAct,
  busy,
  highlight,
}: {
  view: TableView;
  onAct: (a: PlayerAction) => void;
  busy?: boolean;
  /** Move the coach recommends — gets a subtle glow. */
  highlight?: string | null;
}) {
  const legal = view.legal;
  const hero = view.hero !== null ? view.seats[view.hero] : null;
  const [raiseTo, setRaiseTo] = useState(legal?.minRaiseTo ?? 0);

  // Reset the slider whenever a new decision starts.
  const decisionKey = `${view.handNumber}:${view.street}:${view.currentBet}:${view.toAct}`;
  useEffect(() => {
    if (legal) setRaiseTo(legal.minRaiseTo);
  }, [decisionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const presets = useMemo(() => {
    if (!legal || !hero) return [];
    const toCall = view.currentBet - hero.bet;
    const potAfterCall = view.pot + toCall;
    const at = (f: number) => clamp(Math.round(view.currentBet + potAfterCall * f), legal.minRaiseTo, legal.maxRaiseTo);
    const list = [
      { label: "Min", to: legal.minRaiseTo },
      { label: "½ Pot", to: at(0.5) },
      { label: "¾ Pot", to: at(0.75) },
      { label: "Pot", to: at(1) },
    ];
    if (legal.maxRaiseTo === hero.bet + hero.stack) list.push({ label: "All-in", to: legal.maxRaiseTo });
    else list.push({ label: "Max", to: legal.maxRaiseTo });
    return list.filter((p, i, arr) => arr.findIndex((q) => q.to === p.to) === i);
  }, [legal, hero, view.currentBet, view.pot]);

  // Keyboard shortcuts: F fold, C check/call, R raise.
  useEffect(() => {
    if (!legal || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
      if (e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "f" && !legal.canCheck) onAct({ type: "fold" });
      else if (k === "c" || k === "k") onAct(legal.canCheck ? { type: "check" } : { type: "call" });
      else if (k === "r" && legal.canRaise) onAct({ type: "raise", to: raiseTo });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [legal, busy, raiseTo, onAct]);

  if (!legal || !hero) return null;
  const allIn = raiseTo >= hero.bet + hero.stack;
  const step = Math.max(1, view.config.smallBlind);
  const glow = (m: string) => highlight === m && "ring-2 ring-gold-300 ring-offset-2 ring-offset-ink-900";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass-strong mx-auto w-full max-w-3xl rounded-3xl p-3 sm:p-4"
    >
      {legal.canRaise && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setRaiseTo(p.to)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  raiseTo === p.to ? "bg-gold-400/25 text-gold-100 ring-1 ring-gold-300/60" : "bg-white/5 text-cream/70 hover:bg-white/10",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-1 items-center gap-3">
            <input
              type="range"
              className="gold-range w-full"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={step}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              aria-label="Raise amount"
            />
            <input
              type="number"
              className="h-9 w-24 rounded-lg border border-white/10 bg-black/40 px-2 text-right text-sm font-semibold tabular-nums outline-none focus:border-gold-400/60"
              value={raiseTo}
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value) || legal.minRaiseTo)}
              onBlur={() => setRaiseTo((v) => clamp(v, legal.minRaiseTo, legal.maxRaiseTo))}
              aria-label="Raise to"
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          disabled={busy || legal.canCheck}
          onClick={() => onAct({ type: "fold" })}
          className={cn(
            "h-12 rounded-2xl bg-gradient-to-b from-ink-600 to-ink-800 text-sm font-bold uppercase tracking-wider text-cream/85 ring-1 ring-white/10 transition hover:brightness-125 active:scale-[0.97] disabled:opacity-30 sm:h-14",
            glow("fold"),
          )}
        >
          Fold <kbd className="ml-1 hidden text-[10px] text-cream/40 sm:inline">F</kbd>
        </button>
        <button
          disabled={busy}
          onClick={() => onAct(legal.canCheck ? { type: "check" } : { type: "call" })}
          className={cn(
            "h-12 rounded-2xl bg-gradient-to-b from-felt-500 to-felt-700 text-sm font-bold uppercase tracking-wider text-white ring-1 ring-white/10 transition hover:brightness-110 active:scale-[0.97] disabled:opacity-40 sm:h-14",
            glow(legal.canCheck ? "check" : "call"),
          )}
        >
          {legal.canCheck ? "Check" : `Call ${fmt(legal.callAmount)}`}
          <kbd className="ml-1 hidden text-[10px] text-white/40 sm:inline">C</kbd>
        </button>
        <button
          disabled={busy || !legal.canRaise}
          onClick={() => onAct({ type: "raise", to: clamp(raiseTo, legal.minRaiseTo, legal.maxRaiseTo) })}
          className={cn(
            "h-12 rounded-2xl text-sm font-bold uppercase tracking-wider transition active:scale-[0.97] disabled:opacity-30 sm:h-14",
            allIn ? "bg-gradient-to-b from-ruby-400 to-ruby-600 text-white hover:brightness-110" : "btn-gold",
            glow(legal.raiseLabel),
          )}
        >
          {allIn ? `All-in ${fmt(raiseTo)}` : `${legal.raiseLabel === "bet" ? "Bet" : "Raise to"} ${fmt(raiseTo)}`}
          <kbd className="ml-1 hidden text-[10px] opacity-50 sm:inline">R</kbd>
        </button>
      </div>
    </motion.div>
  );
}
