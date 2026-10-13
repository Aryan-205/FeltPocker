"use client";

import {
  type BotPersonality,
  type Card,
  type CoachAdvice,
  type TableView,
  RANKS,
  SUIT_SYMBOLS,
  rankOf,
  readHand,
  suitOf,
} from "@felt/engine";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Decision } from "@/hooks/use-practice";
import { fmt } from "@/lib/store";
import { cn } from "@/lib/cn";

const STYLE_HINT: Record<string, string> = {
  rock: "Tight players rarely bluff, so give their raises respect.",
  lag: "Aggressive players also bet weak hands. Don't fold good hands too easily.",
  station: "Calling stations call too often. Bet your good hands and don't bluff them.",
  reg: "A solid regular. Their bets usually mean something.",
};

/** Minimum time between two coach messages, so each one can actually be read. */
const MESSAGE_GAP = 1400;
const MAX_MESSAGES = 200;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const cardText = (c: Card) => `${RANKS[rankOf(c)] === "T" ? "10" : RANKS[rankOf(c)]}${SUIT_SYMBOLS[suitOf(c)]}`;
const cardsText = (cs: Card[]) => cs.map(cardText).join(" ");
const STREET_NAME: Record<string, string> = { flop: "Flop", turn: "Turn", river: "River" };

type Msg =
  | { id: number; kind: "divider"; text: string }
  | { id: number; kind: "coach"; title?: string; text: string; hint?: string | null }
  | { id: number; kind: "street"; title: string; cards: string; text?: string }
  | { id: number; kind: "advice"; advice: CoachAdvice }
  | { id: number; kind: "you"; text: string; followed: boolean | null; recommended?: string }
  | { id: number; kind: "recap"; headline: string; won: boolean; summary: string | null };

type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, "id"> : never) : never;

