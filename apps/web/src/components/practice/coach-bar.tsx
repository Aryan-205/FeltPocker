"use client";

import { type BotPersonality, type CoachAdvice, type TableView, readHand } from "@felt/engine";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { Decision } from "@/hooks/use-practice";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/cn";

const STYLE_HINT: Record<string, string> = {
  rock: "Tight players rarely bluff, so give their raises respect.",
  lag: "Aggressive players also bet weak hands. Don't fold good hands too easily.",
  station: "Calling stations call too often. Bet your good hands and don't bluff them.",
  reg: "A solid regular. Their bets usually mean something.",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function CoachBar({
  view,
  advice,
  heroTurn,
  decisions,
  personalities,
}: {
  view: TableView;
  advice: CoachAdvice | null;
  heroTurn: boolean;
  decisions: Decision[];
  personalities: Record<number, BotPersonality>;
}) {
  const [open, setOpen] = useState(true);
  const hero = view.seats[view.hero ?? 0]!;
  const complete = view.street === "complete";

  const watching = useMemo(() => {
    const last = [...view.log].reverse().find((e) => e.t === "action" && e.seat !== view.hero);
    if (!last || last.t !== "action") return null;
    const p = view.seats[last.seat];
    if (!p) return null;
    const style = personalities[last.seat];
    const amt = fmt(last.amount);
    const text: Record<string, string> = {
      fold: `${p.name} folded. Fewer opponents means your hand gets relatively stronger.`,
      check: `${p.name} checked. They may be weak, or setting a trap.`,
      call: `${p.name} called ${amt}. Calling shows some interest but less strength than raising.`,
      bet: `${p.name} bet ${amt}. A bet signals strength, or a bluff.`,
      raise: `${p.name} raised to ${amt}. Raises usually mean a strong hand.`,
      allin: `${p.name} moved all-in for ${amt}! Only continue with a hand that can win a showdown.`,
    };
    return { text: text[last.kind] ?? "", hint: style ? STYLE_HINT[style.key] : null };
  }, [view, personalities]);

  const reading = useMemo(() => {
    if (hero.folded || hero.hole.some((c) => c === null) || !hero.hole.length) return null;
    return readHand(view.config.variant, hero.hole as number[], view.board);
  }, [hero, view.board, view.config.variant]);

  let mode: "advice" | "thinking" | "watching" | "folded" | "recap";
  if (complete) mode = "recap";
  else if (heroTurn) mode = advice ? "advice" : "thinking";
  else if (hero.folded) mode = "folded";
  else mode = "watching";

  return (
    <div className="glass-strong relative overflow-hidden rounded-3xl">
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" />
      <div className="relative flex items-start gap-3 p-3 sm:gap-4 sm:px-5 sm:py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-gold-200 to-gold-500 text-lg shadow-[0_8px_20px_-6px_rgba(212,169,79,.7)] sm:h-12 sm:w-12 sm:text-xl">
          🎓
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold-300/80">
              Coach · {mode === "advice" ? "Your move" : mode === "recap" ? "Hand recap" : mode === "thinking" ? "Reading the table" : "Watching"}
            </p>
            {mode === "advice" && <span className="pulse-ring h-2 w-2 rounded-full bg-gold-300" />}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode + (advice?.headline ?? "") + view.log.length}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {mode === "advice" && advice && (
                <>
                  <h2 className="mt-0.5 font-display text-xl font-semibold leading-snug sm:text-[22px]">{advice.headline}</h2>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-cream/65">{advice.reason}</p>
                </>
              )}
              {mode === "thinking" && <h2 className="mt-1 font-display text-xl text-cream/70">Crunching the odds…</h2>}
              {mode === "watching" && (
                <>
                  <h2 className="mt-1 font-display text-lg font-semibold leading-snug sm:text-xl">{watching?.text || "Waiting for the other players…"}</h2>
                  <p className="mt-1 text-sm text-cream/60">
                    {reading ? reading.plain : ""} {watching?.hint && <span className="text-gold-200/80">{watching.hint}</span>}
                  </p>
                </>
              )}
              {mode === "folded" && (
                <>
                  <h2 className="mt-1 font-display text-lg font-semibold sm:text-xl">You&apos;re out of this hand. Watch and learn.</h2>
                  <p className="mt-1 text-sm text-cream/60">
                    {watching?.text} {watching?.hint && <span className="text-gold-200/80">{watching.hint}</span>}
                  </p>
                </>
              )}
              {mode === "recap" && <Recap view={view} decisions={decisions} />}
            </motion.div>
          </AnimatePresence>
        </div>
        {mode === "advice" && advice && (
          <div className="hidden shrink-0 gap-2 md:flex">
            <Stat label="Win chance" value={pct(advice.equity)} tone={advice.equity >= advice.needed ? "good" : "bad"} />
            {advice.needed > 0 && <Stat label="Needed to call" value={pct(advice.needed)} />}
            <Stat label="Your hand" value={advice.hand.label} wide />
          </div>
        )}
        {mode === "advice" && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 rounded-full px-2 py-1 text-xs text-cream/50 hover:bg-white/5 hover:text-cream md:hidden"
            aria-expanded={open}
          >
            {open ? "Less" : "More"}
          </button>
        )}
      </div>

      {mode === "advice" && advice && (
        <div className={cn("relative border-t border-white/5 px-3 pb-3 pt-2.5 sm:px-5", !open && "max-md:hidden")}>
          <div className="mb-3 flex gap-2 md:hidden">
            <Stat label="Win chance" value={pct(advice.equity)} tone={advice.equity >= advice.needed ? "good" : "bad"} />
            {advice.needed > 0 && <Stat label="Needed" value={pct(advice.needed)} />}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {advice.outcomes.map((o) => (
              <div
                key={o.move}
                className={cn(
                  "rounded-2xl px-3 py-2 ring-1 transition",
                  o.recommended ? "bg-gold-400/10 ring-gold-300/50" : "bg-white/[0.03] ring-white/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-bold", o.recommended ? "text-gold-100" : "text-cream/85")}>{o.label}</span>
                  {o.recommended ? (
                    <span className="rounded-full bg-gold-300 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-ink-900">Best</span>
                  ) : o.ev !== null ? (
                    <span className={cn("text-[11px] font-semibold tabular-nums", o.ev >= 0 ? "text-felt-500" : "text-ruby-400")}>
                      {o.ev >= 0 ? "+" : ""}
                      {fmt(o.ev)} EV
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11.5px] leading-snug text-cream/55 md:line-clamp-2" title={o.text}>{o.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-cream/45">
            <span className="font-semibold text-gold-200/80">Tip:</span> {advice.lesson}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, wide }: { label: string; value: string; tone?: "good" | "bad"; wide?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-black/30 px-3 py-2 ring-1 ring-white/5", wide ? "max-w-[190px]" : "min-w-[84px]")}>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate font-semibold tabular-nums",
          wide ? "text-sm" : "text-lg",
          tone === "good" && "text-felt-500",
          tone === "bad" && "text-ruby-400",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function Recap({ view, decisions }: { view: TableView; decisions: Decision[] }) {
  const r = view.result;
  const heroSeat = view.hero ?? 0;
  const won = r?.won[heroSeat] ?? 0;
  const hero = view.seats[heroSeat]!;
  const followed = decisions.filter((d) => d.followed).length;
  const winners = Object.keys(r?.won ?? {}).map(Number);
  const winnerName = winners.map((w) => view.seats[w]?.name).join(" & ");
  const handName = r?.pots[0]?.handName;

  let headline: string;
  if (won > 0) headline = `You won ${fmt(won)} chips${handName ? ` with ${handName.toLowerCase()}` : ""}! 🎉`;
  else if (hero.folded) headline = `You folded. ${winnerName} took the pot${handName ? ` with ${handName.toLowerCase()}` : ""}.`;
  else headline = `${winnerName} won${handName ? ` with ${handName.toLowerCase()}` : ""}.`;

  return (
    <>
      <h2 className="mt-1 font-display text-xl font-semibold leading-snug sm:text-2xl">{headline}</h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {decisions.length === 0 && <span className="text-sm text-cream/55">No decisions this hand. Next hand coming up.</span>}
        {decisions.map((d, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
              d.followed ? "bg-felt-600/30 text-felt-500 ring-felt-500/30" : "bg-ruby-500/10 text-ruby-400 ring-ruby-400/25",
            )}
          >
            {d.street}: you {d.taken}
            {d.followed ? " ✓" : ` · coach said ${d.recommended}`}
          </span>
        ))}
      </div>
      {decisions.length > 0 && (
        <p className="mt-2 text-xs text-cream/50">
          You matched the coach on {followed} of {decisions.length} decisions.{" "}
          {followed === decisions.length ? "Textbook play!" : "Winning poker is about good decisions, not single results."}
        </p>
      )}
    </>
  );
}
