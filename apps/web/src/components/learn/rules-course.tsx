"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "../ui/button";
import { LESSONS } from "./lessons";

export function RulesCourse() {
  const [i, setI] = useState(0);
  const lesson = LESSONS[i]!;
  const last = i === LESSONS.length - 1;

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-10">
      {/* Steps */}
      <nav className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {LESSONS.map((l, k) => (
          <button
            key={l.id}
            onClick={() => setI(k)}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition lg:w-full",
              k === i ? "glass text-cream" : "text-cream/50 hover:bg-white/[0.04] hover:text-cream/80",
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                k < i ? "bg-felt-600 text-white" : k === i ? "btn-gold" : "bg-white/5",
              )}
            >
              {k < i ? "✓" : k + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{l.title}</span>
              <span className="hidden truncate text-xs text-cream/40 lg:block">{l.summary}</span>
            </span>
          </button>
        ))}
      </nav>

      {/* Lesson */}
      <AnimatePresence mode="wait">
        <motion.article
          key={lesson.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="glass rounded-3xl p-6 sm:p-10"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-300/70">
            Lesson {i + 1} of {LESSONS.length}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold sm:text-5xl">{lesson.title}</h1>
          <div className="mt-8 grid items-center gap-8 xl:grid-cols-2">
            <div className="text-[15px]">{lesson.body}</div>
            <div>{lesson.visual}</div>
          </div>
          <div className="mt-10 flex items-center justify-between border-t border-white/5 pt-6">
            <Button variant="ghost" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
              ← Previous
            </Button>
            <div className="hidden gap-1.5 sm:flex">
              {LESSONS.map((l, k) => (
                <span key={l.id} className={cn("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-gold-300" : "w-1.5 bg-white/15")} />
              ))}
            </div>
            {last ? (
              <ButtonLink href="/learn/hands">Hand rankings →</ButtonLink>
            ) : (
              <Button onClick={() => setI((x) => x + 1)}>Next →</Button>
            )}
          </div>
        </motion.article>
      </AnimatePresence>
    </div>
  );
}
