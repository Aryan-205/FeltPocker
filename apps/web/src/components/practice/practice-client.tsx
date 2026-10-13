"use client";

import type { Variant } from "@felt/engine";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { type PracticeConfig, HERO, usePractice } from "@/hooks/use-practice";
import { useTableSounds } from "@/hooks/use-table-sounds";
import { PRACTICE_STACK, fmt, useProfile } from "@/lib/store";
import { cn } from "@/lib/cn";
import { TopBar } from "../top-bar";
import { ActionBar } from "../table/action-bar";
import { PokerTable } from "../table/poker-table";
import { Button } from "../ui/button";
import { CoachPanel } from "./coach-panel";
import { FitBox } from "../fit-box";

export function PracticeClient() {
  const [config, setConfig] = useState<PracticeConfig | null>(null);
  return (
    <main className={cn("room-bg relative flex flex-col", config ? "min-h-dvh md:h-dvh md:overflow-hidden" : "min-h-dvh")}>
      <TopBar back={{ href: "/learn", label: "Learn" }} title="Practice" className="shrink-0 sm:h-16" />
      {config ? <PracticeGame config={config} onExit={() => setConfig(null)} /> : <Setup onStart={setConfig} />}
    </main>
  );
}

function Setup({ onStart }: { onStart: (c: PracticeConfig) => void }) {
  const [variant, setVariant] = useState<Variant>("holdem");
  const [opponents, setOpponents] = useState(4);
  const chips = useProfile((s) => s.practiceChips);
  const hydrated = useProfile((s) => s.hydrated);
  const setChips = useProfile((s) => s.setPracticeChips);

  return (
    <div className="relative z-10 mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-6 sm:pt-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-6 sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-300/80">Practice game</p>
        <h1 className="mt-3 font-display text-4xl font-semibold">Set up your table</h1>
        <p className="mt-2 text-sm text-cream/55">
          Practice chips are separate from your bankroll. A coach beside the table talks you through every decision.
        </p>

        <div className="mt-8 space-y-7">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cream/50">Game</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["holdem", "Texas Hold'em", "2 hole cards · No-limit"],
                ["omaha", "Pot-Limit Omaha", "4 hole cards · use exactly 2"],
              ] as const).map(([v, t, d]) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className={cn(
                    "rounded-2xl p-4 text-left ring-1 transition",
                    variant === v ? "bg-gold-400/10 ring-gold-300/60" : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]",
                  )}
                >
                  <p className="font-semibold">{t}</p>
                  <p className="mt-0.5 text-xs text-cream/50">{d}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-cream/50">Opponents</p>
              <p className="text-sm font-semibold text-gold-200">{opponents} bots</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setOpponents(n)}
                  className={cn(
                    "h-11 rounded-xl font-semibold ring-1 transition",
                    opponents === n ? "bg-gold-400/15 text-gold-100 ring-gold-300/60" : "bg-white/[0.03] text-cream/70 ring-white/10 hover:bg-white/[0.06]",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-cream/40">{opponents === 1 ? "Heads-up: you play every hand. Great for learning aggression." : "A full table plays tighter. You'll fold more and learn patience."}</p>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4 ring-1 ring-white/5">
            <div>
              <p className="text-xs uppercase tracking-widest text-cream/45">Practice chips</p>
              <p className="text-2xl font-semibold tabular-nums text-gold-100">{hydrated ? fmt(chips) : "—"}</p>
            </div>
            <Button variant="glass" size="sm" onClick={() => setChips(PRACTICE_STACK)}>
              Reset to {fmt(PRACTICE_STACK)}
            </Button>
          </div>
          <Button size="lg" className="w-full" disabled={!hydrated} onClick={() => {
            if (chips <= 0) setChips(PRACTICE_STACK);
            onStart({ variant, opponents });
          }}>
            Deal me in
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function PracticeGame({ config, onExit }: { config: PracticeConfig; onExit: () => void }) {
  const { view, advice, heroTurn, act, dealNext, autoDealIn, decisions, rebuy, tags, personalities } = usePractice(config);
  useTableSounds(view);
  if (!view) return null;
  const hero = view.seats[HERO]!;
  const complete = view.street === "complete";
  const busted = complete && hero.stack === 0;

  return (
    <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-3 px-3 pb-3 sm:px-6 md:flex-row">
      <div className="flex min-h-[calc(100dvh-5rem)] min-w-0 flex-1 flex-col gap-2 sm:gap-3 md:min-h-0">
      <FitBox aspect={16 / 9.4} portraitAspect={3 / 4.4}>
          <PokerTable
            view={view}
            tags={tags}
            center={
              complete ? (
                <div className="mt-1 flex items-center gap-2">
                  {busted ? (
                    <Button size="sm" onClick={rebuy}>
                      Reload {fmt(PRACTICE_STACK)} practice chips
                    </Button>
                  ) : (
                    <Button size="sm" variant="glass" onClick={dealNext}>
                      Deal next hand {autoDealIn !== null ? `(${autoDealIn})` : ""}
                    </Button>
                  )}
                </div>
              ) : null
            }
          />
      </FitBox>
      <div className="relative z-30 min-h-[52px] shrink-0">
        <AnimatePresence>
          {heroTurn && (
            <ActionBar key="bar" view={view} onAct={act} highlight={advice?.recommended ?? null} />
          )}
        </AnimatePresence>
        {!heroTurn && (
          <div className="flex items-center justify-between gap-3 px-1 text-xs text-cream/40">
            <span>
              {config.variant === "omaha" ? "Pot-Limit Omaha" : "No-Limit Hold'em"} · Blinds 10/20 · Hand #{view.handNumber}
            </span>
            <button onClick={onExit} className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-cream">
              Change table
            </button>
          </div>
        )}
      </div>
      </div>
      <CoachPanel
        view={view}
        advice={advice}
        heroTurn={heroTurn}
        decisions={decisions}
        personalities={personalities.current}
        className="h-[420px] shrink-0 md:h-auto md:w-[340px] lg:w-[380px]"
      />
    </div>
  );
}
