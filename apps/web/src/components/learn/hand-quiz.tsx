"use client";

import { type Card, evaluateHoldem, freshDeck, shuffle } from "@felt/engine";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { StaticCard } from "../cards/playing-card";
import { Button } from "../ui/button";

interface Q {
  a: Card[];
  b: Card[];
  board: Card[];
}

function deal(): Q {
  const d = shuffle(freshDeck());
  return { a: d.slice(0, 2), b: d.slice(2, 4), board: d.slice(4, 9) };
}

type Pick = "a" | "b" | "split";

export function HandQuiz() {
  const [q, setQ] = useState<Q | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });

  useEffect(() => setQ(deal()), []);
  if (!q) return null;

  const va = evaluateHoldem([...q.a, ...q.board]);
  const vb = evaluateHoldem([...q.b, ...q.board]);
  const answer: Pick = va.score > vb.score ? "a" : vb.score > va.score ? "b" : "split";
  const best = new Set(answer === "b" ? vb.cards : answer === "a" ? va.cards : [...va.cards, ...vb.cards]);

  const choose = (p: Pick) => {
    if (pick) return;
    setPick(p);
    const ok = p === answer;
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0 }));
  };
  const next = () => {
    setPick(null);
    setQ(deal());
  };

  const Hand = ({ id, cards, label, value }: { id: Pick; cards: Card[]; label: string; value: typeof va }) => (
    <button
      onClick={() => choose(id)}
      disabled={!!pick}
      className={cn(
        "glass flex flex-1 flex-col items-center gap-3 rounded-3xl p-5 transition",
        !pick && "hover:-translate-y-1 hover:border-gold-300/40",
        pick && answer === id && "border-gold-300/70 shadow-[0_0_40px_-8px_rgba(223,189,111,.6)]",
        pick && pick === id && answer !== id && "border-ruby-400/60",
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-cream/50">{label}</span>
      <div className="flex gap-1.5">
        {cards.map((c) => (
          <StaticCard key={c} card={c} size="md" dim={!!pick && !best.has(c)} />
        ))}
      </div>
      <AnimatePresence>
        {pick && (
          <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-semibold text-gold-100">
            {value.name}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );

  return (
    <section className="mt-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-300/80">Quick-fire quiz</p>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Who wins this hand?</h2>
        </div>
        <div className="flex gap-6 text-sm">
          <span className="text-cream/50">
            Score <span className="font-bold text-cream">{score.right}/{score.total}</span>
          </span>
          <span className="text-cream/50">
            Streak <span className="font-bold text-gold-200">{score.streak}🔥</span>
          </span>
        </div>
      </div>
      <div className="rail rounded-[40px] p-2.5">
        <div className="rail-trim rounded-[32px]">
          <div className="felt noise relative rounded-[32px] p-5 sm:p-8">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-cream/50">Board</p>
            <div className="flex justify-center gap-1.5 sm:gap-2">
              {q.board.map((c) => (
                <StaticCard key={c} card={c} size="lg" dim={!!pick && !best.has(c)} className="max-sm:w-12" />
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Hand id="a" cards={q.a} label="Player A" value={va} />
              <div className="flex items-center justify-center">
                <button
                  onClick={() => choose("split")}
                  disabled={!!pick}
                  className={cn(
                    "rounded-full px-5 py-2.5 text-sm font-semibold ring-1 transition",
                    pick && answer === "split" ? "bg-gold-400/20 text-gold-100 ring-gold-300" : "bg-black/30 text-cream/70 ring-white/10 hover:bg-black/50",
                  )}
                >
                  Split pot
                </button>
              </div>
              <Hand id="b" cards={q.b} label="Player B" value={vb} />
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {pick && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-col items-center gap-4 text-center">
            <p className={cn("font-display text-2xl", pick === answer ? "text-gold-200" : "text-ruby-400")}>
              {pick === answer ? "Correct!" : "Not quite."}{" "}
              <span className="text-cream/70">
                {answer === "split" ? "Both players have the same best five cards." : `Player ${answer.toUpperCase()} wins with ${(answer === "a" ? va : vb).name.toLowerCase()}.`}
              </span>
            </p>
            <Button onClick={next}>Next hand →</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