export function CoachPanel({
  view,
  advice,
  heroTurn,
  decisions,
  personalities,
  className,
}: {
  view: TableView;
  advice: CoachAdvice | null;
  heroTurn: boolean;
  decisions: Decision[];
  personalities: Record<number, BotPersonality>;
  className?: string;
}) {
  const [feed, setFeed] = useState<Msg[]>([]);
  const [pending, setPending] = useState(0);
  const queue = useRef<Msg[]>([]);
  const nextId = useRef(1);
  const lastShown = useRef(0);
  // Per-hand bookkeeping for turning the table log into messages.
  const track = useRef({ hand: -1, logIdx: 0, decisionsSeen: 0, hinted: new Set<number>(), recapped: false, adviceKey: "" });

  const enqueue = (...msgs: NewMsg[]) => {
    for (const m of msgs) queue.current.push({ ...m, id: nextId.current++ } as Msg);
    setPending(queue.current.length);
  };

  // Translate new table events into chat messages.
  useEffect(() => {
    const t = track.current;
    const heroSeat = view.hero ?? 0;
    const hero = view.seats[heroSeat]!;
    const variant = view.config.variant;
    const holeKnown = hero.hole.length > 0 && hero.hole.every((c) => c !== null);

    if (view.handNumber !== t.hand) {
      track.current = { hand: view.handNumber, logIdx: 0, decisionsSeen: 0, hinted: new Set(), recapped: false, adviceKey: "" };
      enqueue({ kind: "divider", text: `Hand #${view.handNumber}` });
      if (holeKnown) {
        const hole = hero.hole as Card[];
        enqueue({ kind: "coach", title: `You're dealt ${cardsText(hole)}`, text: readHand(variant, hole, []).plain });
      }
    }
    const tr = track.current;

    for (; tr.logIdx < view.log.length; tr.logIdx++) {
      const e = view.log[tr.logIdx]!;
      if (e.t === "street" && STREET_NAME[e.street]) {
        const text = !hero.folded && holeKnown ? readHand(variant, hero.hole as Card[], e.board).plain : undefined;
        enqueue({ kind: "street", title: STREET_NAME[e.street]!, cards: cardsText(e.board), text });
      } else if (e.t === "action" && e.seat === heroSeat) {
        // Drop advice the player never got to read; they've already acted.
        queue.current = queue.current.filter((m) => m.kind !== "advice");
        const verb = { fold: "fold", check: "check", call: `call ${fmt(e.amount)}`, bet: `bet ${fmt(e.amount)}`, raise: `raise to ${fmt(e.amount)}`, allin: `go all-in for ${fmt(e.amount)}` }[e.kind];
        const d = decisions.length > tr.decisionsSeen ? decisions[tr.decisionsSeen++] : undefined;
        enqueue({ kind: "you", text: `I ${verb ?? e.kind}.`, followed: d ? d.followed : null, recommended: d?.recommended });
      } else if (e.t === "action") {
        const p = view.seats[e.seat];
        if (!p) continue;
        const amt = fmt(e.amount);
        const text: Record<string, string> = {
          fold: `${p.name} folded. Fewer opponents means your hand gets relatively stronger.`,
          check: `${p.name} checked. They may be weak, or setting a trap.`,
          call: `${p.name} called ${amt}. Calling shows some interest but less strength than raising.`,
          bet: `${p.name} bet ${amt}. A bet signals strength, or a bluff.`,
          raise: `${p.name} raised to ${amt}. Raises usually mean a strong hand.`,
          allin: `${p.name} moved all-in for ${amt}! Only continue with a hand that can win a showdown.`,
        };
        // Explain a player's style the first time they show aggression this hand.
        const style = personalities[e.seat];
        let hint: string | null = null;
        if (style && ["bet", "raise", "allin"].includes(e.kind) && !tr.hinted.has(e.seat)) {
          tr.hinted.add(e.seat);
          hint = STYLE_HINT[style.key] ?? null;
        }
        enqueue({ kind: "coach", text: text[e.kind] ?? "", hint });
      }
    }

    if (view.street === "complete" && !tr.recapped) {
      tr.recapped = true;
      enqueue(recapMessage(view, decisions));
    }
    // decisions only change alongside the view, so reading them here is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // A fresh piece of advice for each of the player's decisions.
  useEffect(() => {
    if (!advice || !heroTurn) return;
    const key = `${view.handNumber}:${view.log.length}`;
    if (track.current.adviceKey === key) return;
    track.current.adviceKey = key;
    enqueue({ kind: "advice", advice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advice, heroTurn]);

  // Release queued messages one at a time.
  useEffect(() => {
    if (pending === 0) return;
    const wait = Math.max(0, lastShown.current + MESSAGE_GAP - Date.now());
    const id = setTimeout(() => {
      const next = queue.current.shift();
      lastShown.current = Date.now();
      if (next) setFeed((f) => [...f, next].slice(-MAX_MESSAGES));
      setPending(queue.current.length);
    }, wait);
    return () => clearTimeout(id);
  }, [pending, feed]);

  // Always keep the chat scrolled to the latest message, including when
  // messages grow or shrink after they render (e.g. advice collapsing).
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const stick = () => {
      el.scrollTop = el.scrollHeight;
    };
    stick();
    const ro = new ResizeObserver(stick);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const activeAdvice = heroTurn ? [...feed].reverse().find((m) => m.kind === "advice")?.id : undefined;
  const typing = pending > 0 || (heroTurn && !advice);

  return (
    <aside className={cn("glass-strong relative flex min-h-0 flex-col overflow-hidden rounded-3xl", className)}>
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-gold-400/10 blur-3xl" />
      <header className="relative flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-gold-200 to-gold-500 text-base shadow-[0_8px_20px_-6px_rgba(212,169,79,.7)]">
          🎓
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Coach</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-300/80">
            {heroTurn ? "Your move" : view.street === "complete" ? "Hand recap" : "Watching the table"}
          </p>
        </div>
        {heroTurn && <span className="pulse-ring ml-auto h-2 w-2 rounded-full bg-gold-300" />}
      </header>

      <div
        ref={scroller}
        className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto px-3 py-3"
      >
        <div ref={content} className="space-y-2.5">
          {feed.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <Message msg={m} live={m.id === activeAdvice} />
            </motion.div>
          ))}
          <AnimatePresence>
            {typing && (
              <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-fit gap-1 rounded-2xl rounded-tl-md bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-cream/50"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

function Message({ msg, live }: { msg: Msg; live: boolean }) {
  switch (msg.kind) {
    case "divider":
      return (
        <div className="flex items-center gap-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-cream/30">
          <span className="h-px flex-1 bg-white/10" />
          {msg.text}
          <span className="h-px flex-1 bg-white/10" />
        </div>
      );
    case "coach":
      return (
        <Bubble>
          {msg.title && <p className="font-semibold text-cream">{msg.title}</p>}
          <p className={cn(msg.title && "mt-0.5 text-cream/65")}>{msg.text}</p>
          {msg.hint && <p className="mt-1 text-gold-200/80">{msg.hint}</p>}
        </Bubble>
      );
    case "street":
      return (
        <Bubble>
          <p className="font-semibold text-cream">
            {msg.title}: <span className="tabular-nums text-gold-100">{msg.cards}</span>
          </p>
          {msg.text && <p className="mt-0.5 text-cream/65">{msg.text}</p>}
        </Bubble>
      );
    case "you":
      return (
        <div className="flex flex-col items-end gap-1">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gold-400/15 px-3 py-2 text-[13px] text-gold-50 ring-1 ring-gold-300/30">{msg.text}</div>
          {msg.followed !== null && (
            <span className={cn("text-[10.5px] font-semibold", msg.followed ? "text-felt-500" : "text-ruby-400")}>
              {msg.followed ? "✓ Matches the coach" : `Coach suggested ${msg.recommended}`}
            </span>
          )}
        </div>
      );
    case "recap":
      return (
        <div className={cn("rounded-2xl px-3.5 py-3 ring-1", msg.won ? "bg-felt-600/20 ring-felt-500/30" : "bg-white/[0.04] ring-white/10")}>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-300/80">Hand recap</p>
          <p className="mt-1 font-display text-lg font-semibold leading-snug">{msg.headline}</p>
          {msg.summary && <p className="mt-1 text-xs text-cream/55">{msg.summary}</p>}
        </div>
      );
    case "advice":
      return <AdviceMessage advice={msg.advice} live={live} />;
  }
}

function Bubble({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-white/[0.05] px-3 py-2 text-[13px] leading-relaxed text-cream/80 ring-1 ring-white/5">{children}</div>;
}

function AdviceMessage({ advice, live }: { advice: CoachAdvice; live: boolean }) {
  return (
    <div className={cn("rounded-2xl rounded-tl-md px-3.5 py-3 ring-1 transition", live ? "bg-gold-400/[0.08] ring-gold-300/40" : "bg-white/[0.04] ring-white/5")}>
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-300/80">Your move</p>
      <p className="mt-1 font-display text-lg font-semibold leading-snug">{advice.headline}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-cream/65">{advice.reason}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Stat label="Win chance" value={pct(advice.equity)} tone={advice.equity >= advice.needed ? "good" : "bad"} />
        {advice.needed > 0 && <Stat label="Needed" value={pct(advice.needed)} />}
        <Stat label="Hand" value={advice.hand.label} />
      </div>
      {live && (
        <div className="mt-2.5 space-y-1.5">
          {advice.outcomes.map((o) => (
            <div key={o.move} className={cn("rounded-xl px-2.5 py-2 ring-1", o.recommended ? "bg-gold-400/10 ring-gold-300/50" : "bg-black/20 ring-white/5")}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-[13px] font-bold", o.recommended ? "text-gold-100" : "text-cream/85")}>{o.label}</span>
                {o.recommended ? (
                  <span className="rounded-full bg-gold-300 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-ink-900">Best</span>
                ) : o.ev !== null ? (
                  <span className={cn("text-[11px] font-semibold tabular-nums", o.ev >= 0 ? "text-felt-500" : "text-ruby-400")}>
                    {o.ev >= 0 ? "+" : ""}
                    {fmt(o.ev)} EV
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-cream/55">{o.text}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-xs text-cream/45">
        <span className="font-semibold text-gold-200/80">Tip:</span> {advice.lesson}
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/30 px-2.5 py-1.5 ring-1 ring-white/5">
      <p className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-cream/40">{label}</p>
      <p
        className={cn("truncate text-sm font-semibold tabular-nums", tone === "good" && "text-felt-500", tone === "bad" && "text-ruby-400")}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function recapMessage(view: TableView, decisions: Decision[]): NewMsg {
  const r = view.result;
  const heroSeat = view.hero ?? 0;
  const won = r?.won[heroSeat] ?? 0;
  const hero = view.seats[heroSeat]!;
  const followed = decisions.filter((d) => d.followed).length;
  const winners = Object.keys(r?.won ?? {}).map(Number);
  const winnerName = winners.map((w) => view.seats[w]?.name).join(" & ");
  const handName = r?.pots[0]?.handName;
  const withHand = handName ? ` with ${handName.toLowerCase()}` : "";

  let headline: string;
  if (won > 0) headline = `You won ${fmt(won)} chips${withHand}! 🎉`;
  else if (hero.folded) headline = `You folded. ${winnerName} took the pot${withHand}.`;
  else headline = `${winnerName} won${withHand}.`;

  const summary = decisions.length
    ? `You matched the coach on ${followed} of ${decisions.length} decisions. ${
        followed === decisions.length ? "Textbook play!" : "Winning poker is about good decisions, not single results."
      }`
    : null;
  return { kind: "recap", headline, won: won > 0, summary };
}
